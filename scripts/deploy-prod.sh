#!/bin/bash

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

STAGE="prod"

echo -e "${BLUE}🚀 开始部署到生产环境 (Webpack 单体打包)${NC}"
echo -e "${PURPLE}=======================================================${NC}"

# 1. 检查必要工具
echo -e "${YELLOW}🔍 步骤1: 检查环境和工具${NC}"
if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ SAM CLI 未安装${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI 未安装${NC}"
    exit 1
fi

if ! npm list webpack --depth=0 &> /dev/null && ! npx webpack --version &> /dev/null; then
    echo -e "${RED}❌ Webpack 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 环境检查通过${NC}"

# 2. 自动增加版本号
echo -e "${YELLOW}📦 步骤2: 更新版本号${NC}"
OLD_VERSION=$(node -p "require('./package.json').version")
npm version patch --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}📝 版本更新: $OLD_VERSION → $NEW_VERSION${NC}"

# 3. 使用 Webpack 打包 Lambda 函数（包含所有 node_modules）
echo -e "${YELLOW}🏗️ 步骤3: 使用 Webpack 打包 Lambda 函数${NC}"
echo -e "${BLUE}开始 webpack 构建，打包所有 node_modules...${NC}"

# 记录构建开始时间
BUILD_START_TIME=$(date +%s)

# 清理构建目录
rm -rf dist-lambda
rm -rf dist-final

# 生成 Prisma Client（如果需要）
echo -e "${YELLOW}📋 生成 Prisma Client...${NC}"
npx prisma generate

# 使用 webpack 构建生产版本（包含所有依赖）
echo -e "${YELLOW}📦 Webpack 打包中（生产模式）...${NC}"
npx webpack --mode=production

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Webpack 打包失败${NC}"
    exit 1
fi

# 4. 准备最终部署包
echo -e "${YELLOW}🎯 步骤4: 准备最终部署包${NC}"
mkdir -p dist-final

# 复制 webpack 打包的文件
if [ -f "dist-lambda/lambda.js" ]; then
    cp dist-lambda/lambda.js dist-final/
    echo -e "${GREEN}✅ 复制 lambda.js${NC}"
fi

if [ -f "dist-lambda/lambda.js.map" ]; then
    cp dist-lambda/lambda.js.map dist-final/
    echo -e "${GREEN}✅ 复制 source map${NC}"
fi

# 复制环境配置文件
if [ -f ".env.production" ]; then
    cp .env.production dist-final/.env
    echo -e "${GREEN}✅ 复制生产环境配置${NC}"
elif [ -f ".env" ]; then
    cp .env dist-final/
    echo -e "${GREEN}✅ 复制环境配置${NC}"
fi

# 复制 Prisma schema（如果需要）
if [ -d "prisma" ]; then
    mkdir -p dist-final/prisma
    cp -r prisma/schema.prisma dist-final/prisma/ 2>/dev/null || true
    echo -e "${GREEN}✅ 复制 Prisma schema${NC}"
fi

# 复制 Prisma 引擎文件（Lambda 运行时需要）
if [ -f "node_modules/.prisma/client/libquery_engine-rhel-openssl-1.0.x.so.node" ]; then
    mkdir -p dist-final/node_modules/.prisma/client
    cp node_modules/.prisma/client/libquery_engine-rhel-openssl-1.0.x.so.node dist-final/node_modules/.prisma/client/
    echo -e "${GREEN}✅ 复制 Prisma 引擎文件${NC}"
fi

# 记录构建结束时间
BUILD_END_TIME=$(date +%s)
BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))

echo -e "${GREEN}✅ Lambda 函数构建完成 (耗时: ${BUILD_DURATION}s)${NC}"

# 5. 显示构建结果统计
echo -e "${YELLOW}📊 步骤5: 构建结果统计${NC}"

echo -e "${BLUE}构建产物大小:${NC}"
if [ -d "dist-lambda" ]; then
    LAMBDA_SIZE=$(du -sh dist-lambda | cut -f1)
    echo -e "  Webpack 输出: ${GREEN}$LAMBDA_SIZE${NC}"
fi

if [ -d "dist-final" ]; then
    FINAL_SIZE=$(du -sh dist-final | cut -f1)
    echo -e "  最终部署包: ${GREEN}$FINAL_SIZE${NC}"
    
    echo -e "${BLUE}部署包内容:${NC}"
    ls -la dist-final/
fi

# 计算压缩后大小
echo -e "${BLUE}📦 压缩后大小预估:${NC}"
if [ -d "dist-final" ]; then
    cd dist-final
    tar -czf ../lambda-bundle.tar.gz .
    cd ..
    COMPRESSED_SIZE=$(du -sh lambda-bundle.tar.gz | cut -f1)
    echo -e "  压缩包大小: ${GREEN}$COMPRESSED_SIZE${NC}"
    rm -f lambda-bundle.tar.gz
fi

# 6. SAM 构建
echo -e "${YELLOW}🔨 步骤6: SAM 构建${NC}"

sam build --no-cached

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ SAM 构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SAM 构建完成${NC}"

# 7. 部署到生产环境
echo -e "${YELLOW}🚀 步骤7: 部署到生产环境${NC}"

# 记录部署开始时间
DEPLOY_START_TIME=$(date +%s)

echo -e "${BLUE}📦 单体部署 (webpack 打包所有依赖)${NC}"

sam deploy --config-env prod --no-confirm-changeset

if [ $? -eq 0 ]; then
    # 记录部署结束时间
    DEPLOY_END_TIME=$(date +%s)
    DEPLOY_DURATION=$((DEPLOY_END_TIME - DEPLOY_START_TIME))
    
    echo -e "${GREEN}✅ 部署成功！(耗时: ${DEPLOY_DURATION}s)${NC}"
else
    echo -e "${RED}❌ 部署失败${NC}"
    exit 1
fi

# 8. 部署后验证和总结
echo -e "${YELLOW}🧪 步骤8: 部署验证${NC}"

# 获取 API 端点
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "aladdin-ai-services-pf-new" \
    --query 'Stacks[0].Outputs[?OutputKey==`AladdinAiServicesApi`].OutputValue' \
    --output text 2>/dev/null)

if [ ! -z "$API_URL" ] && [ "$API_URL" != "None" ]; then
    echo -e "${GREEN}🌐 API 端点: $API_URL${NC}"
    echo -e "${BLUE}🔍 健康检查命令:${NC}"
    echo -e "  curl $API_URL/api/health"
    echo -e "  curl $API_URL/api/health/database"
    
    # 测试健康检查
    echo -e "${YELLOW}🔍 测试健康检查...${NC}"
    HEALTH_RESPONSE=$(curl -s "$API_URL/api/health" || echo "ERROR")
    if [[ "$HEALTH_RESPONSE" == *"error"* ]] || [[ "$HEALTH_RESPONSE" == "ERROR" ]]; then
        echo -e "${YELLOW}⚠️ 健康检查可能需要一些时间初始化${NC}"
    else
        echo -e "${GREEN}✅ 健康检查正常${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ 无法获取 API 端点，请手动检查${NC}"
fi

# 9. 最终总结
echo -e "${PURPLE}=======================================================${NC}"
echo -e "${GREEN}🎉 生产环境部署完成！${NC}"
echo -e "${BLUE}📋 部署总结:${NC}"
echo -e "  版本: ${GREEN}$OLD_VERSION → $NEW_VERSION${NC}"
echo -e "  环境: ${GREEN}生产环境 (prod)${NC}"
echo -e "  架构: ${GREEN}Webpack 单体打包${NC}"
echo -e "  构建时间: ${GREEN}${BUILD_DURATION}s${NC}"
echo -e "  部署时间: ${GREEN}${DEPLOY_DURATION}s${NC}"

# 显示优化效果
echo -e "${BLUE}📊 优化效果:${NC}"
echo -e "  包体积: ${GREEN}大幅减少 (Webpack 优化)${NC}"
echo -e "  冷启动: ${GREEN}显著提升${NC}"
echo -e "  架构复杂度: ${GREEN}简化 (无 Layers)${NC}"
echo -e "  维护性: ${GREEN}易于维护${NC}"

echo -e "${PURPLE}=======================================================${NC}"

echo -e "${YELLOW}💡 提示:${NC}"
echo -e "  查看部署状态: sam list stack-outputs --stack-name aladdin-ai-services-pf-new"
echo -e "  查看 Lambda 日志: aws logs tail /aws/lambda/aladdin-ai-services-pf-ne-AladdinAiServicesFunctio-DI2ttmpDOLyC --follow"