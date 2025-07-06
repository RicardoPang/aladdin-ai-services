#!/bin/bash

# 部署VPC版本到生产环境脚本
# 自动增加版本号并部署完整VPC架构

set -e  # 遇到错误立即退出

echo "🚀 开始部署VPC版本到生产环境..."

# 1. 自动增加版本号
echo "📦 更新版本号..."
npm version patch --no-git-tag-version

# 2. 构建应用
echo "🔨 构建应用..."
pnpm run build

# 3. 构建 SAM（使用VPC模板）
echo "🛠️  构建 SAM (VPC版本)..."
sam build --template-file template-vpc.yaml --no-cached

# 4. 部署（使用VPC配置）
echo "🚀 部署VPC版本到生产环境..."
sam deploy --template-file template-vpc.yaml --config-file samconfig-vpc.toml --config-env prod --no-confirm-changeset

echo "✅ VPC版本部署完成！"

# 获取新版本号
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📝 新版本: $NEW_VERSION"

echo ""
echo "🏗️  部署的VPC架构包含:"
echo "   📡 1个公有子网 (10.0.0.0/24) - NAT Gateway"
echo "   🔒 3个私有子网 (10.0.10.0/24, 10.0.11.0/24, 10.0.12.0/24) - Lambda部署"
echo "   🌐 Internet Gateway + NAT Gateway"
echo "   🛡️  安全组配置"
echo ""
echo "🧪 请测试部署结果:"
echo "curl https://[NEW-API-ID].execute-api.ap-southeast-2.amazonaws.com/prod/api/health/database"