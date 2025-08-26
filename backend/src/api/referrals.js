const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const DatabaseService = require('../services/database');

const router = express.Router();

// 获取或生成用户推荐码（生成）
router.post('/code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: code, error } = await DatabaseService.ensureReferralCode(userId);
    if (error) throw error;
    res.json({ success: true, data: { code } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取用户现有推荐码（不生成）
router.get('/code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: code, error } = await DatabaseService.getReferralCode(userId);
    if (error) throw error;
    res.json({ success: true, data: { code } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 推荐统计
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await DatabaseService.getReferralStats(userId);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 注册成功后记录推荐与发放奖励
router.post('/reward', authenticateToken, async (req, res) => {
  try {
    const inviteeId = req.user.id;
    const { code } = req.body || {};
    if (!code) {
      // 没有邀请码，仅发放新用户初始积分
      await DatabaseService.addCreditChange(inviteeId, 'initial', 3);
      return res.json({ success: true, data: { invited: false, initialGranted: true } });
    }

    // 防止重复记录
    const { data: already } = await DatabaseService.hasReferralForInvitee(inviteeId);
    if (already) {
      return res.json({ success: true, data: { invited: true, duplicate: true } });
    }

    // 找邀请人
    const { data: inviter } = await DatabaseService.getUserByReferralCode(String(code).toUpperCase());
    if (!inviter) {
      // 邀请码无效，仅发放新用户初始积分
      await DatabaseService.addCreditChange(inviteeId, 'initial', 3);
      return res.json({ success: true, data: { invited: false, initialGranted: true } });
    }

    // 记录关系
    await DatabaseService.createReferralLog(inviter.id, inviteeId, code, 'success');

    // 发放奖励：新用户+3，邀请人+3
    await DatabaseService.addCreditChange(inviteeId, 'initial', 3);
    await DatabaseService.addCreditChange(inviter.id, 'referral', 3, inviteeId);

    // 里程碑：每满5人+10
    const { data: count } = await DatabaseService.countSuccessfulReferrals(inviter.id);
    if (count % 5 === 0) {
      await DatabaseService.addCreditChange(inviter.id, 'milestone', 10);
    }

    res.json({ success: true, data: { invited: true, inviter_id: inviter.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

// 验证推荐码（注册前检查）
router.post('/validate', async (req, res) => {
  try {
    const code = (req.body?.code || '').toString().trim().toUpperCase();
    if (!code || code.length !== 4) {
      return res.status(400).json({ success: false, error: '无效邀请码格式' });
    }
    const { data: inviter } = await DatabaseService.getUserByReferralCode(code);
    if (!inviter) {
      return res.status(404).json({ success: false, error: '邀请码不存在' });
    }
    res.json({ success: true, data: { inviter_id: inviter.id, code } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

