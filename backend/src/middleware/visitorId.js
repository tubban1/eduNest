/**
 * Visitor ID 验证中间件
 * 用于验证请求中的 Visitor ID 格式
 */

const { isValidVisitorId } = require('../utils/visitorId');

/**
 * 验证 Visitor ID 中间件
 * 从请求头、请求体或查询参数中提取 visitor_id 并验证格式
 */
const validateVisitorId = (req, res, next) => {
  const visitorId = req.headers['x-visitor-id'] || req.body.visitor_id || req.query.visitor_id;
  
  if (!visitorId) {
    return res.status(400).json({
      success: false,
      error: 'VISITOR_ID_REQUIRED',
      message: '游客ID缺失'
    });
  }
  
  // 验证格式：visitor-{uuid}
  if (!isValidVisitorId(visitorId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_VISITOR_ID',
      message: '无效的游客ID格式'
    });
  }
  
  req.visitorId = visitorId;
  next();
};

module.exports = { validateVisitorId };

