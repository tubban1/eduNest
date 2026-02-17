/**
 * Onboarding 上下文：登录用户写入 user_init_context，访客写入 visitor_init_context（注册后由 merge-on-login 合并到 user）
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validateVisitorId } = require('../middleware/visitorId');
const { supabase } = require('../services/database');
const logger = require('../utils/logger');

const allowedRoles = ['student', 'parent', 'teacher'];

function validateContext(context) {
  if (!context || typeof context !== 'object') return { ok: false, message: '请提供 context 对象' };
  if (!context.region || !Array.isArray(context.subjects)) return { ok: false, message: 'context 需包含 region 和 subjects 数组' };
  if (!context.role || !allowedRoles.includes(context.role)) return { ok: false, message: 'context.role 需为 student / parent / teacher 之一' };
  return { ok: true };
}

/** 访客仅保存 role 时：不要求 region，subjects 可为空数组 */
function validateVisitorContext(context) {
  if (!context || typeof context !== 'object') return { ok: false, message: '请提供 context 对象' };
  if (!context.role || !allowedRoles.includes(context.role)) return { ok: false, message: 'context.role 需为 student / parent / teacher 之一' };
  if (!Array.isArray(context.subjects)) return { ok: false, message: 'context.subjects 需为数组' };
  return { ok: true };
}

/** 登录用户：保存到 user_init_context */
router.post('/context', authenticateToken, async (req, res) => {
  try {
    const { context } = req.body || {};
    const userId = req.user.id;
    const valid = validateContext(context);
    if (!valid.ok) {
      return res.status(400).json({ success: false, error: 'INVALID_CONTEXT', message: valid.message });
    }
    const { data, error } = await supabase
      .from('user_init_context')
      .upsert({
        user_id: userId,
        context,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('id, user_id, context, updated_at')
      .single();
    if (error) {
      logger.error('保存 user_init_context 失败', { userId, error });
      return res.status(500).json({ success: false, error: 'SAVE_FAILED', message: error.message || '保存失败' });
    }
    return res.json({ success: true, data: { id: data.id, user_id: data.user_id, context: data.context, updated_at: data.updated_at } });
  } catch (err) {
    logger.error('onboard/context 异常', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message || '服务器错误' });
  }
});

/** 访客：保存到 visitor_init_context（注册后 merge-on-login 会并入 user_init_context 并写入 user.role）。不要求 region，仅 role + subjects 即可。 */
router.post('/visitor-context', validateVisitorId, async (req, res) => {
  try {
    const { context } = req.body || {};
    const visitorId = req.visitorId;
    const valid = validateVisitorContext(context);
    if (!valid.ok) {
      return res.status(400).json({ success: false, error: 'INVALID_CONTEXT', message: valid.message });
    }
    const { data, error } = await supabase
      .from('visitor_init_context')
      .upsert({
        visitor_id: visitorId,
        context,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'visitor_id' })
      .select('id, visitor_id, context, updated_at')
      .single();
    if (error) {
      logger.error('保存 visitor_init_context 失败', { visitorId, error });
      return res.status(500).json({ success: false, error: 'SAVE_FAILED', message: error.message || '保存失败' });
    }
    return res.json({ success: true, data: { id: data.id, visitor_id: data.visitor_id, context: data.context, updated_at: data.updated_at } });
  } catch (err) {
    logger.error('onboard/visitor-context 异常', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message || '服务器错误' });
  }
});

module.exports = router;
