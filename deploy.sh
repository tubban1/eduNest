#!/bin/bash

# AI 互动教育平台 - 部署脚本
# 用于部署到 Vercel

set -e

echo "🚀 开始部署 AI 互动教育平台..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ 未安装 Vercel CLI，请先安装：npm i -g vercel"
    exit 1
fi

# 检查环境变量
if [ ! -f ".env" ]; then
    echo "❌ 未找到 .env 文件，请先配置环境变量"
    exit 1
fi

echo "✅ 环境变量检查通过"

# 构建前端
echo "🔨 构建前端..."
cd frontend
npm install
npm run build
cd ..

echo "✅ 前端构建完成"

# 部署到 Vercel
echo "🚀 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo "🌐 访问地址: https://your-project.vercel.app" 