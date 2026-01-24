const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const config = require('../config');

// 确保环境变量在验证之前加载 - 修复硬编码路径问题
const envPath = process.env.NODE_ENV === 'production' 
  ? undefined  // 生产环境让dotenv自动查找
  : path.resolve(__dirname, '../../.env');

if (envPath) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config(); // 生产环境自动查找
}

// Supabase 配置验证
const validateSupabaseConfig = () => {
  const requiredConfigs = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY'
  ];
  
  const missingConfigs = requiredConfigs.filter(config => 
    !process.env[config] || process.env[config] === `your_${config.toLowerCase()}`
  );
  
  if (missingConfigs.length > 0) {
    console.warn('⚠️ 缺少 Supabase 配置:', missingConfigs);
    // 缺少 Supabase 配置，在开发模式下将使用模拟数据
  }
  
  return missingConfigs.length === 0;
};

// 创建 Supabase 客户端
let supabase = null;
let useMockData = false;

try {
  const isValidConfig = validateSupabaseConfig();
  if (isValidConfig) {
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
  } else {
    useMockData = true;
  }
} catch (error) {
  console.error('❌ Supabase 客户端初始化失败:', error.message);
  useMockData = true;
}

// 模拟数据（开发模式）
const mockData = {
  users: [
    {
      id: 'mock-user-1',
      email: 'test@example.com',
      name: '测试用户',
      role: 'user'
    }
  ],
  contents: [
    {
      id: 'mock-content-1',
      short_id: 'c1234567',
      title: '示例内容',
      language_code: 'zh-CN',
      tags: ['示例'],
      knowledge_point: ['测试'],
      created_at: new Date().toISOString()
    }
  ],
  collection_lists: [
    {
      id: 'mock-list-1',
      name: '我的收藏',
      visibility: 'private',
      user_id: 'mock-user-1',
      order_index: 0
    }
  ],
  user_collections: [
    {
      id: 'mock-collection-1',
      user_id: 'mock-user-1',
      content_id: 'mock-content-1',
      list_id: 'mock-list-1',
      added_at: new Date().toISOString()
    }
  ]
};

// 内容相关方法
const getContents = async (filters = {}) => {
  try {
    let query = supabase.from('content').select('*');
    if (filters.knowledge_point) {
      query = query.contains('knowledge_point', [filters.knowledge_point]);
    }
    if (filters.language) {
      query = query.eq('language', filters.language);
    }
    if (filters.language_code) {
      query = query.eq('language_code', filters.language_code);
    }
    // 语言前缀过滤（BCP47 前缀，如 zh/en/de/fr）
    if (filters.language_prefix) {
      const prefix = String(filters.language_prefix).toLowerCase();
      query = query.ilike('language_code', `${prefix}%`);
    }
    if (filters.tag) {
      query = query.contains('tag', [filters.tag]);
    }
    if (filters.created_by) {
      // 判断是 visitor_id 还是 user_id
      const { isVisitorId } = require('../utils/visitorId');
      if (isVisitorId(filters.created_by)) {
        query = query.eq('visitor_id', filters.created_by);
      } else {
        query = query.eq('created_by', filters.created_by);
      }
    }
    
    // 添加limit和offset支持
    const limit = filters.limit ? Math.max(1, Math.min(parseInt(filters.limit, 10) || 12, 50)) : undefined;
    const offset = filters.offset ? Math.max(0, parseInt(filters.offset, 10) || 0) : undefined;
    
    if (limit !== undefined) {
      if (offset !== undefined) {
        // 使用 range 方法（包含起始和结束位置）
        query = query.range(offset, offset + limit - 1);
      } else {
        // 只有 limit，没有 offset
        query = query.limit(limit);
      }
    } else if (offset !== undefined) {
      // 只有 offset，没有 limit，使用默认 limit
      const defaultLimit = 12;
      query = query.range(offset, offset + defaultLimit - 1);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      throw error;
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 获取带有生成状态的内容列表
const getContentsWithGenerationStatus = async (filters = {}) => {
  try {
    // 首先获取内容列表
    const contentsResult = await getContents(filters);
    if (contentsResult.error) {
      return contentsResult;
    }

    const contents = contentsResult.data;
    if (!contents || contents.length === 0) {
      return { data: [], error: null };
    }

    // 获取所有内容的生成状态
    const contentIds = contents.map(c => c.id);
    
    // 查询每个内容的最新生成状态
    // 注意：应该按 updated_at 排序，而不是 created_at，因为 updated_at 更能反映记录的最新状态
    // 如果按 created_at 排序，可能会取到旧的 done 记录而不是新的 processing 记录（或反之）
    const { data: generationLogs, error: logsError } = await supabase
      .from('ai_usage_logs')
      .select('content_id, status, error_message, user_query, image_url, created_at, updated_at, is_render_success, started_at')
      .in('content_id', contentIds)
      .eq('action_type', 'generate')
      .order('updated_at', { ascending: false });

    if (logsError) {
      console.error('[getContentsWithGenerationStatus] 查询生成状态失败:', logsError);
      // 如果查询生成状态失败，返回不带状态的内容
      return { data: contents, error: null };
    }

    const statusMap = new Map();
    const retryCountMap = new Map();
    
    if (generationLogs) {
      const logsByContent = new Map();
      
      generationLogs.forEach(log => {
        if (!logsByContent.has(log.content_id)) {
          logsByContent.set(log.content_id, []);
        }
        logsByContent.get(log.content_id).push(log);
        
        const count = retryCountMap.get(log.content_id) || 0;
        retryCountMap.set(log.content_id, count + 1);
      });
      
      logsByContent.forEach((logs, contentId) => {
        const pickByPriority = (rows) => {
          const done = rows.find(r => r.status === 'done');
          if (done) return done;
          const processing = rows.find(r => r.status === 'processing');
          if (processing) return processing;
          const pending = rows.find(r => r.status === 'pending');
          if (pending) return pending;
          const failed = rows.find(r => r.status === 'failed');
          if (failed) return failed;
          return rows[0];
        };
        
        const log = pickByPriority(logs);
        let finalStatus = log.status;
        if (log.status === 'done' && log.is_render_success === false) {
          finalStatus = 'failed';
        }
        
        statusMap.set(contentId, {
          generation_status: finalStatus,
          generation_error: log.error_message || (log.status === 'done' && log.is_render_success === false ? '内容渲染失败' : null),
          generation_updated_at: log.updated_at,
          user_query: log.user_query,
          image_url: log.image_url || null,
          started_at: log.started_at,
          is_render_success: log.is_render_success // 保存渲染成功状态
        });
      });
      
      retryCountMap.forEach((count, contentId) => {
        retryCountMap.set(contentId, Math.max(0, count - 1));
      });
    }

    // 合并内容数据和生成状态
    // 注意：生成中的内容（pending, processing, failed）都应该显示，让前端显示状态卡片
    const contentsWithStatus = contents
      .map(content => {
        const status = statusMap.get(content.id);
        const retryCount = retryCountMap.get(content.id) || 0;
        
        const result = {
          ...content,
          generation_status: status?.generation_status || null,
          generation_error: status?.generation_error || null,
          retry_count: retryCount,
          generation_updated_at: status?.generation_updated_at || null,
          user_query: status?.user_query || null,
          image_url: status?.image_url || null,
          started_at: status?.started_at || null
        };
        
        return result;
      })
      .filter(content => {
        // 如果有生成记录，根据状态决定是否显示
        const status = statusMap.get(content.id);
        if (status) {
          // 生成中的状态（pending, processing, failed）都显示，让前端显示状态卡片
          if (['pending', 'processing', 'failed'].includes(status.generation_status)) {
            return true;
          }
          // done 状态：只有渲染成功的内容才显示
          if (status.generation_status === 'done') {
            return status.is_render_success === true;
          }
        }
        
        // 如果没有生成记录，只要有 full_html 就认为可以渲染（可能是手动创建的内容）
        // 注意：生成中的内容可能没有 full_html，但应该显示状态卡片
        // 所以这里不要求必须有 full_html（如果 status 存在，上面已经处理了）
        return true;
      });
    
    return { data: contentsWithStatus, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 定向按语言获取（便捷封装）
const getContentsByLanguage = async ({ language_prefix, language_code, limit } = {}) => {
  return getContents({ language_prefix, language_code, limit });
};

const getContentById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      throw error;
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getContentByShortId = async (shortId) => {
  try {
    const { data: content, error } = await supabase
      .from('content')
      .select('*')
      .eq('short_id', shortId)
      .single();
    if (error) {
      throw error;
    }

    if (!content) {
      return { data: null, error: null };
    }

    // 获取生成状态（如果有）
    // 注意：应该按 updated_at 排序，而不是 created_at，因为 updated_at 更能反映记录的最新状态
    const { data: log, error: logError } = await supabase
      .from('ai_usage_logs')
      .select('status, error_message, user_query, created_at, updated_at, is_render_success, started_at')
      .eq('content_id', content.id)
      .eq('action_type', 'generate')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!logError && log) {
      // 计算进度
      let progress = 0;
      switch (log.status) {
        case 'pending': progress = 10; break;
        case 'processing': progress = 50; break;
        case 'done': progress = 100; break;
        case 'failed': progress = 0; break;
        default: progress = 0;
      }

      // 计算重试次数（同一 content_id 的生成记录数 - 1）
      const { data: allLogs } = await supabase
        .from('ai_usage_logs')
        .select('id')
        .eq('content_id', content.id)
        .eq('action_type', 'generate');
      const retryCount = Math.max(0, (allLogs?.length || 0) - 1);

      // 如果 status 是 'done' 但 is_render_success 是 false，则应该显示为 'failed'
      let finalStatus = log.status;
      if (log.status === 'done' && log.is_render_success === false) {
        finalStatus = 'failed';
      }

      // 合并生成状态到内容对象
      content.generation_status = finalStatus;
      content.generation_progress = progress;
      content.retry_count = retryCount;
      content.generation_error = log.error_message || (log.status === 'done' && log.is_render_success === false ? '内容渲染失败' : null);
      content.generation_updated_at = log.updated_at;
      content.user_query = log.user_query;
      content.generation_started_at = log.started_at;
    }

    return { data: content, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

function generateShortId() {
  return Math.random().toString(36).slice(2, 10);
}

const createContent = async (contentData, userId) => {
  try {
    const { title, full_html, tags, description, content_type, language_code } = contentData;
    
    // 只接受 full_html，不再使用代码块字段
    if (!full_html || typeof full_html !== 'string' || full_html.trim().length === 0) {
      throw new Error('full_html 不能为空');
    }
    
    // 判断是 visitor_id 还是 user_id
    const { isVisitorId } = require('../utils/visitorId');
    const isVisitor = isVisitorId(userId);
    const actualUserId = isVisitor ? null : userId;
    const visitorId = isVisitor ? userId : null;
    
    const result = await supabase
      .from('content')
      .insert({
        title,
        full_html,
        tags: tags || [],
        description: description || '',
        content_type: content_type || 'vue',
        language_code: language_code || 'zh-CN',
        created_by: actualUserId, // 如果是 visitor_id，则设置为 NULL
        visitor_id: visitorId, // 如果是 visitor_id，则存储在这里
        short_id: generateShortId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (result.error) {
      throw result.error;
    }
    return result.data;
  } catch (error) {
    throw error;
  }
};

// ===== Credits & Referrals & Subscriptions =====
const getCreditsBalance = async (userId) => {
  try {
    if (useMockData || !supabase) {
      // 开发/无配置环境下返回0，避免抛错
      return { data: 0, error: null };
    }
    const { data, error } = await supabase
      .from('user_credits')
      .select('change_amount')
      .eq('user_id', userId);
    if (error) throw error;
    const balance = (data || []).reduce((sum, r) => sum + (r.change_amount || 0), 0);
    return { data: balance, error: null };
  } catch (error) {
    return { data: 0, error };
  }
};

const getCreditsHistory = async (userId, limit = 50, offset = 0) => {
  try {
    if (useMockData || !supabase) {
      return { data: [], error: null };
    }
    const { data, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

/**
 * 检查用户是否已有初始积分记录
 */
const hasInitialCredits = async (userId) => {
  try {
    if (useMockData || !supabase) {
      return { data: false, error: null };
    }
    // 直接查询是否存在 initial 类型的记录
    const { data, error } = await supabase
      .from('user_credits')
      .select('id')
      .eq('user_id', userId)
      .eq('change_type', 'initial')
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    // 如果查询到记录，说明已有初始积分
    return { data: data !== null, error: null };
  } catch (error) {
    return { data: false, error };
  }
};

const addCreditChange = async (userId, changeType, changeAmount, relatedUserId = null, relatedContentId = null) => {
  try {
    if (useMockData || !supabase) {
      // 在无配置环境下直接返回成功，便于开发流程
      return { data: { user_id: userId, change_type: changeType, change_amount: changeAmount }, error: null };
    }
    const { data, error } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        change_type: changeType,
        change_amount: changeAmount,
        related_user_id: relatedUserId,
        related_content_id: relatedContentId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getActiveSubscription = async (userId) => {
  try {
    if (useMockData || !supabase) {
      return { data: null, error: null };
    }
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// ===== Referrals =====
const generateReferralCode = () => {
  // 4位短码，字母数字（碰撞概率更高，后续通过唯一性检查重试）
  return Math.random().toString(36).slice(2, 6).toUpperCase();
};

const ensureReferralCode = async (userId) => {
  try {
    if (useMockData || !supabase) {
      return { data: 'MOCKCODE', error: null };
    }
    // 查询当前用户的推荐码
    const { data: user, error: getErr } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single();
    if (getErr) throw getErr;
    if (user?.referral_code) {
      return { data: user.referral_code, error: null };
    }
    // 生成并确保唯一（4位码提高重试次数）
    let code = generateReferralCode();
    for (let i = 0; i < 20; i++) {
      const { data: exists } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle();
      if (!exists) break;
      code = generateReferralCode();
    }
    const { error: updErr } = await supabase
      .from('users')
      .update({ referral_code: code })
      .eq('id', userId);
    if (updErr) throw updErr;
    return { data: code, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getReferralStats = async (userId) => {
  try {
    if (useMockData || !supabase) {
      return { data: { invites: 0 }, error: null };
    }
    const { count, error } = await supabase
      .from('referral_logs')
      .select('id', { count: 'exact', head: true })
      .eq('inviter_id', userId)
      .eq('status', 'success');
    if (error) throw error;
    return { data: { invites: count || 0 }, error: null };
  } catch (error) {
    return { data: { invites: 0 }, error };
  }
};

const getReferralCode = async (userId) => {
  try {
    if (useMockData || !supabase) {
      return { data: null, error: null };
    }
    const { data, error } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return { data: data?.referral_code || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserByReferralCode = async (referralCode) => {
  try {
    if (useMockData || !supabase) {
      return { data: null, error: null };
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, referral_code')
      .eq('referral_code', referralCode)
      .maybeSingle();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const createReferralLog = async (inviterId, inviteeId, referralCode, status = 'success') => {
  try {
    if (useMockData || !supabase) {
      return { data: { inviter_id: inviterId, invitee_id: inviteeId, referral_code: referralCode, status }, error: null };
    }
    const { data, error } = await supabase
      .from('referral_logs')
      .insert({ inviter_id: inviterId, invitee_id: inviteeId, referral_code: referralCode, status, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const countSuccessfulReferrals = async (inviterId) => {
  try {
    if (useMockData || !supabase) {
      return { data: 0, error: null };
    }
    const { count, error } = await supabase
      .from('referral_logs')
      .select('id', { count: 'exact', head: true })
      .eq('inviter_id', inviterId)
      .eq('status', 'success');
    if (error) throw error;
    return { data: count || 0, error: null };
  } catch (error) {
    return { data: 0, error };
  }
};

const hasReferralForInvitee = async (inviteeId) => {
  try {
    if (useMockData || !supabase) {
      return { data: false, error: null };
    }
    const { count, error } = await supabase
      .from('referral_logs')
      .select('id', { count: 'exact', head: true })
      .eq('invitee_id', inviteeId)
      .eq('status', 'success');
    if (error) throw error;
    return { data: (count || 0) > 0, error: null };
  } catch (error) {
    return { data: false, error };
  }
};

// ===== 自动精选内容系统 =====

// 获取 Admin 用户 ID
const getAdminUserId = async () => {
  try {
    // 方案1: 从环境变量获取固定的 admin ID
    const adminId = process.env.ADMIN_USER_ID;
    if (adminId) return adminId;
    
    // 方案2: 从数据库查询 role='admin' 的用户
    if (useMockData || !supabase) {
      return null;
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();
    
    if (error) {
      // 如果查询失败，尝试使用环境变量中的固定 ID
      return process.env.ADMIN_USER_ID || null;
    }
    
    return data?.id || null;
  } catch (error) {
    return process.env.ADMIN_USER_ID || null;
  }
};

// 获取精选内容（自动从 admin 账号提取）
const getFeaturedContents = async (options = {}) => {
  try {
    const {
      limit = 20,
      offset = 0,
      category = null,
      sortBy = 'quality_score',
      tags = null,
      language_code = null
    } = options;
    
    const adminId = await getAdminUserId();
    if (!adminId) {
      return { data: [], error: null };
    }
    
    if (useMockData || !supabase) {
      return { data: [], error: null };
    }
    
    // 构建查询
    let query = supabase
      .from('content')
      .select('*')
      .eq('created_by', adminId)
      .eq('is_deleted', false);
    
    // 分类过滤（通过 tags）
    if (category) {
      query = query.contains('tags', [category]);
    }
    
    // 标签过滤
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => {
        query = query.contains('tags', [tag]);
      });
    }
    
    // 语言过滤
    if (language_code) {
      query = query.eq('language_code', language_code);
    }
    
    // 先获取所有匹配的内容
    const { data: allData, error: fetchError } = await query;
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!allData || allData.length === 0) {
      return { data: [], error: null };
    }
    
    // 批量获取所有内容的点赞数和收藏数（优化性能）
    const contentIds = allData.map(c => c.id);
    
    // 批量查询点赞数
    const { data: likesData } = await supabase
      .from('content_likes')
      .select('content_id')
      .in('content_id', contentIds);
    
    // 批量查询收藏数
    const { data: collectionsData } = await supabase
      .from('user_collections')
      .select('content_id')
      .in('content_id', contentIds);
    
    // 统计每个内容的点赞数和收藏数
    const likesCountMap = {};
    const collectionsCountMap = {};
    
    (likesData || []).forEach(like => {
      likesCountMap[like.content_id] = (likesCountMap[like.content_id] || 0) + 1;
    });
    
    (collectionsData || []).forEach(collection => {
      collectionsCountMap[collection.content_id] = (collectionsCountMap[collection.content_id] || 0) + 1;
    });
    
    // 计算每个内容的质量评分
    const contentsWithStats = allData.map((content) => {
      const likesCount = likesCountMap[content.id] || 0;
      const collectionsCount = collectionsCountMap[content.id] || 0;
      
      // 计算时间衰减因子
      const daysSinceCreation = (Date.now() - new Date(content.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.max(0.5, 1 - daysSinceCreation / 365); // 一年内的时间衰减
      
      // 计算质量评分
      const qualityScore = (likesCount * 2 + collectionsCount * 3) * timeDecay;
      
      return {
        ...content,
        quality_score: qualityScore,
        likes_count: likesCount,
        collections_count: collectionsCount
      };
    });
    
    // 排序
    let sortedContents = contentsWithStats;
    if (sortBy === 'quality_score') {
      sortedContents = contentsWithStats.sort((a, b) => b.quality_score - a.quality_score);
    } else if (sortBy === 'likes_count') {
      sortedContents = contentsWithStats.sort((a, b) => b.likes_count - a.likes_count);
    } else if (sortBy === 'collections_count') {
      sortedContents = contentsWithStats.sort((a, b) => b.collections_count - a.collections_count);
    } else if (sortBy === 'created_at') {
      sortedContents = contentsWithStats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    // 分页
    const paginatedContents = sortedContents.slice(offset, offset + limit);
    
    return { data: paginatedContents, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

// 获取精选内容的分类统计
const getFeaturedContentCategories = async () => {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return { data: [], error: null };
    }
    
    if (useMockData || !supabase) {
      return { data: [], error: null };
    }
    
    const { data, error } = await supabase
      .from('content')
      .select('tags')
      .eq('created_by', adminId)
      .eq('is_deleted', false);
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      return { data: [], error: null };
    }
    
    // 统计每个标签的出现次数
    const tagCounts = {};
    data.forEach(content => {
      if (content.tags && Array.isArray(content.tags)) {
        content.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    // 转换为数组并排序
    const categories = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    
    return { data: categories, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

const updateContent = async (contentId, contentData) => {
  // 只更新 full_html，不再使用代码块字段
  const updateFields = {
    updated_at: new Date().toISOString()
  };
  
  // 只更新传入的字段
  if (contentData.title !== undefined) updateFields.title = contentData.title;
  if (contentData.full_html !== undefined) {
    if (typeof contentData.full_html !== 'string' || contentData.full_html.trim().length === 0) {
      throw new Error('full_html 不能为空');
    }
    updateFields.full_html = contentData.full_html;
  }
  if (contentData.tags !== undefined) updateFields.tags = contentData.tags;
  if (contentData.knowledge_points !== undefined) updateFields.knowledge_points = contentData.knowledge_points;
  if (contentData.description !== undefined) updateFields.description = contentData.description;
  if (contentData.content_type !== undefined) updateFields.content_type = contentData.content_type;
  if (contentData.language_code !== undefined) updateFields.language_code = contentData.language_code;

  const result = await supabase
    .from('content')
    .update(updateFields)
    .eq('id', contentId)
    .select()
    .single();

  if (result.error) {
    // 内容更新失败
    return { success: false, error: result.error };
  }
  return result.data;
};

const deleteContent = async (id) => {
  try {
    const { error } = await supabase
      .from('content')
      .delete()
      .eq('id', id);
      
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

// 用户相关方法
const getUserByEmail = async (email) => {
  try {
    // 使用 Supabase Auth 的 admin API 获取用户
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      throw error;
    }
    
    // 查找匹配的用户
    const user = data.users.find(u => u.email === email);
    return { data: user, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserById = async (id) => {
  try {
    // 从users表中查询用户信息
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getAllUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const createUser = async (userData) => {
  try {
    // 使用 Supabase Auth 创建用户
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true
    });
    
    if (error) {
      throw error;
    }
    
    return { data: data.user, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 收藏相关方法
const getUserCollections = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_collections')
      .select(`
        *,
        content (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const addToCollection = async (userId, contentId) => {
  try {
    const { data, error } = await supabase
      .from('user_collections')
      .insert({
        user_id: userId,
        content_id: contentId
      })
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const removeFromCollection = async (userId, contentId) => {
  try {
    const { error } = await supabase
      .from('user_collections')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId);
      
    if (error) {
      throw error;
    }
    
    return { error: null };
  } catch (error) {
    return { error };
  }
};

// 评分相关方法
const getContentRatings = async (contentId) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const addRating = async (ratingData) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .insert(ratingData)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getRatingStats = async (contentId) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('content_id', contentId);
      
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      return { data: { average: 0, count: 0 }, error: null };
    }
    
    const ratings = data.map(r => r.rating);
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    
    return { 
      data: { 
        average: Math.round(average * 10) / 10, 
        count: ratings.length 
      }, 
      error: null 
    };
  } catch (error) {
    return { data: null, error };
  }
};

// 新增：创建收藏夹
const createCollectionList = async ({ name, visibility = 'private', user_id, order_index = 0 }) => {
  try {
    const now = new Date().toISOString();
    const dataToInsert = {
      name: name.trim(),
      visibility,
      user_id,
      parent_id: null, // 所有列表都是顶级
      order_index,
      created_at: now,
      updated_at: now,
    };
    
    const { data, error } = await supabase
      .from('collection_lists')
      .insert(dataToInsert)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 获取用户所有收藏夹
const getCollectionListsByUser = async (user_id) => {
  try {
    const { data, error } = await supabase
      .from('collection_lists')
      .select('*')
      .eq('user_id', user_id)
      .is('parent_id', null) // 只获取顶级列表
      .order('order_index', { ascending: true });
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 批量更新收藏夹顺序和嵌套
const updateCollectionListOrder = async (orders = []) => {
  try {
    const SPARSE_INTERVAL = 10;
    const MIN_INTERVAL = 0.1;
    
    // 检查是否需要重新排序
    const needsReorder = (siblings) => {
      const indexes = siblings.map(s => s.order_index || 0).sort((a, b) => a - b);
      for (let i = 1; i < indexes.length; i++) {
        if (indexes[i] - indexes[i - 1] < MIN_INTERVAL) {
          return true;
        }
      }
      return false;
    };
    
    // 标准化order_index
    const normalizeOrderIndexes = (siblings) => {
      const sorted = siblings.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      const updates = [];
      
      for (let i = 0; i < sorted.length; i++) {
        const newIndex = (i + 1) * SPARSE_INTERVAL;
        if (newIndex !== (sorted[i].order_index || 0)) {
          updates.push({
            id: sorted[i].id,
            order_index: newIndex,
            parent_id: null // 所有列表都是顶级
          });
        }
      }
      
      return updates;
    };
    
    // 应用传入的orders
    for (const order of orders) {
      const { error } = await supabase
        .from('collection_lists')
        .update({ 
          order_index: order.order_index,
          parent_id: null // 确保所有列表都是顶级
        })
        .eq('id', order.id);
        
      if (error) {
        throw error;
      }
    }
    
    // 检查是否需要重新排序
    const { data: allLists, error: fetchError } = await supabase
      .from('collection_lists')
      .select('*')
      .is('parent_id', null);
      
    if (fetchError) {
      throw fetchError;
    }
    
    if (needsReorder(allLists)) {
      const updates = normalizeOrderIndexes(allLists);
      for (const update of updates) {
        const { error } = await supabase
          .from('collection_lists')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
          
        if (error) {
          throw error;
        }
      }
    }
    
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

// 删除收藏列表
const deleteCollectionList = async (listId, userId) => {
  try {
    // 验证列表存在且属于当前用户
    const { data: existingList, error: checkError } = await supabase
      .from('collection_lists')
      .select('*')
      .eq('id', listId)
      .eq('user_id', userId)
      .is('parent_id', null) // 只删除顶级列表
      .single();
    
    if (checkError || !existingList) {
      throw new Error('列表不存在或无权限删除');
    }
    
    // 删除列表
    const { error: deleteError } = await supabase
      .from('collection_lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', userId);
    
    if (deleteError) {
      throw deleteError;
    }
    
    return { success: true, deleted: listId };
    
  } catch (error) {
    return { success: false, error };
  }
};

const addContentToList = async (userId, contentId, listId) => {
  try {
    // 检查是否已经存在
    const { data: existing, error: checkError } = await supabase
      .from('user_collections')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('list_id', listId)
      .single();
    
    if (existing) {
      return { data: existing, error: null }; // 已经存在，直接返回
    }
    
    const now = new Date().toISOString();
    const dataToInsert = {
      user_id: userId,
      content_id: contentId,
      list_id: listId,
      added_at: now
    };
    
    const { data, error } = await supabase
      .from('user_collections')
      .insert(dataToInsert)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const removeContentFromList = async (userId, contentId, listId) => {
  try {
    const { error } = await supabase
      .from('user_collections')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('list_id', listId);
      
    if (error) {
      throw error;
    }
    
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

const getContentCollections = async (userId, contentId) => {
  try {
    const { data, error } = await supabase
      .from('user_collections')
      .select(`
        *,
        collection_lists (
          id,
          name,
          visibility
        )
      `)
      .eq('user_id', userId)
      .eq('content_id', contentId);
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserCollectionGroups = async (userId) => {
  try {
    // 从 collection_lists 表获取用户的所有收藏列表
    const { data: lists, error: listsError } = await supabase
      .from('collection_lists')
      .select('*')
      .eq('user_id', userId)
      .is('parent_id', null) // 只获取顶级列表
      .order('order_index', { ascending: true });
      
    if (listsError) {
      throw listsError;
    }
    
    // 获取每个列表中的内容数量
    const groups = [];
    for (const list of lists) {
      const { count, error: countError } = await supabase
        .from('user_collections')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', list.id);
      
      if (countError) {
        // 获取列表内容数量失败
        list.contentCount = 0;
      } else {
        list.contentCount = count || 0;
      }
      
      groups.push({
        id: list.id,
        name: list.name,
        count: list.contentCount
      });
    }
    
    // 获取总收藏数量
    let totalCount = 0;
    const { error: totalError } = await supabase
      .from('user_collections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (totalError) {
      // 获取总收藏数量失败
      totalCount = 0;
    }
    
    // 添加"全部收藏"分组
    groups.unshift({
      id: 'all',
      name: '全部收藏',
      count: totalCount || 0
    });
    
    return { data: groups, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserCollectionsByGroup = async (userId, groupId) => {
  try {
    let query = supabase
      .from('user_collections')
      .select(`
        id,
        added_at,
        list_id,
        content_id,
        collection_lists (
          id,
          name,
          visibility
        ),
        content (
          id,
          short_id,
          title,
          language_code,
          tags,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('added_at', { ascending: false });
    
    // 如果不是"全部收藏"，则按列表过滤
    if (groupId !== 'all') {
      query = query.eq('list_id', groupId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // 去重：按content_id分组，保留最新的收藏记录
    const contentMap = new Map();
    data.forEach(item => {
      const contentId = item.content_id;
      if (!contentMap.has(contentId) || 
          new Date(item.added_at) > new Date(contentMap.get(contentId).added_at)) {
        contentMap.set(contentId, item);
      }
    });
    
    // 获取所有内容的喜欢状态
    const contentIds = Array.from(contentMap.keys());
    const { data: likesData, error: likesError } = await supabase
      .from('content_likes')
      .select('content_id')
      .eq('user_id', userId)
      .in('content_id', contentIds);
    
    const likedContentIds = new Set();
    if (!likesError && likesData) {
      likesData.forEach(like => likedContentIds.add(like.content_id));
    }
    
    // 转换数据格式并去重
    const transformedData = Array.from(contentMap.values()).map(item => ({
      id: item.id,
      content: item.content,
      added_at: item.added_at,
      list_id: item.list_id,
      list_name: item.collection_lists?.name || '未命名列表',
      is_liked: likedContentIds.has(item.content_id)
    }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const getUserLikedCollections = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('content_likes')
      .select(`
        id,
        liked_at,
        content_id,
        content (
          id,
          short_id,
          title,
          language_code,
          tags,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('liked_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // 转换数据格式
    const transformedData = data.map(item => ({
      id: item.id,
      content: {
        ...item.content,
        tags: item.content.tags || [] // 使用 tags 字段
      },
      added_at: item.liked_at,
      is_liked: true
    }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * 根据 short_id 获取 collection_list 及其内容
 * @param {string} shortId - collection_list 的 short_id
 * @param {string} userId - 当前用户ID（可选）
 * @returns {Promise<{data: object, error: Error}>}
 */
const getCollectionListByShortId = async (shortId, userId = null) => {
  try {
    // 1. 查询 collection_list
    const { data: list, error: listError } = await supabase
      .from('collection_lists')
      .select('*')
      .eq('short_id', shortId)
      .single();
    
    if (listError || !list) {
      return { data: null, error: new Error('列表不存在') };
    }
    
    // 2. 权限检查
    const isOwner = userId && list.user_id === userId;
    const isPrivate = list.visibility === 'private';
    
    // private 列表：仅创建者可访问
    if (isPrivate && !isOwner) {
      return { data: null, error: new Error('无权限访问此列表') };
    }
    
    // 3. 获取用户订阅和购买状态（如果已登录）
    let isPlatformPremium = false;
    let hasPurchasedList = false;
    
    if (userId) {
      // 3.1 检查平台订阅状态
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .in('plan', ['lite', 'pro'])
        .gt('current_period_end', new Date().toISOString())
        .single();
      
      isPlatformPremium = !!subscription;
      
      // 3.2 检查是否已购买该列表（仅当 pricing_mode = 'premium' 时）
      if (list.pricing_mode === 'premium') {
        const { data: purchase } = await supabase
          .from('list_purchases')
          .select('id, expires_at')
          .eq('user_id', userId)
          .eq('list_id', list.id)
          .eq('payment_status', 'success')
          .single();
        
        if (purchase) {
          // 检查是否过期（如果设置了有效期）
          if (!purchase.expires_at || new Date(purchase.expires_at) > new Date()) {
            hasPurchasedList = true;
          }
        }
      }
    }
    
    // 4. 判断访问权限
    const FREE_PREVIEW_COUNT = 3;  // 免费预览数量
    
    // 访问权限逻辑：
    // - 创建者：始终可访问全部
    // - 免费列表（pricing_mode = 'free'）：所有人可访问全部
    // - 付费列表（pricing_mode = 'premium'）：已购买或平台订阅用户可访问全部，其他用户只能看前3条
    // - 预览列表（pricing_mode = 'free_preview'）：平台订阅用户可访问全部，其他用户只能看前3条
    const canAccessAll = isOwner || 
                        (list.pricing_mode === 'free') ||
                        (list.pricing_mode === 'premium' && (hasPurchasedList || isPlatformPremium)) ||
                        (list.pricing_mode === 'free_preview' && isPlatformPremium);
    
    // 5. 获取列表内容
    const { data: collections, error: collectionsError } = await supabase
      .from('user_collections')
      .select(`
        id,
        added_at,
        content_id,
        content:content_id (
          id,
          short_id,
          title,
          description,
          tags,
          language_code,
          created_at
        )
      `)
      .eq('list_id', list.id)
      .order('added_at', { ascending: false });
    
    if (collectionsError) {
      throw collectionsError;
    }
    
    // 6. 处理内容访问权限
    const processedContents = (collections || []).map((item, index) => {
      const isFreePreview = index < FREE_PREVIEW_COUNT;
      
      // 判断是否需要付费：
      // - 免费列表：不需要付费
      // - 付费/预览列表：前3条免费，其余需付费
      const requiresPayment = list.pricing_mode !== 'free' && !isFreePreview;
      const isAccessible = canAccessAll || isFreePreview;
      
      return {
        ...item,
        index,
        is_accessible: isAccessible,
        requires_payment: requiresPayment,
        is_free_preview: isFreePreview
      };
    });
    
    // 7. 统计信息
    let freeCount = 0;
    let premiumCount = 0;
    
    if (list.pricing_mode === 'free') {
      // 免费列表：全部免费
      freeCount = processedContents.length;
      premiumCount = 0;
    } else {
      // 付费/预览列表：前3条免费，其余付费
      freeCount = Math.min(FREE_PREVIEW_COUNT, processedContents.length);
      premiumCount = Math.max(0, processedContents.length - FREE_PREVIEW_COUNT);
    }
    
    // 8. 格式化价格
    const formattedPrice = list.price 
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: list.currency || 'USD'
        }).format(list.price)
      : null;
    
    return {
      data: {
        list,
        contents: processedContents,
        total: processedContents.length,
        free_count: freeCount,
        premium_count: premiumCount,
        user_access: {
          is_owner: isOwner,
          is_platform_premium: isPlatformPremium,
          has_purchased_list: hasPurchasedList,
          can_access_all: canAccessAll
        },
        pricing: {
          mode: list.pricing_mode || 'free',
          price: list.price,
          currency: list.currency || 'USD',
          formatted_price: formattedPrice
        }
      },
      error: null
    };
  } catch (error) {
    return { data: null, error };
  }
};

// 获取指定收藏列表的公开内容（不需要用户认证）
const getPublicCollectionListContent = async (listId, options = {}) => {
  try {
    const { limit = 50, offset = 0 } = options;
    
    // 首先检查收藏列表是否存在且为公开
    const { data: listData, error: listError } = await supabase
      .from('collection_lists')
      .select('id, name, visibility')
      .eq('id', listId)
      .single();
    
    if (listError || !listData) {
      return { data: null, error: new Error('收藏列表不存在') };
    }
    
    // 查询该列表下的所有内容
    const { data: collectionsData, error: collectionsError } = await supabase
      .from('user_collections')
      .select(`
        id,
        content_id,
        added_at,
        content (
          id,
          short_id,
          title,
          description,
          language_code,
          tags,
          content_type,
          full_html,
          created_at,
          updated_at,
          created_by
        )
      `)
      .eq('list_id', listId)
      .order('added_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (collectionsError) {
      throw collectionsError;
    }
    
    // 去重：按content_id分组，保留最新的收藏记录
    const contentMap = new Map();
    collectionsData.forEach(item => {
      const contentId = item.content_id;
      if (!contentMap.has(contentId) || 
          new Date(item.added_at) > new Date(contentMap.get(contentId).added_at)) {
        contentMap.set(contentId, item);
      }
    });
    
    // 获取内容的统计信息（点赞数、收藏数）
    const contentIds = Array.from(contentMap.keys());
    
    // 获取点赞数
    const { data: likesData } = await supabase
      .from('content_likes')
      .select('content_id')
      .in('content_id', contentIds);
    
    const likesCountMap = new Map();
    if (likesData) {
      likesData.forEach(like => {
        const count = likesCountMap.get(like.content_id) || 0;
        likesCountMap.set(like.content_id, count + 1);
      });
    }
    
    // 获取收藏数
    const { data: collectionsCountData } = await supabase
      .from('user_collections')
      .select('content_id')
      .in('content_id', contentIds);
    
    const collectionsCountMap = new Map();
    if (collectionsCountData) {
      collectionsCountData.forEach(collection => {
        const count = collectionsCountMap.get(collection.content_id) || 0;
        collectionsCountMap.set(collection.content_id, count + 1);
      });
    }
    
    // 转换数据格式
    const transformedData = Array.from(contentMap.values())
      .filter(item => item.content) // 过滤掉没有内容的数据
      .map(item => ({
        id: item.content.id,
        short_id: item.content.short_id,
        title: item.content.title,
        description: item.content.description,
        tags: item.content.tags || [],
        language_code: item.content.language_code,
        content_type: item.content.content_type,
        full_html: item.content.full_html,
        created_at: item.content.created_at,
        updated_at: item.content.updated_at,
        created_by: item.content.created_by,
        likes_count: likesCountMap.get(item.content.id) || 0,
        collections_count: collectionsCountMap.get(item.content.id) || 0,
      }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const likeContent = async (userId, contentId) => {
  try {
    
    // 检查是否已经点赞
    const { data: existing, error: checkError } = await supabase
      .from('content_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (existing) {
      return { data: existing, error: null }; // 已经点赞
    }
    
    const now = new Date().toISOString();
    const dataToInsert = {
      user_id: userId,
      content_id: contentId,
      liked_at: now
    };
    
    const { data, error } = await supabase
      .from('content_likes')
      .insert(dataToInsert)
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const unlikeContent = async (userId, contentId) => {
  try {
    
    // 先检查是否存在喜欢记录
    const { data: existingLike, error: checkError } = await supabase
      .from('content_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    if (!existingLike) {
      return { success: true, error: null };
    }
    
    const { error } = await supabase
      .from('content_likes')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId);
      
    if (error) {
      throw error;
    }
    
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

// 获取内容的喜欢状态
const getContentLikeStatus = async (userId, contentId) => {
  try {
    
    const { data, error } = await supabase
      .from('content_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    const isLiked = !!data;
    
    return { data: isLiked, error: null };
  } catch (error) {
    return { data: false, error };
  }
};

// 获取用户喜欢的所有内容
const getUserLikedContent = async (userId) => {
  try {
    
    const { data, error } = await supabase
      .from('content_likes')
      .select(`
        id,
        liked_at,
        content (
          id,
          short_id,
          title,
          language_code,
          tags,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('liked_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    const transformedData = data.map(item => ({
      id: item.id,
      content: item.content,
      liked_at: item.liked_at,
      is_liked: true
    }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// 记录AI使用日志
const logAIUsage = async (log) => {
  try {
    // 判断是 visitor_id 还是 user_id
    const { isVisitorId } = require('../utils/visitorId');
    const userId = log.user_id || null;
    const visitorId = userId && isVisitorId(userId) ? userId : null;
    const actualUserId = userId && !isVisitorId(userId) ? userId : null;

    const { data, error } = await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: actualUserId, // 如果是 visitor_id，则设置为 NULL
        visitor_id: visitorId, // 如果是 visitor_id，则存储在这里
        model_name: log.model_name || null,
        user_query: log.user_query || null,
        action_type: log.action_type || null,
        input_tokens: typeof log.input_tokens === 'number' ? log.input_tokens : 0,
        output_tokens: typeof log.output_tokens === 'number' ? log.output_tokens : 0,
        total_tokens: typeof log.total_tokens === 'number' ? log.total_tokens : 0,
        request_payload: log.request_payload || null,
        response_metadata: log.response_metadata || null,
        created_at: log.created_at ? new Date(log.created_at) : new Date(),
        is_json_valid: typeof log.is_json_valid === 'boolean' ? log.is_json_valid : false,
        is_render_success: typeof log.is_render_success === 'boolean' ? log.is_render_success : false,
        error_message: log.error_message || null,
        request_id: log.request_id || null,
        content_id: log.content_id || null,
        generation_params: log.generation_params || null,
        status: log.status || (log.is_render_success ? 'done' : (log.error_message ? 'failed' : 'pending'))
      })
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('logAIUsage error:', error);
    return { data: null, error };
  }
};

// 检查数据库状态
const checkDatabaseStatus = async () => {
  try {
    // 检查 content 表
    const { data: contentsData, error: contentsError } = await supabase
      .from('content')
      .select('id')
      .limit(1);
    
    if (contentsError) {
      return { success: false, error: contentsError.message };
    }
    
    // 检查 user_collections 表
    const { data: collectionsData, error: collectionsError } = await supabase
      .from('user_collections')
      .select('id')
      .limit(1);
    
    if (collectionsError) {
      return { success: false, error: collectionsError.message };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  supabase,
  useMockData,
  getContents,
  getContentsWithGenerationStatus,
  getContentById,
  getContentByShortId,
  createContent,
  updateContent,
  deleteContent,
  getUserByEmail,
  getUserById,
  getAllUsers,
  createUser,
  getUserCollections,
  addToCollection,
  removeFromCollection,
  getContentRatings,
  addRating,
  getRatingStats,
  createCollectionList,
  getCollectionListsByUser,
  updateCollectionListOrder,
  deleteCollectionList,
  getCollectionListByShortId,
  addContentToList,
  removeContentFromList,
  getContentCollections,
  getUserCollectionGroups,
  getUserCollectionsByGroup,
  getUserLikedCollections,
  likeContent,
  unlikeContent,
  getContentLikeStatus,
  getUserLikedContent,
  checkDatabaseStatus,
  logAIUsage,
  getPublicCollectionListContent,
  // credits & subscription
  getCreditsBalance,
  getCreditsHistory,
  hasInitialCredits,
  addCreditChange,
  getActiveSubscription,
  // referrals
  ensureReferralCode,
  getReferralStats,
  getReferralCode,
  getUserByReferralCode,
  createReferralLog,
  countSuccessfulReferrals,
  hasReferralForInvitee,
  // featured content
  getAdminUserId,
  getFeaturedContents,
  getFeaturedContentCategories
}; 
