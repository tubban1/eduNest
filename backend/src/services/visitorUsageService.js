/**
 * 游客使用记录服务
 * 管理游客的免费试用状态
 */

const DatabaseService = require('./database');
const { isValidVisitorId } = require('../utils/visitorId');

/**
 * 获取或创建游客使用记录
 * @param {string} visitorId - Visitor ID
 * @returns {Promise<Object>} 游客使用记录
 */
const getOrCreateVisitorUsage = async (visitorId) => {
  if (!isValidVisitorId(visitorId)) {
    throw new Error('无效的 visitor_id 格式');
  }

  // 先尝试查询现有记录
  const { data, error } = await DatabaseService.supabase
    .from('visitor_usage')
    .select('*')
    .eq('visitor_id', visitorId)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // 记录不存在，尝试创建新记录
    // 不设置过期时间（expires_at 为 null）
    const { data: newRecord, error: createError } = await DatabaseService.supabase
      .from('visitor_usage')
      .insert({
        visitor_id: visitorId,
        content_generated: false,
        ai_guide_used: false,
        expires_at: null // 不设置过期时间
      })
      .select()
      .single();
    
    // 如果插入失败是因为重复键（并发请求已创建），重新查询
    if (createError && createError.code === '23505') {
      // 重复键错误，说明记录已被其他并发请求创建，重新查询
      const { data: existingRecord, error: queryError } = await DatabaseService.supabase
        .from('visitor_usage')
        .select('*')
        .eq('visitor_id', visitorId)
        .single();
      
      if (queryError) throw queryError;
      return existingRecord;
    }
    
    if (createError) throw createError;
    return newRecord;
  }
  
  if (error) throw error;
  return data;
};

/**
 * 检查是否可以生成内容
 * @param {string} visitorId - Visitor ID
 * @returns {Promise<boolean>} 是否可以生成内容
 */
const canGenerateContent = async (visitorId) => {
  const usage = await getOrCreateVisitorUsage(visitorId);
  return !usage.content_generated;
};

/**
 * 标记内容已生成
 * @param {string} visitorId - Visitor ID
 */
const markContentGenerated = async (visitorId) => {
  const { error } = await DatabaseService.supabase
    .from('visitor_usage')
    .update({ 
      content_generated: true,
      updated_at: new Date().toISOString()
    })
    .eq('visitor_id', visitorId);
  
  if (error) throw error;
};

/**
 * 检查是否可以使用 AI Guide
 * @param {string} visitorId - Visitor ID
 * @returns {Promise<boolean>} 是否可以使用 AI Guide
 */
const canUseAiGuide = async (visitorId) => {
  const usage = await getOrCreateVisitorUsage(visitorId);
  return !usage.ai_guide_used;
};

/**
 * 标记 AI Guide 已使用
 * @param {string} visitorId - Visitor ID
 */
const markAiGuideUsed = async (visitorId) => {
  const { error } = await DatabaseService.supabase
    .from('visitor_usage')
    .update({ 
      ai_guide_used: true,
      updated_at: new Date().toISOString()
    })
    .eq('visitor_id', visitorId);
  
  if (error) throw error;
};

/**
 * 获取游客使用状态
 * @param {string} visitorId - Visitor ID
 * @returns {Promise<Object>} 使用状态
 */
const getVisitorUsageStatus = async (visitorId) => {
  const usage = await getOrCreateVisitorUsage(visitorId);
  return {
    content_generated: usage.content_generated || false,
    ai_guide_used: usage.ai_guide_used || false
  };
};

/**
 * 合并游客数据到用户账号
 * @param {string} visitorId - Visitor ID
 * @param {string} userId - 真实的 User ID
 * @returns {Promise<Object>} 合并结果
 */
const mergeVisitorDataToUser = async (visitorId, userId) => {
  // 验证 visitorId 格式
  if (!isValidVisitorId(visitorId)) {
    throw new Error('无效的 visitor_id 格式');
  }

  // 先查询要合并的数据数量（用于返回统计）
  const { count: contentCount } = await DatabaseService.supabase
    .from('content')
    .select('id', { count: 'exact', head: true })
    .eq('visitor_id', visitorId);
  
  const { count: logsCount } = await DatabaseService.supabase
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('visitor_id', visitorId);
  
  // 更新 content 表：将 visitor_id 替换为真实的 user_id
  // 将 visitor_id 字段设置为 NULL，created_by 设置为真实的 user_id
  const { error: contentError } = await DatabaseService.supabase
    .from('content')
    .update({ 
      created_by: userId,
      visitor_id: null // 清除 visitor_id
    })
    .eq('visitor_id', visitorId);
  
  // 更新 ai_usage_logs 表：将 visitor_id 替换为真实的 user_id
  const { error: logsError } = await DatabaseService.supabase
    .from('ai_usage_logs')
    .update({ 
      user_id: userId,
      visitor_id: null
    })
    .eq('visitor_id', visitorId);
  
  if (contentError || logsError) {
    throw new Error('合并游客数据失败');
  }

  // 将 visitor_init_context 并入 user_init_context，并同步 context.role 到 users.role
  try {
    const { data: visitorContextRow } = await DatabaseService.supabase
      .from('visitor_init_context')
      .select('id, context')
      .eq('visitor_id', visitorId)
      .maybeSingle();

    if (visitorContextRow && visitorContextRow.context && typeof visitorContextRow.context === 'object') {
      const ctx = visitorContextRow.context;
      const allowedRoles = ['student', 'parent', 'teacher'];
      const role = ctx.role && allowedRoles.includes(ctx.role) ? ctx.role : null;

      await DatabaseService.supabase
        .from('user_init_context')
        .upsert({
          user_id: userId,
          context: ctx,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (role) {
        await DatabaseService.supabase
          .from('users')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', userId);
      }

      await DatabaseService.supabase
        .from('visitor_init_context')
        .delete()
        .eq('visitor_id', visitorId);
    }
  } catch (initCtxErr) {
    // 表不存在或合并失败不影响 content/logs 合并结果，仅记录
    const logger = require('../utils/logger');
    logger.warn('合并 visitor_init_context 到 user 失败（已忽略）', { visitorId, userId, error: initCtxErr?.message });
  }

  return { 
    success: true,
    contentCount: contentCount || 0,
    conversationCount: logsCount || 0
  };
};

module.exports = {
  getOrCreateVisitorUsage,
  canGenerateContent,
  markContentGenerated,
  canUseAiGuide,
  markAiGuideUsed,
  getVisitorUsageStatus,
  mergeVisitorDataToUser
};

