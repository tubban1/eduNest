#!/bin/bash

# 归档当前版本脚本
# 用法: bash scripts/archive-current-version.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}开始归档当前版本...${NC}\n"

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}错误: 当前目录不是 git 仓库${NC}"
    exit 1
fi

# 获取当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "当前分支: ${YELLOW}${CURRENT_BRANCH}${NC}"

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}警告: 检测到未提交的更改${NC}"
    read -p "是否先提交这些更改? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        read -p "请输入提交信息 (默认: 归档前提交): " COMMIT_MSG
        COMMIT_MSG=${COMMIT_MSG:-"归档前提交"}
        git commit -m "$COMMIT_MSG"
    else
        echo -e "${RED}请先提交或暂存更改后再执行归档${NC}"
        exit 1
    fi
fi

# 创建归档分支名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_BRANCH="archive/code-blocks-mode-${TIMESTAMP}"
ARCHIVE_TAG="archive/v1.0-code-blocks-${TIMESTAMP}"

echo -e "\n${GREEN}创建归档分支: ${ARCHIVE_BRANCH}${NC}"
git branch "$ARCHIVE_BRANCH"

echo -e "${GREEN}创建归档标签: ${ARCHIVE_TAG}${NC}"
git tag -a "$ARCHIVE_TAG" -m "归档：代码块模式版本 (code_html/css/js) - ${TIMESTAMP}"

# 显示归档信息
echo -e "\n${GREEN}归档完成！${NC}"
echo -e "归档分支: ${YELLOW}${ARCHIVE_BRANCH}${NC}"
echo -e "归档标签: ${YELLOW}${ARCHIVE_TAG}${NC}"

# 询问是否推送到远程
read -p "是否推送到远程仓库? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}推送分支到远程...${NC}"
    git push origin "$ARCHIVE_BRANCH"
    
    echo -e "${GREEN}推送标签到远程...${NC}"
    git push origin "$ARCHIVE_TAG"
    
    echo -e "\n${GREEN}归档已推送到远程仓库${NC}"
fi

echo -e "\n${GREEN}归档完成！可以开始重构了。${NC}"
echo -e "切换到重构分支: ${YELLOW}git checkout -b refactor/full-html-only${NC}"

