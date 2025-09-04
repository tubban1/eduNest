const jwt = require('jsonwebtoken');
const config = require('../config');
const DatabaseService = require('../services/database');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { supabase } = require('../services/database');

// Supabase JWT 验证函数
const verifySupabaseToken = async (token) => {
  try {
    // 解码JWT token（不验证签名和过期时间，因为我们需要处理Google OAuth token）
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      throw new Error('无效的token格式');
    }
    
        // 从token中获取用户信息（支持多种格式）
    let userId = decoded.sub || decoded.userId; // 支持Supabase和Google OAuth格式
    const email = decoded.email;
    const username = decoded.username;
    
    if (!userId) {
      throw new Error('token中缺少用户ID');
    }
    
    // 如果用户ID不是UUID格式，尝试通过username查找用户或创建新用户
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      if (username) {
        // 直接查找users表
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .eq('name', username)
          .limit(1);
        
        if (users && users.length > 0) {
          return users[0];
        } else {
          // 创建新用户
          const { v4: uuidv4 } = require('uuid');
          const newUserId = uuidv4();
          
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              id: newUserId, // 明确提供UUID
              email: email || `${username}@example.com`,
              name: username,
              role: decoded.role || 'user'
            })
            .select()
            .single();
          
          if (createError) {
            console.error('创建用户失败:', createError);
            throw new Error('无法创建用户');
          }
          
          return newUser;
        }
        } else {
          throw new Error('token中缺少username信息');
        }
    } else {
      // 用户ID是UUID格式，直接查询
      const userResult = await DatabaseService.getUserById(userId);
      
      if (!userResult.data) {
        throw new Error('用户不存在');
      }
      
      return userResult.data;
    }
  } catch (error) {
    logger.error('Supabase token验证失败:', error);
    throw error;
  }
};

// JWT 认证中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: '访问令牌缺失',
        message: '请提供有效的访问令牌' 
      });
    }

    try {
      // 验证Supabase token并获取用户信息
      const user = await verifySupabaseToken(token);
      
      // 设置用户信息到请求对象
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user'
      };
      
      logger.info('用户认证成功:', { userId: user.id, email: user.email });
      next();
    } catch (tokenError) {
      logger.error('Token验证失败:', tokenError);
      return res.status(401).json({ 
        error: '无效的访问令牌',
        message: '请重新登录' 
      });
    }
  } catch (error) {
    logger.error('认证中间件错误:', error);
    next(new AppError('认证失败', 500));
  }
};

// 可选认证中间件（不强制要求登录）
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // 没有令牌，继续执行但不设置用户信息
      return next();
    }

    jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
      if (err) {
        // 令牌无效，继续执行但不设置用户信息
        return next();
      }

      try {
        const userResult = await DatabaseService.getUserById(decoded.userId);
        if (userResult.data) {
          req.user = userResult.data;
        }
        next();
      } catch (error) {
        // 用户验证失败，继续执行但不设置用户信息
        logger.warn('可选认证失败:', error.message);
        next();
      }
    });
  } catch (error) {
    logger.error('可选认证中间件错误:', error);
    next();
  }
};

// 管理员权限检查
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: '需要登录',
      message: '请先登录' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: '权限不足',
      message: '需要管理员权限' 
    });
  }

  next();
};

// 生成JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.JWT_SECRET, { 
    expiresIn: config.JWT_EXPIRES_IN 
  });
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  generateToken
}; 