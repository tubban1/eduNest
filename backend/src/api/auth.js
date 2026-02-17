const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const DatabaseService = require('../services/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { supabase } = require('../services/database');

const router = express.Router();

// 调试接口 - 检查用户数据
router.get('/debug/users', async (req, res) => {
  try {
    const userResult = await DatabaseService.getUserByEmail('admin@example.com');
    res.json({
      success: true,
      data: {
        userResult,
        hasData: !!userResult.data,
        userData: userResult.data,
        hasPassword: userResult.data ? !!userResult.data.password : false
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supabase登录
router.post('/login', [
  body('email').isEmail().withMessage('邮箱格式不正确'),
  body('password').isLength({ min: 6 }).withMessage('密码长度不能少于6位'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: '参数验证失败', 
        details: errors.array() 
      });
    }

    const { email, password } = req.body;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.status(401).json({ 
          success: false, 
          message: '登录失败: ' + error.message 
        });
      }

      const userInfo = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
        role: 'user'
      };

      res.json({
        success: true,
        data: {
          user: userInfo,
          token: data.session.access_token
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: '登录失败: ' + error.message 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '服务器错误: ' + error.message 
    });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: '未登录',
        message: '请先登录' 
      });
    }

    const jwt = require('jsonwebtoken');
    const config = require('../config');

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const userId = decoded.userId;
      
      // 从数据库获取用户信息
      const { data: userInfo, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        return res.status(500).json({ 
          success: false, 
          message: '获取用户信息失败' 
        });
      }
      
      return res.json({
        success: true,
        data: userInfo
      });
      
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        message: '验证令牌失败' 
      });
    }
  } catch (error) {
    console.error('验证令牌失败:', error);
    res.status(500).json({ 
      error: '服务器错误',
      message: '验证用户身份失败' 
    });
  }
});

// 刷新令牌
router.post('/refresh', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: '令牌缺失',
        message: '请提供访问令牌' 
      });
    }

    const jwt = require('jsonwebtoken');
    const config = require('../config');

    jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ 
          error: '令牌无效',
          message: '请重新登录' 
        });
      }

      try {
        const userResult = await DatabaseService.getUserById(decoded.userId);
        if (!userResult.data) {
          return res.status(404).json({ 
            error: '用户不存在',
            message: '用户账户已被删除' 
          });
        }

        // 生成新的令牌
        const newToken = generateToken(userResult.data.id);

        res.json({
          success: true,
          data: {
            token: newToken
          }
        });
      } catch (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});

// 注册接口
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: '邮箱和密码不能为空' });
  }
  try {
    // 使用 Supabase Admin API 创建用户
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.json({ success: true, data: data.user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 登录日志记录端点（用于前端发送登录相关日志）
router.post('/log', async (req, res) => {
  try {
    const { level, message, data, timestamp } = req.body;
    
    // 验证必需字段
    if (!level || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'level 和 message 字段是必需的' 
      });
    }

    // 构建日志对象
    const logData = {
      message: `[Auth Callback] ${message}`,
      ...(data && { data }),
      ...(timestamp && { clientTimestamp: timestamp }),
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
    };

    // 根据日志级别记录
    switch (level.toLowerCase()) {
      case 'error':
        logger.error(logData);
        break;
      case 'warn':
        logger.warn(logData);
        break;
      case 'info':
        logger.info(logData);
        break;
      case 'debug':
        logger.debug(logData);
        break;
      default:
        logger.info(logData);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('记录登录日志失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '记录日志失败' 
    });
  }
});

/**
 * 更新当前登录用户的角色（student / parent / teacher）
 * PATCH /api/auth/me/role
 * 需要 Supabase 访问令牌（使用 authenticateToken 中间件）
 */
router.patch('/me/role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.body || {};

    // 基本校验
    const allowedRoles = ['student', 'parent', 'teacher'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ROLE',
        message: 'role 必须是 student / parent / teacher 之一'
      });
    }

    // 管理员角色不允许通过此接口修改
    if (req.user && req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '管理员角色不能通过此接口修改'
      });
    }

    const userId = req.user.id;

    // 更新 Supabase users 表中的 role 字段
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      logger.error('更新用户角色失败:', { userId, role, error });
      return res.status(500).json({
        success: false,
        error: 'UPDATE_ROLE_FAILED',
        message: error.message || '更新用户角色失败'
      });
    }

    return res.json({
      success: true,
      data: {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role
      }
    });
  } catch (error) {
    logger.error('PATCH /auth/me/role 失败:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

module.exports = router; 