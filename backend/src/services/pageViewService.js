/**
 * 页面访问统计服务
 * 处理页面访问记录、防刷检测、积分发放
 */

const DatabaseService = require('./database');
const logger = require('../utils/logger');

/**
 * 获取客户端 IP 地址
 * @param {Object} req - Express request 对象
 * @returns {string} IP 地址
 */
const getClientIp = (req) => {
  // 优先从 X-Forwarded-For 获取（代理环境）
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // 回退到 connection.remoteAddress
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

/**
 * 检查 24 小时内是否已访问过（防刷检测）
 * @param {string} contentId - 内容 ID
 * @param {string} viewerIp - 访问者 IP
 * @returns {Promise<boolean>} 是否为唯一访问（24小时内首次）
 */
const isUniqueView = async (contentId, viewerIp) => {
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data, error } = await DatabaseService.supabase
      .from('page_views')
      .select('id')
      .eq('content_id', contentId)
      .eq('viewer_ip', viewerIp)
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .limit(1);

    if (error) {
      logger.error('检查唯一访问失败:', error);
      // 出错时返回 false，避免重复发放积分
      return false;
    }

    // 如果没有记录，说明是唯一访问
    return !data || data.length === 0;
  } catch (error) {
    logger.error('检查唯一访问异常:', error);
    return false;
  }
};

/**
 * 记录页面访问
 * @param {Object} params - 访问参数
 * @param {string} params.contentId - 内容 ID
 * @param {string} params.viewerIp - 访问者 IP
 * @param {string} params.viewerUserAgent - 访问者 User Agent
 * @param {string} params.referer - 来源页面
 * @param {string} params.viewerUserId - 访问者用户 ID（可选）
 * @returns {Promise<Object>} 访问记录
 */
const recordPageView = async ({ contentId, viewerIp, viewerUserAgent, referer, viewerUserId = null }) => {
  try {
    // 检查是否为唯一访问（24小时内首次）
    const isUnique = await isUniqueView(contentId, viewerIp);

    // 插入访问记录
    const { data, error } = await DatabaseService.supabase
      .from('page_views')
      .insert({
        content_id: contentId,
        viewer_ip: viewerIp,
        viewer_user_agent: viewerUserAgent || null,
        referer: referer || null,
        is_unique: isUnique,
        credits_awarded: false, // 初始为 false，后续由积分发放逻辑更新
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('记录页面访问失败:', error);
      throw error;
    }

    return {
      success: true,
      data: {
        ...data,
        is_unique: isUnique
      }
    };
  } catch (error) {
    logger.error('记录页面访问异常:', error);
    throw error;
  }
};

/**
 * 发放页面点击积分（如果符合条件）
 * @param {string} contentId - 内容 ID
 * @param {string} pageViewId - 页面访问记录 ID
 * @returns {Promise<Object>} 发放结果
 */
const awardCreditsForPageView = async (contentId, pageViewId) => {
  try {
    // 1. 获取访问记录
    const { data: pageView, error: viewError } = await DatabaseService.supabase
      .from('page_views')
      .select('*')
      .eq('id', pageViewId)
      .single();

    if (viewError || !pageView) {
      throw new Error('访问记录不存在');
    }

    // 2. 检查是否已发放积分
    if (pageView.credits_awarded) {
      return {
        success: true,
        awarded: false,
        reason: 'already_awarded'
      };
    }

    // 3. 检查是否为唯一访问
    if (!pageView.is_unique) {
      return {
        success: true,
        awarded: false,
        reason: 'not_unique'
      };
    }

    // 4. 获取内容创建者
    const { data: content, error: contentError } = await DatabaseService.supabase
      .from('content')
      .select('created_by')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new Error('内容不存在');
    }

    // 5. 如果没有创建者（游客创建的内容），不发放积分
    if (!content.created_by) {
      return {
        success: true,
        awarded: false,
        reason: 'no_creator'
      };
    }

    // 6. 检查创建者是否有 Pro 订阅（Pro 用户不需要积分，但可以记录访问）
    const { data: subscription } = await DatabaseService.getActiveSubscription(content.created_by);
    if (subscription && subscription.plan === 'pro') {
      // Pro 用户不需要积分，但标记为已发放（避免重复检查）
      await DatabaseService.supabase
        .from('page_views')
        .update({ credits_awarded: true })
        .eq('id', pageViewId);

      return {
        success: true,
        awarded: false,
        reason: 'pro_subscription'
      };
    }

    // 7. 发放积分（+1）
    // 注意：addCreditChange 方法签名是 (userId, changeType, changeAmount, relatedUserId)
    // 当前版本不支持 related_content_id，后续可以扩展
    const { error: creditError } = await DatabaseService.addCreditChange(
      content.created_by,
      'page_view',
      1,
      null // related_user_id（页面点击奖励不需要关联用户）
    );

    if (creditError) {
      logger.error('发放积分失败:', creditError);
      throw creditError;
    }

    // 8. 标记积分已发放
    await DatabaseService.supabase
      .from('page_views')
      .update({ credits_awarded: true })
      .eq('id', pageViewId);

    logger.info(`页面点击积分发放成功: content_id=${contentId}, user_id=${content.created_by}`);

    return {
      success: true,
      awarded: true,
      credits: 1
    };
  } catch (error) {
    logger.error('发放页面点击积分异常:', error);
    throw error;
  }
};

/**
 * 获取内容访问统计
 * @param {string} contentId - 内容 ID
 * @param {Object} options - 查询选项
 * @param {number} options.days - 统计天数（默认 30 天）
 * @returns {Promise<Object>} 统计数据
 */
const getContentStats = async (contentId, options = {}) => {
  try {
    const { days = 30 } = options;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 总访问量
    const { count: totalViews, error: totalError } = await DatabaseService.supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId)
      .gte('created_at', startDate.toISOString());

    if (totalError) throw totalError;

    // 唯一访问量
    const { count: uniqueViews, error: uniqueError } = await DatabaseService.supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId)
      .eq('is_unique', true)
      .gte('created_at', startDate.toISOString());

    if (uniqueError) throw uniqueError;

    // 来源分析
    const { data: sources, error: sourcesError } = await DatabaseService.supabase
      .from('page_views')
      .select('referer')
      .eq('content_id', contentId)
      .gte('created_at', startDate.toISOString());

    if (sourcesError) throw sourcesError;

    // 处理来源统计
    const sourceStats = {};
    sources.forEach(item => {
      const referer = item.referer || '';
      let source = '直接访问';
      
      if (referer) {
        if (referer.includes('google')) source = 'Google';
        else if (referer.includes('baidu')) source = '百度';
        else if (referer.includes('zhihu')) source = '知乎';
        else if (referer.includes('xiaohongshu')) source = '小红书';
        else if (referer.includes('weibo')) source = '微博';
        else source = '其他';
      }
      
      sourceStats[source] = (sourceStats[source] || 0) + 1;
    });

    // 设备分析
    const { data: userAgents, error: uaError } = await DatabaseService.supabase
      .from('page_views')
      .select('viewer_user_agent')
      .eq('content_id', contentId)
      .gte('created_at', startDate.toISOString());

    if (uaError) throw uaError;

    const deviceStats = {
      mobile: 0,
      desktop: 0,
      tablet: 0
    };

    userAgents.forEach(item => {
      const ua = (item.viewer_user_agent || '').toLowerCase();
      if (ua.includes('mobile')) deviceStats.mobile++;
      else if (ua.includes('tablet')) deviceStats.tablet++;
      else deviceStats.desktop++;
    });

    return {
      success: true,
      data: {
        total_views: totalViews || 0,
        unique_views: uniqueViews || 0,
        source_stats: sourceStats,
        device_stats: deviceStats,
        period_days: days
      }
    };
  } catch (error) {
    logger.error('获取内容统计失败:', error);
    throw error;
  }
};

module.exports = {
  getClientIp,
  isUniqueView,
  recordPageView,
  awardCreditsForPageView,
  getContentStats
};
