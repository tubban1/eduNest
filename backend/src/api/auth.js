const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const DatabaseService = require('../services/database');
const { generateToken } = require('../middleware/auth');
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

    jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ 
          error: '令牌无效',
          message: '请重新登录' 
        });
      }

      try {
        console.log('🔍 获取用户信息:', decoded.userId);
        
        // 从数据库获取用户信息
        const userResult = await DatabaseService.getUserById(decoded.userId);
        
        if (!userResult.data) {
          return res.status(404).json({ 
            error: '用户不存在',
            message: '用户账户已被删除' 
          });
        }
        
        const userInfo = {
          id: userResult.data.id,
          email: userResult.data.email,
          name: userResult.data.name || userResult.data.email?.split('@')[0] || '用户',
          role: userResult.data.role || 'user'
        };
        
        console.log('✅ 获取用户信息成功:', userInfo.email);
        
        res.json({
          success: true,
          data: userInfo
        });
      } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ 
          error: '服务器错误',
          message: '获取用户信息失败' 
        });
      }
    });
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

module.exports = router; 