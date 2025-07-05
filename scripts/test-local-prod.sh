#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 本地生产环境读写分离测试${NC}"
echo "=========================================="

# 检查依赖
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ 需要安装 jq 工具${NC}"
    echo -e "${YELLOW}💡 安装命令: brew install jq${NC}"
    exit 1
fi

# 停止现有进程
echo -e "${BLUE}🛑 停止现有进程...${NC}"
pkill -f "nest start" 2>/dev/null || true
sleep 2

# 构建项目
echo -e "${BLUE}🔨 构建项目...${NC}"
if ! npm run build; then
    echo -e "${RED}❌ 项目构建失败${NC}"
    exit 1
fi

# 启动本地生产环境
echo -e "${BLUE}🚀 启动本地生产环境...${NC}"
npm run start:local-prod &
APP_PID=$!

# 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8092/api/health/database/connections > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 服务启动成功${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ 服务启动超时${NC}"
        kill $APP_PID 2>/dev/null
        exit 1
    fi
    sleep 2
    echo -n "."
done

echo ""
echo -e "${CYAN}📋 服务信息:${NC}"
echo "- 🌐 URL: http://localhost:8092"
echo "- 🔍 健康检查: http://localhost:8092/api/health/database"
echo "- 📊 读写分离测试: http://localhost:8092/api/health/database/test-split"

# 运行快速测试
echo -e "\n${BLUE}🧪 运行快速测试...${NC}"
./scripts/quick-test.sh

# 提供交互选项
echo -e "\n${CYAN}🎯 接下来你可以:${NC}"
echo "1. 运行详细测试: node scripts/test-read-write-split.js"
echo "2. 查看健康状态: curl http://localhost:8092/api/health/database | jq"
echo "3. 测试读写分离: curl http://localhost:8092/api/health/database/test-split | jq"
echo "4. 性能测试: curl http://localhost:8092/api/health/database/performance | jq"

echo -e "\n${YELLOW}⚠️  按 Ctrl+C 停止服务${NC}"

# 等待用户中断
trap "echo -e '\n${BLUE}🛑 停止服务...${NC}'; kill $APP_PID 2>/dev/null; exit 0" INT

# 保持脚本运行
wait $APP_PID