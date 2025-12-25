/**
 * Visitor ID 格式工具
 * 用于生成、验证和处理 Visitor ID
 */

const { v4: uuidv4 } = require('uuid');

/**
 * 生成 Visitor ID（前端使用）
 * @returns {string} visitor-{uuid} 格式的 ID
 */
const generateVisitorId = () => {
  return `visitor-${uuidv4()}`;
};

/**
 * 验证 Visitor ID 格式
 * @param {string} visitorId - 要验证的 Visitor ID
 * @returns {boolean} 是否为有效的 Visitor ID 格式
 */
const isValidVisitorId = (visitorId) => {
  if (!visitorId || typeof visitorId !== 'string') {
    return false;
  }
  return /^visitor-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitorId);
};

/**
 * 从 user_id 中提取 visitor_id（如果是 visitor_id 格式）
 * @param {string} userId - 可能是 visitor_id 或 user_id
 * @returns {string|null} 如果是 visitor_id 格式则返回，否则返回 null
 */
const extractVisitorId = (userId) => {
  if (isValidVisitorId(userId)) {
    return userId;
  }
  return null;
};

/**
 * 判断一个 ID 是 visitor_id 还是 user_id
 * @param {string} id - 要判断的 ID
 * @returns {boolean} true 表示是 visitor_id，false 表示是 user_id
 */
const isVisitorId = (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return isValidVisitorId(id);
};

/**
 * 判断一个 ID 是 user_id 还是 visitor_id
 * @param {string} id - 要判断的 ID
 * @returns {boolean} true 表示是 user_id，false 表示是 visitor_id
 */
const isUserId = (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // user_id 通常是纯 UUID 格式（不包含 visitor- 前缀）
  // 或者 Supabase 的 user_id 格式
  return !isValidVisitorId(id);
};

module.exports = { 
  generateVisitorId, 
  isValidVisitorId, 
  extractVisitorId,
  isVisitorId,
  isUserId
};

