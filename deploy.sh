#!/bin/bash

# ==============================================================================
# eduNest 统一运维与部署自动化脚本
# 支持 Docker Compose 一键启动、Vercel 云端部署以及 Node.js 原生部署
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}   🎓 eduNest AI 互动教育平台 — 快速部署助手   ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# 检查环境变量文件
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        echo -e "${YELLOW}⚠️ 未找到 .env 文件，正在从 env.example 自动创建...${NC}"
        cp env.example .env
        echo -e "${GREEN}✅ 已生成 .env 文件，请根据需要修改其中的密钥配置。${NC}"
    else
        echo -e "${RED}❌ 错误: 未找到 .env 或 env.example 文件！${NC}"
        exit 1
    fi
fi

echo "请选择您的部署或启动方式:"
echo "  [1] 🐳 Docker Compose 一键全栈容器化部署 (推荐)"
echo "  [2] ⚡ 本地 Node.js 源码全栈启动 (开发/测试)"
echo "  [3] 🚀 部署前端至 Vercel"
echo "  [4] 🛑 停止并清理 Docker 容器"
echo ""

read -p "请输入选项 [1-4] (默认 1): " choice
choice=${choice:-1}

case $choice in
    1)
        echo -e "${BLUE}🐳 正在通过 Docker Compose 构建并启动容器...${NC}"
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}❌ 未检测到 Docker，请先安装 Docker: https://docs.docker.com/get-docker/${NC}"
            exit 1
        fi
        docker compose up -d --build
        echo ""
        echo -e "${GREEN}======================================================${NC}"
        echo -e "${GREEN}🎉 eduNest 全栈服务已成功启动！${NC}"
        echo -e "  🌐 前端 Web 平台: ${BLUE}http://localhost:3000${NC}"
        echo -e "  🔌 后端 API 网关: ${BLUE}http://localhost:3001/api${NC}"
        echo -e "  🩺 健康检查接口: ${BLUE}http://localhost:3001/api/health${NC}"
        echo -e "${GREEN}======================================================${NC}"
        ;;
    2)
        echo -e "${BLUE}⚡ 正在安装依赖并启动本地全栈开发服务...${NC}"
        npm install
        npm run dev
        ;;
    3)
        echo -e "${BLUE}🚀 准备部署前端至 Vercel...${NC}"
        if ! command -v vercel &> /dev/null; then
            echo -e "${YELLOW}⚠️ 未检测到 Vercel CLI，正在全局安装...${NC}"
            npm install -g vercel
        fi
        cd frontend
        npm install
        npm run build
        vercel --prod
        cd ..
        echo -e "${GREEN}✅ Vercel 部署流程完成！${NC}"
        ;;
    4)
        echo -e "${YELLOW}🛑 正在停止并移除 eduNest 容器...${NC}"
        docker compose down
        echo -e "${GREEN}✅ 容器已成功停止并清理。${NC}"
        ;;
    *)
        echo -e "${RED}❌ 无效选项，操作已取消。${NC}"
        exit 1
        ;;
esac