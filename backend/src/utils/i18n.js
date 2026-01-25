/**
 * 简单的多语言支持工具
 * 从请求头或用户信息中获取语言偏好，返回对应的翻译文本
 */

const messages = {
  'zh-CN': {
    'INSUFFICIENT_CREDITS': '积分不足',
    'INSUFFICIENT_CREDITS_MESSAGE': '积分不足，无法继续对话。请充值或升级订阅。',
    'PLEASE_LOGIN': '请登录后继续使用',
    'CONTENT_ID_REQUIRED': 'content_id is required',
    'CONVERSATION_ID_REQUIRED': 'conversation_id and message are required',
    'USER_NOT_AUTHENTICATED': 'User not authenticated'
  },
  'en-US': {
    'INSUFFICIENT_CREDITS': 'Insufficient Credits',
    'INSUFFICIENT_CREDITS_MESSAGE': 'Insufficient credits to continue the conversation. Please top up or upgrade your subscription.',
    'PLEASE_LOGIN': 'Please login to continue',
    'CONTENT_ID_REQUIRED': 'content_id is required',
    'CONVERSATION_ID_REQUIRED': 'conversation_id and message are required',
    'USER_NOT_AUTHENTICATED': 'User not authenticated'
  },
  'zh-TW': {
    'INSUFFICIENT_CREDITS': '積分不足',
    'INSUFFICIENT_CREDITS_MESSAGE': '積分不足，無法繼續對話。請充值或升級訂閱。',
    'PLEASE_LOGIN': '請登入後繼續使用',
    'CONTENT_ID_REQUIRED': 'content_id is required',
    'CONVERSATION_ID_REQUIRED': 'conversation_id and message are required',
    'USER_NOT_AUTHENTICATED': 'User not authenticated'
  }
};

/**
 * 从请求中获取语言代码
 * 优先级：1. 请求头 X-Language 或 Accept-Language 2. 用户信息 3. 默认 zh-CN
 */
const getLanguageFromRequest = (req) => {
  // 1. 检查自定义请求头
  if (req.headers['x-language']) {
    const lang = req.headers['x-language'].toLowerCase();
    if (lang.startsWith('zh')) {
      return lang.includes('tw') || lang.includes('hk') ? 'zh-TW' : 'zh-CN';
    }
    if (lang.startsWith('en')) return 'en-US';
    return 'zh-CN'; // 默认
  }

  // 2. 检查 Accept-Language 请求头
  if (req.headers['accept-language']) {
    const acceptLang = req.headers['accept-language'].toLowerCase();
    if (acceptLang.includes('zh-tw') || acceptLang.includes('zh-hk')) {
      return 'zh-TW';
    }
    if (acceptLang.includes('zh') || acceptLang.includes('zh-cn')) {
      return 'zh-CN';
    }
    if (acceptLang.includes('en')) {
      return 'en-US';
    }
  }

  // 3. 从用户信息中获取（如果存在）
  if (req.user && req.user.language_code) {
    return req.user.language_code;
  }

  // 4. 默认返回中文
  return 'zh-CN';
};

/**
 * 获取翻译文本
 * @param {Object} req - Express 请求对象
 * @param {string} key - 翻译键
 * @param {string} defaultValue - 默认值（如果找不到翻译）
 * @returns {string} 翻译后的文本
 */
const t = (req, key, defaultValue = null) => {
  const lang = getLanguageFromRequest(req);
  const langMessages = messages[lang] || messages['zh-CN'];
  return langMessages[key] || defaultValue || key;
};

module.exports = {
  getLanguageFromRequest,
  t,
  messages
};
