#!/bin/bash

# AI 互动教育平台 - 数据库初始化脚本

echo "🗄️  初始化数据库..."

# 检查环境配置
if [ ! -f ".env" ]; then
    echo "❌ 错误: 请先配置 .env 文件"
    echo "运行: cp env.example .env 然后编辑配置"
    exit 1
fi

# 加载环境变量
source .env

# 检查 Supabase 配置
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ 错误: 请在 .env 文件中配置 Supabase 连接信息"
    echo "需要配置:"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_KEY"
    exit 1
fi

echo "📋 检查数据库表结构..."

# 检查是否安装了 psql
if ! command -v psql &> /dev/null; then
    echo "⚠️  警告: 未找到 psql 命令"
    echo "请安装 PostgreSQL 客户端工具"
    echo "macOS: brew install postgresql"
    echo "Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# 运行数据库初始化脚本
echo "🔧 执行数据库初始化脚本..."
if [ -f "supabase-setup.sql" ]; then
    echo "使用本地 supabase-setup.sql 文件"
    psql "$SUPABASE_URL" -f supabase-setup.sql
else
    echo "使用后端目录的 supabase-setup.sql 文件"
    psql "$SUPABASE_URL" -f backend/supabase-setup.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ 数据库初始化成功!"
    echo ""
    echo "📊 数据库表已创建:"
    echo "  - users (用户表)"
    echo "  - contents (内容表)"
    echo "  - user_collections (用户收藏表)"
    echo "  - content_ratings (内容评分表)"
    echo ""
    echo "🔑 默认管理员账号:"
    echo "  邮箱: admin@example.com"
    echo "  密码: admin123"
    echo ""
    echo "🎉 数据库初始化完成，可以启动应用了!"
else
    echo "❌ 数据库初始化失败"
    echo "请检查 Supabase 连接配置和网络连接"
    exit 1
fi 