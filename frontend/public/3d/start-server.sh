#!/bin/bash

# 手势粒子页面 - 快速启动 HTTP 服务器

echo "🚀 启动 HTTP 服务器..."
echo ""

# 检查 Python 3
if command -v python3 &> /dev/null; then
    echo "✅ 使用 Python 3 启动服务器"
    echo "📱 访问地址: http://localhost:8000/3d/gesture-particles.html"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    cd "$(dirname "$0")/.."
    python3 -m http.server 8000
# 检查 Python 2
elif command -v python &> /dev/null; then
    echo "✅ 使用 Python 2 启动服务器"
    echo "📱 访问地址: http://localhost:8000/3d/gesture-particles.html"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    cd "$(dirname "$0")/.."
    python -m SimpleHTTPServer 8000
# 检查 Node.js http-server
elif command -v http-server &> /dev/null; then
    echo "✅ 使用 http-server 启动"
    echo "📱 访问地址: http://localhost:8000/3d/gesture-particles.html"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    cd "$(dirname "$0")/.."
    http-server -p 8000
# 检查 npx
elif command -v npx &> /dev/null; then
    echo "✅ 使用 npx http-server 启动"
    echo "📱 访问地址: http://localhost:8000/3d/gesture-particles.html"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    cd "$(dirname "$0")/.."
    npx http-server -p 8000
else
    echo "❌ 错误: 未找到可用的服务器工具"
    echo ""
    echo "请安装以下任一工具："
    echo "  - Python 3: https://www.python.org/"
    echo "  - Node.js + http-server: npm install -g http-server"
    echo ""
    echo "或手动运行："
    echo "  python3 -m http.server 8000"
    echo "  或"
    echo "  npx http-server -p 8000"
    exit 1
fi

