#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
BASE_URL="http://localhost:8092/api"
TIMEOUT=10

echo -e "${CYAN}🚀 开始快速读写分离测试${NC}"
echo "=================================="

# 检查服务是否启动
echo -e "${BLUE}📡 检查服务状态...${NC}"
if ! curl -s --max-time $TIMEOUT "$BASE_URL/health/database/connections" > /dev/null; then
    echo -e "${RED}❌ 服务未启动或无法访问 $BASE_URL${NC}"
    echo -e "${YELLOW}💡 请先运行: pnpm run start:local-prod${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 服务运行中${NC}"

# 1. 基础健康检查
echo -e "\n${PURPLE}🔍 测试1: 基础健康检查${NC}"
health_response=$(curl -s --max-time $TIMEOUT "$BASE_URL/health/database")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 健康检查通过${NC}"
    echo "$health_response" | jq '.connections' 2>/dev/null || echo "$health_response"
else
    echo -e "${RED}❌ 健康检查失败${NC}"
fi

# 2. 读写分离测试
echo -e "\n${PURPLE}🔄 测试2: 读写分离验证${NC}"
split_response=$(curl -s --max-time $TIMEOUT "$BASE_URL/health/database/test-split")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 读写分离测试完成${NC}"
    
    # 检查是否使用了不同的数据库连接
    writer_url=$(echo "$split_response" | jq -r '.data.splitVerification.writerUrl' 2>/dev/null)
    reader_url=$(echo "$split_response" | jq -r '.data.splitVerification.readerUrl' 2>/dev/null)
    is_different=$(echo "$split_response" | jq -r '.data.splitVerification.isDifferent' 2>/dev/null)
    
    echo "📝 写库连接: $writer_url"
    echo "📖 读库连接: $reader_url"
    
    if [ "$is_different" = "true" ]; then
        echo -e "${GREEN}✅ 读写分离配置正确 - 使用不同的数据库连接${NC}"
    else
        echo -e "${YELLOW}⚠️  读写分离配置相同 - 可能使用同一个数据库${NC}"
    fi
    
    # 显示测试结果
    write_status=$(echo "$split_response" | jq -r '.data.writeTest.status' 2>/dev/null)
    read_status=$(echo "$split_response" | jq -r '.data.readTest.status' 2>/dev/null)
    
    if [ "$write_status" = "success" ]; then
        echo -e "${GREEN}✅ 写库测试成功${NC}"
    else
        echo -e "${RED}❌ 写库测试失败${NC}"
    fi
    
    if [ "$read_status" = "success" ]; then
        echo -e "${GREEN}✅ 读库测试成功${NC}"
    else
        echo -e "${RED}❌ 读库测试失败${NC}"
    fi
else
    echo -e "${RED}❌ 读写分离测试失败${NC}"
fi

# 3. 性能测试
echo -e "\n${PURPLE}⚡ 测试3: 性能测试${NC}"
perf_response=$(curl -s --max-time 30 "$BASE_URL/health/database/performance")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 性能测试完成${NC}"
    
    writer_avg=$(echo "$perf_response" | jq -r '.data.writerPerformance.averageTime' 2>/dev/null)
    reader_avg=$(echo "$perf_response" | jq -r '.data.readerPerformance.averageTime' 2>/dev/null)
    
    echo "📊 写库平均响应时间: ${writer_avg}ms"
    echo "📊 读库平均响应时间: ${reader_avg}ms"
    
    # 比较性能
    if [ "$writer_avg" != "null" ] && [ "$reader_avg" != "null" ]; then
        performance_diff=$(echo "$writer_avg - $reader_avg" | bc 2>/dev/null || echo "无法计算")
        echo "📈 性能差异: ${performance_diff}ms"
    fi
else
    echo -e "${RED}❌ 性能测试失败${NC}"
fi

# 4. 实际CRUD测试
echo -e "\n${PURPLE}🧪 测试4: 实际CRUD操作${NC}"

# 创建测试数据
test_data='{"agentName":"TestAgent_QuickTest","agentAddress":"http://test.com","description":"Quick test agent","authorBio":"Test Author","agentClassification":"Test","tags":["test"],"isPrivate":false,"autoAcceptJobs":true,"contractType":"result","walletAddress":"0x1234567890123456789012345678901234567890"}'

echo "📝 创建测试Agent..."
create_response=$(curl -s --max-time $TIMEOUT -X POST \
    -H "Content-Type: application/json" \
    -d "$test_data" \
    "$BASE_URL/agents")

if [ $? -eq 0 ]; then
    agent_id=$(echo "$create_response" | jq -r '.data.id' 2>/dev/null)
    if [ "$agent_id" != "null" ] && [ -n "$agent_id" ]; then
        echo -e "${GREEN}✅ Agent创建成功, ID: $agent_id${NC}"
        
        # 读取测试
        echo "📖 读取Agent..."
        read_response=$(curl -s --max-time $TIMEOUT "$BASE_URL/agents/$agent_id")
        if [ $? -eq 0 ]; then
            agent_name=$(echo "$read_response" | jq -r '.data.agentName' 2>/dev/null)
            if [ "$agent_name" = "TestAgent_QuickTest" ]; then
                echo -e "${GREEN}✅ Agent读取成功${NC}"
            else
                echo -e "${YELLOW}⚠️  Agent读取结果异常${NC}"
            fi
        else
            echo -e "${RED}❌ Agent读取失败${NC}"
        fi
        
        # 清理测试数据
        echo "🧹 清理测试数据..."
        delete_response=$(curl -s --max-time $TIMEOUT -X DELETE "$BASE_URL/agents/$agent_id")
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 测试数据清理完成${NC}"
        else
            echo -e "${YELLOW}⚠️  测试数据清理失败，请手动删除 Agent ID: $agent_id${NC}"
        fi
    else
        echo -e "${RED}❌ Agent创建失败 - 无效的ID${NC}"
    fi
else
    echo -e "${RED}❌ Agent创建失败${NC}"
fi

echo -e "\n${CYAN}📊 快速测试完成！${NC}"
echo "=================================="

# 运行详细测试提示
echo -e "\n${BLUE}💡 要运行更详细的测试，请执行:${NC}"
echo "node scripts/test-read-write-split.js"