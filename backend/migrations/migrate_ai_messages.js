#!/usr/bin/env node
/**
 * 迁移脚本：从 ai_usage_logs 迁移 messages 到 ai_messages 表
 * 
 * 使用方法：
 *   node migrate_ai_messages.js
 * 
 * 注意：
 * - 需要先执行 migrate_ai_conversations.sql 创建 conversations
 * - 这个脚本会处理 JSONB 数组中的消息，并去重
 * - 支持断点续传（如果 messages 已存在会跳过）
 */

const { supabase } = require('../src/services/database');
const path = require('path');

/**
 * 从 content 表获取 language_code
 */
async function getLanguageCodeFromContent(contentId) {
  if (!contentId) return 'zh-CN';
  
  try {
    const { data: content } = await supabase
      .from('content')
      .select('language_code')
      .eq('id', contentId)
      .single();
    
    return content?.language_code || 'zh-CN';
  } catch (error) {
    console.warn(`  ⚠️  获取 content ${contentId} 的 language_code 失败:`, error.message);
    return 'zh-CN';
  }
}

// 确保环境变量已加载
const envPath = process.env.NODE_ENV === 'production' 
  ? undefined
  : path.resolve(__dirname, '../../.env');

if (envPath) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// 配置
const BATCH_SIZE = 100; // 每批处理 100 条 logs
const MESSAGE_BATCH_SIZE = 50; // 每批插入 50 条 messages

/**
 * 迁移所有 messages
 */
async function migrateMessages() {
  console.log('🚀 开始迁移 AI Guide messages...\n');

  try {
    // 1. 检查 conversations 是否已创建
    const { count: convCount, error: convCountError } = await supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true });

    if (convCountError) {
      throw new Error(`检查 conversations 失败: ${convCountError.message}`);
    }

    if (convCount === 0) {
      console.warn('⚠️  警告：ai_conversations 表为空，请先执行 migrate_ai_conversations.sql');
      process.exit(1);
    }

    console.log(`✅ 找到 ${convCount} 个 conversations\n`);

    // 2. 获取所有 ai_guide 类型的 logs（按 created_at 排序）
    console.log('📥 获取 ai_usage_logs 数据...');
    const { data: logs, error: logsError } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('action_type', 'ai_guide')
      .not('request_id', 'is', null)
      .order('created_at', { ascending: true });

    if (logsError) {
      throw new Error(`获取 logs 失败: ${logsError.message}`);
    }

    if (!logs || logs.length === 0) {
      console.log('✅ 没有需要迁移的数据');
      return;
    }

    console.log(`✅ 找到 ${logs.length} 条 logs\n`);

    // 3. 统计已存在的 messages（用于进度显示）
    const { count: existingMsgCount } = await supabase
      .from('ai_messages')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 当前已有 ${existingMsgCount || 0} 条 messages\n`);

    // 4. 按 conversation_id 分组处理
    const conversationMap = new Map(); // request_id -> { conversation, messages }
    let totalMessagesProcessed = 0;
    let totalMessagesInserted = 0;
    let skippedConversations = 0;
    let errorCount = 0;
    let nullContentIdConversations = new Set(); // 记录 NULL content_id 的 conversations

    // 按批次处理 logs
    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const batch = logs.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(logs.length / BATCH_SIZE);

      console.log(`📦 处理批次 ${batchNum}/${totalBatches} (${batch.length} 条 logs)...`);

      for (const log of batch) {
        if (!log.request_id) {
          skippedConversations++;
          continue;
        }

        try {
          // 4.1. 检查 conversation 是否存在
          const { data: existingConv } = await supabase
            .from('ai_conversations')
            .select('id, content_id')
            .eq('id', log.request_id)
            .single();

          if (!existingConv) {
            console.warn(`  ⚠️  Conversation ${log.request_id} 不存在，跳过`);
            skippedConversations++;
            continue;
          }

          // 4.1.1. 如果 conversation 的 content_id 为 NULL，但 log 中有 content_id，尝试更新
          if (!existingConv.content_id && log.content_id) {
            // 先验证 content 是否存在
            const { data: contentExists } = await supabase
              .from('content')
              .select('id, language_code')
              .eq('id', log.content_id)
              .single();
            
            if (contentExists) {
              console.log(`  ℹ️  更新 conversation ${log.request_id} 的 content_id: ${log.content_id}`);
              const { error: updateError } = await supabase
                .from('ai_conversations')
                .update({ 
                  content_id: log.content_id,
                  language_code: contentExists.language_code || 'zh-CN'
                })
                .eq('id', log.request_id);
              
              if (updateError) {
                console.warn(`  ⚠️  更新 conversation content_id 失败:`, updateError.message);
              }
            } else {
              console.warn(`  ⚠️  Content ${log.content_id} 不存在（可能已被删除），跳过更新`);
            }
          }
          
          // 4.1.2. 如果 conversation 的 content_id 仍为 NULL，标记
          if (!existingConv.content_id) {
            nullContentIdConversations.add(log.request_id);
          }

          // 4.2. 初始化 conversation 数据（如果还没有）
          if (!conversationMap.has(log.request_id)) {
            conversationMap.set(log.request_id, {
              conversation_id: log.request_id,
              messages: new Map(), // 使用 Map 存储 message_key -> message_data
            });
          }

          const conv = conversationMap.get(log.request_id);

          // 4.3. 从 request_payload.messages 提取历史消息（优先）
          if (log.request_payload?.messages && Array.isArray(log.request_payload.messages)) {
            for (const msg of log.request_payload.messages) {
              // 跳过 system 消息（不需要存储）
              if (msg.role === 'system' || !msg.content) continue;

              // 创建消息的唯一标识（用于去重）
              const msgKey = `${msg.role}:${msg.content.substring(0, 100)}`;

              if (!conv.messages.has(msgKey)) {
                conv.messages.set(msgKey, {
                  conversation_id: log.request_id,
                  role: msg.role,
                  content: msg.content,
                  ui_state: msg.ui_state || log.request_payload?.ui_state || null,
                  created_at: msg.created_at || log.created_at,
                  metadata: null,
                });
                totalMessagesProcessed++;
              }
            }
          }

          // 4.4. 从 user_query 和 response_metadata.reply 提取当前消息（补充）
          // 只有当消息不在 request_payload.messages 中时才添加
          if (log.user_query && log.user_query !== 'Start the session.') {
            const msgKey = `user:${log.user_query.substring(0, 100)}`;
            if (!conv.messages.has(msgKey)) {
              conv.messages.set(msgKey, {
                conversation_id: log.request_id,
                role: 'user',
                content: log.user_query,
                ui_state: log.request_payload?.ui_state || null,
                created_at: log.created_at,
                metadata: null,
              });
              totalMessagesProcessed++;
            }
          }

          if (log.response_metadata?.reply) {
            const msgKey = `assistant:${log.response_metadata.reply.substring(0, 100)}`;
            if (!conv.messages.has(msgKey)) {
              conv.messages.set(msgKey, {
                conversation_id: log.request_id,
                role: 'assistant',
                content: log.response_metadata.reply,
                ui_state: null,
                created_at: log.created_at,
                metadata: null,
              });
              totalMessagesProcessed++;
            }
          }
        } catch (error) {
          console.error(`  ❌ 处理 log ${log.id} 失败:`, error.message);
          errorCount++;
        }
      }

      // 4.5. 批量插入 messages（每处理一批 logs 后）
      if (conversationMap.size > 0) {
        const inserted = await insertMessagesBatch(conversationMap);
        totalMessagesInserted += inserted;
        
        // 记录已处理的 conversation 数量
        const processedConvsCount = conversationMap.size;
        
        conversationMap.clear(); // 清空，准备下一批
        
        console.log(`  ✅ 批次 ${batchNum} 完成，处理了 ${processedConvsCount} 个 conversations，已处理 ${totalMessagesProcessed} 条消息，已插入 ${totalMessagesInserted} 条\n`);
      }
    }

    // 5. 插入剩余的 messages（最后一批）
    if (conversationMap.size > 0) {
      const inserted = await insertMessagesBatch(conversationMap);
      totalMessagesInserted += inserted;
      console.log(`  ✅ 最后一批完成，插入 ${inserted} 条消息\n`);
    }

    // 6. 验证结果
    const { count: finalMsgCount } = await supabase
      .from('ai_messages')
      .select('*', { count: 'exact', head: true });

    // 统计处理的 conversation 数量
    const { count: totalConvsCount } = await supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true });

    console.log('\n' + '='.repeat(60));
    console.log('📊 迁移完成统计：');
    console.log('='.repeat(60));
    console.log(`✅ 处理的 logs: ${logs.length} 条`);
    console.log(`✅ 处理的 conversations: ${totalConvsCount || 0} 个`);
    console.log(`✅ 处理的 messages: ${totalMessagesProcessed} 条`);
    console.log(`✅ 插入的 messages: ${totalMessagesInserted} 条`);
    console.log(`⚠️  跳过的 conversations: ${skippedConversations} 个`);
    console.log(`❌ 错误数量: ${errorCount} 个`);
    console.log(`📈 最终 messages 总数: ${finalMsgCount || 0} 条`);
    if (nullContentIdConversations.size > 0) {
      console.log(`⚠️  NULL content_id 的 conversations: ${nullContentIdConversations.size} 个`);
      console.log(`   Conversation IDs: ${Array.from(nullContentIdConversations).slice(0, 10).join(', ')}${nullContentIdConversations.size > 10 ? '...' : ''}`);
      console.log(`   ℹ️  这些 conversations 的 content 可能已被删除，但消息仍会被迁移`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  }
}

/**
 * 批量插入 messages
 * @param {Map} conversationMap - conversation_id -> { conversation_id, messages: Map }
 * @returns {Promise<number>} 插入的消息数量
 */
async function insertMessagesBatch(conversationMap) {
  const messagesToInsert = [];

  // 收集所有要插入的消息
  for (const [conversationId, conv] of conversationMap) {
    for (const [msgKey, msg] of conv.messages) {
      messagesToInsert.push(msg);
    }
  }

  if (messagesToInsert.length === 0) {
    return 0;
  }

  let insertedCount = 0;
  let skippedCount = 0;

  // 分批插入（避免一次性插入太多）
  for (let i = 0; i < messagesToInsert.length; i += MESSAGE_BATCH_SIZE) {
    const batch = messagesToInsert.slice(i, i + MESSAGE_BATCH_SIZE);
    const batchNum = Math.floor(i / MESSAGE_BATCH_SIZE) + 1;

    try {
      // 检查哪些消息已存在（避免重复插入）
      const conversationIds = [...new Set(batch.map(m => m.conversation_id))];
      
      if (conversationIds.length > 0) {
        const { data: existingMessages, error: checkError } = await supabase
          .from('ai_messages')
          .select('conversation_id, role, content')
          .in('conversation_id', conversationIds);

        if (checkError) {
          console.warn(`  ⚠️  检查已存在消息失败:`, checkError.message);
        }

        // 创建已存在消息的 key 集合
        const existingKeys = new Set(
          (existingMessages || []).map(m => {
            const content = m.content || '';
            return `${m.conversation_id}:${m.role}:${content.substring(0, 100)}`;
          })
        );

        // 过滤出需要插入的消息
        const newMessages = batch.filter(msg => {
          const msgKey = `${msg.conversation_id}:${msg.role}:${msg.content?.substring(0, 100)}`;
          if (existingKeys.has(msgKey)) {
            skippedCount++;
            return false;
          }
          return true;
        });

        if (newMessages.length > 0) {
          const { error: insertError } = await supabase
            .from('ai_messages')
            .insert(newMessages);

          if (insertError) {
            // 如果是重复键错误，忽略；其他错误尝试逐条插入
            if (insertError.code === '23505') {
              // 主键冲突，说明消息已存在，跳过
              skippedCount += newMessages.length;
            } else {
              console.error(`  ⚠️  批量插入失败 (批次 ${batchNum}):`, insertError.message);
              // 尝试逐条插入（降级处理）
              for (const msg of newMessages) {
                try {
                  const { error: singleError } = await supabase
                    .from('ai_messages')
                    .insert(msg);

                  if (singleError) {
                    if (singleError.code === '23505') {
                      skippedCount++;
                    } else {
                      console.error(`  ⚠️  插入单条消息失败:`, singleError.message);
                    }
                  } else {
                    insertedCount++;
                  }
                } catch (singleError) {
                  console.error(`  ⚠️  插入消息异常:`, singleError.message);
                }
              }
            }
          } else {
            insertedCount += newMessages.length;
          }
        }
      }
    } catch (error) {
      console.error(`  ⚠️  批量插入异常 (批次 ${batchNum}):`, error.message);
      // 尝试逐条插入（降级处理）
      for (const msg of batch) {
        try {
          const { error: singleError } = await supabase
            .from('ai_messages')
            .insert(msg);

          if (singleError) {
            if (singleError.code === '23505') {
              skippedCount++;
            } else {
              console.error(`  ⚠️  插入单条消息失败:`, singleError.message);
            }
          } else {
            insertedCount++;
          }
        } catch (singleError) {
          console.error(`  ⚠️  插入消息异常:`, singleError.message);
        }
      }
    }
  }

  if (skippedCount > 0) {
    console.log(`  ℹ️  跳过 ${skippedCount} 条已存在的消息`);
  }

  return insertedCount;
}

// 执行迁移
if (require.main === module) {
  migrateMessages()
    .then(() => {
      console.log('\n✅ 迁移完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 迁移失败:', error);
      process.exit(1);
    });
}

module.exports = { migrateMessages };
