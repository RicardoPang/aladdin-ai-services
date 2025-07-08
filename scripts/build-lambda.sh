#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 开始构建 Lambda 函数 (统一 Webpack + Layers 方案)${NC}"

# 清理构建目录
echo -e "${YELLOW}🧹 清理构建目录...${NC}"
rm -rf dist-lambda
rm -rf dist-layers
rm -rf dist-final

# 步骤1：构建 Lambda Layer（优化版）
echo -e "${GREEN}📦 步骤1: 构建 Lambda Layer (大型依赖包)${NC}"
mkdir -p dist-layers/nodejs

# 创建 Layer 专用的 package.json（只包含大型依赖）
cat > dist-layers/nodejs/package.json << 'EOF'
{
  "name": "aladdin-ai-services-layer",
  "version": "1.0.0",
  "description": "Lambda Layer for Aladdin AI Services - 核心大型依赖包",
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/swagger": "^11.2.0",
    "@nestjs/config": "^4.0.2",
    "@nestjs/throttler": "^6.4.0",
    "@nestjs/schedule": "^6.0.0",
    "aws-serverless-express": "^3.4.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "pg": "^8.16.3",
    "express": "^4.18.0"
  }
}
EOF

# 安装 Layer 依赖
echo -e "${YELLOW}📥 安装 Layer 依赖...${NC}"
cd dist-layers/nodejs
npm install --omit=dev --production

# 深度优化 Layer 体积
echo -e "${YELLOW}⚡ 深度优化 Layer 体积...${NC}"
# 删除不必要的文件
rm -rf node_modules/.cache
rm -rf node_modules/**/test
rm -rf node_modules/**/tests
rm -rf node_modules/**/*.test.js
rm -rf node_modules/**/*.spec.js
rm -rf node_modules/**/examples
rm -rf node_modules/**/docs
rm -rf node_modules/**/*.md
rm -rf node_modules/**/*.markdown
rm -rf node_modules/**/README*
rm -rf node_modules/**/CHANGELOG*
rm -rf node_modules/**/LICENSE*
rm -rf node_modules/**/HISTORY*

# 删除 TypeScript 相关文件
find node_modules -name "*.ts" -not -path "*/node_modules/@types/*" -delete
find node_modules -name "*.d.ts" -not -path "*/node_modules/@types/*" -delete
find node_modules -name "*.map" -delete

# 删除测试和开发文件
find node_modules -name "*.test.*" -delete
find node_modules -name "*.spec.*" -delete
find node_modules -name "benchmark*" -delete
find node_modules -name "example*" -delete
find node_modules -name "sample*" -delete

# 删除编译工具
find node_modules -name "*.gyp" -delete
find node_modules -name "*.gypi" -delete
find node_modules -name "binding.gyp" -delete
find node_modules -name "Makefile" -delete

# 删除其他不必要的目录
find node_modules -type d -name "coverage" -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -name ".nyc_output" -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -name "man" -exec rm -rf {} + 2>/dev/null || true

cd ../..

# 步骤2：使用 Webpack 打包业务代码（智能打包）
echo -e "${GREEN}🏗️ 步骤2: 使用 Webpack 智能打包业务代码${NC}"
echo -e "${YELLOW}📦 Webpack 打包中（Lambda 模式）...${NC}"
npx webpack --mode=production --env target=lambda

# 检查 Webpack 打包结果
if [ ! -f "dist-lambda/lambda.js" ]; then
    echo -e "${RED}❌ Webpack 打包失败！${NC}"
    exit 1
fi

# 步骤3：准备最终部署包
echo -e "${GREEN}🎯 步骤3: 准备最终部署包${NC}"
mkdir -p dist-final

# 复制 webpack 打包的主文件
cp dist-lambda/lambda.js dist-final/
cp dist-lambda/lambda.js.map dist-final/

# 复制环境配置文件
if [ -f ".env.production" ]; then
    cp .env.production dist-final/.env
elif [ -f ".env" ]; then
    cp .env dist-final/
fi

# 复制 Prisma 相关文件（如果需要）
if [ -d "prisma" ]; then
    mkdir -p dist-final/prisma
    cp -r prisma/schema.prisma dist-final/prisma/ 2>/dev/null || true
fi

# 步骤4：准备 SAM 部署配置
echo -e "${GREEN}🚀 步骤4: 准备 SAM 部署配置${NC}"
# 更新 template.yaml 中的路径配置
sed -i '' 's/CodeUri: dist-minimal\//CodeUri: dist-final\//' template.yaml 2>/dev/null || true

# 步骤5：显示构建结果统计
echo -e "${GREEN}✅ 构建完成！${NC}"
echo -e "${BLUE}📊 构建结果对比:${NC}"
echo ""

# 显示各个部分的大小
echo -e "${YELLOW}📦 Lambda Layer 大小 (大型依赖):${NC}"
du -sh dist-layers/

echo -e "${YELLOW}🏗️ Webpack 打包后的函数代码 (业务代码 + 小型工具):${NC}"
du -sh dist-lambda/

echo -e "${YELLOW}🎯 最终部署包大小 (函数代码):${NC}"
du -sh dist-final/

echo -e "${YELLOW}📝 详细文件列表:${NC}"
echo "最终部署包内容:"
ls -la dist-final/
echo ""
echo "Layer 内容概览:"
ls -la dist-layers/nodejs/
echo ""

# 计算压缩后的大小
echo -e "${BLUE}📦 压缩后大小统计:${NC}"
cd dist-final
tar -czf ../lambda-function-optimized.tar.gz .
cd ..
function_size=$(du -sh lambda-function-optimized.tar.gz | cut -f1)
echo "函数压缩包大小: $function_size"

cd dist-layers
tar -czf ../lambda-layer-optimized.tar.gz .
cd ..
layer_size=$(du -sh lambda-layer-optimized.tar.gz | cut -f1)
echo "Layer 压缩包大小: $layer_size"

# 清理临时文件
rm -f lambda-function-optimized.tar.gz lambda-layer-optimized.tar.gz

echo ""
echo -e "${GREEN}🎉 构建成功完成！${NC}"
echo -e "${BLUE}📋 使用说明:${NC}"
echo ""
echo -e "${YELLOW}开发环境:${NC}"
echo "  npm run dev        # 开发环境 webpack 打包"
echo "  npm run start:dev  # 开发环境启动"
echo ""
echo -e "${YELLOW}生产环境:${NC}"
echo "  npm run build:lambda  # 构建 Lambda 函数"
echo "  npm run sam:build     # SAM 构建"
echo "  npm run sam:deploy    # SAM 部署"
echo ""
echo -e "${YELLOW}部署流程:${NC}"
echo "1. 函数代码: dist-final/"
echo "2. Layer 代码: dist-layers/"
echo "3. 运行 'sam build' 进行构建"
echo "4. 运行 'sam deploy' 进行部署"
echo ""
echo -e "${YELLOW}⚠️ 重要提醒:${NC}"
echo "- 小型工具库已打包进函数代码，减少 Layer 体积"
echo "- 大型依赖保留在 Layer 中，提高复用性"
echo "- Layer 只需在依赖更新时重新构建"
echo "- 确保 Lambda 运行时环境为 Node.js 18.x"