#!/bin/bash

# AI 互动教育平台 - 统一启动脚本

echo "🚀 启动 AI 互动教育平台..."

# 检查环境配置文件
if [ ! -f ".env" ]; then
    echo "❌ 错误: 未找到 .env 文件"
    echo "请复制 doc/env.example 为 .env 并配置必要的环境变量"
    echo ""
    echo "📝 需要配置的项:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_KEY" 
    echo "   - SUPABASE_ANON_KEY"
    echo "   - JWT_SECRET"
    echo "   - OPENAI_API_KEY"
    echo ""
    echo "详细配置说明请参考: doc/ENVIRONMENT_SETUP.md"
    exit 1
fi

# 检查后端依赖
if [ ! -d "backend/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd backend && npm install && cd ..
fi

# 检查前端依赖
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd frontend && npm install && cd ..
fi

# 启动后端服务
echo "🔧 启动后端服务 (端口 3001)..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ 后端服务启动成功"
else
    echo "❌ 后端服务启动失败"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 启动前端服务
echo "🎨 启动前端服务 (端口 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# 等待前端启动
sleep 5

# 检查前端是否启动成功
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务启动成功"
else
    echo "❌ 前端服务启动失败"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 AI 互动教育平台启动完成!"
echo ""
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端地址: http://localhost:3001"
echo "📊 Admin 后台: http://localhost:3000/admin/login"
echo ""
echo "测试账号:"
echo "  邮箱: admin@example.com"
echo "  密码: admin123"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

wait 