/**
 * 访问密钥 API
 * 批量生成、获取、验证密钥
 */
const crypto = require('crypto');
const express = require('express');
const DatabaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

/** 生成随机密钥格式：XXXXX-XXXXX-XXXXX（大写字母+数字，排除易混淆字符） */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除 I,O,0,1
function generateKeyDisplay() {
  const seg = () => Array.from({ length: 5 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

/** 密钥哈希 */
function hashKey(plainKey) {
  const normalized = String(plainKey).trim().toUpperCase().replace(/\s/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * 验证列表创建者权限
 */
async function assertListOwner(listId, userId) {
  const { data: list, error } = await DatabaseService.supabase
    .from('collection_lists')
    .select('user_id')
    .eq('id', listId)
    .single();
  if (error || !list || list.user_id !== userId) {
    return false;
  }
  return true;
}

/**
 * POST /api/collection_lists/:listId/access-keys/batch
 * 批量生成密钥（仅列表创建者）
 */
router.post('/batch', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.listId || req.params.id;
    const { channel_name, count = 1, max_devices = 3 } = req.body;

    if (!listId) {
      return res.status(400).json({ error: '列表ID不能为空' });
    }
    const cnt = Math.min(Math.max(parseInt(count, 10) || 1, 1), 100);
    const maxDev = Math.min(Math.max(parseInt(max_devices, 10) || 3, 1), 10);

    const isOwner = await assertListOwner(listId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: '无权限操作此列表' });
    }

    const keys = [];
    const seenHashes = new Set();

    for (let i = 0; i < cnt; i++) {
      let keyDisplay = generateKeyDisplay();
      let keyHash = hashKey(keyDisplay);
      let attempts = 0;
      while (seenHashes.has(keyHash) && attempts < 50) {
        keyDisplay = generateKeyDisplay();
        keyHash = hashKey(keyDisplay);
        attempts++;
      }
      seenHashes.add(keyHash);

      const insert = {
        key_hash: keyHash,
        key_display: keyDisplay,
        list_id: listId,
        max_devices: maxDev,
        status: 'active',
        created_by: req.user.id,
      };
      if (channel_name != null && String(channel_name).trim()) {
        insert.channel_name = String(channel_name).trim();
      }

      const { data: row, error } = await DatabaseService.supabase
        .from('access_keys')
        .insert(insert)
        .select('id, key_display, channel_name, max_devices, created_at')
        .single();

      if (error) throw error;
      keys.push(row);
    }

    res.json({ success: true, keys });
  } catch (error) {
    console.error('批量生成密钥失败:', error);
    res.status(500).json({ error: error.message || '生成失败' });
  }
});

/**
 * GET /api/collection_lists/:listId/access-keys
 * 获取密钥列表（仅列表创建者）
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.listId || req.params.id;
    if (!listId) {
      return res.status(400).json({ error: '列表ID不能为空' });
    }

    const isOwner = await assertListOwner(listId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: '无权限查看此列表的密钥' });
    }

    const { data: rows, error } = await DatabaseService.supabase
      .from('access_keys')
      .select('id, key_display, channel_name, max_devices, status, created_at')
      .eq('list_id', listId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const keysWithCount = await Promise.all(
      (rows || []).map(async (k) => {
        const { count } = await DatabaseService.supabase
          .from('access_key_devices')
          .select('*', { count: 'exact', head: true })
          .eq('access_key_id', k.id);
        return { ...k, bound_device_count: count ?? 0 };
      })
    );

    res.json({ success: true, keys: keysWithCount });
  } catch (error) {
    console.error('获取密钥列表失败:', error);
    res.status(500).json({ error: error.message || '获取失败' });
  }
});

/**
 * POST /api/collection_lists/:listId/access-keys/validate
 * 验证并绑定密钥（公开接口，未登录亦可）
 */
router.post('/validate', async (req, res) => {
  try {
    const listId = req.params.listId || req.params.id;
    const { key, device_id } = req.body;

    if (!listId || !key || !device_id) {
      return res.status(400).json({ success: false, error: '缺少 key 或 device_id' });
    }

    const keyHash = hashKey(key);

    const { data: ak, error: akError } = await DatabaseService.supabase
      .from('access_keys')
      .select('id, list_id, max_devices, status')
      .eq('key_hash', keyHash)
      .eq('list_id', listId)
      .single();

    if (akError || !ak) {
      return res.json({ success: false, error: '密钥无效或不属于此列表' });
    }
    if (ak.status !== 'active') {
      return res.json({ success: false, error: '密钥已失效' });
    }

    const { count } = await DatabaseService.supabase
      .from('access_key_devices')
      .select('*', { count: 'exact', head: true })
      .eq('access_key_id', ak.id);

    if ((count ?? 0) >= ak.max_devices) {
      return res.json({ success: false, error: '该密钥已达到最大设备数量' });
    }

    const { error: insertError } = await DatabaseService.supabase
      .from('access_key_devices')
      .insert({
        access_key_id: ak.id,
        device_id: String(device_id).trim(),
        user_id: req.user?.id || null,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return res.json({ success: true, can_access_all: true }); // 已绑定过，视为成功
      }
      throw insertError;
    }

    res.json({ success: true, can_access_all: true });
  } catch (error) {
    console.error('验证密钥失败:', error);
    res.status(500).json({ success: false, error: error.message || '验证失败' });
  }
});

module.exports = router;
