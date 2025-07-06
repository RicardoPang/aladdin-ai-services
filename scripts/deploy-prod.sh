#!/bin/bash

# 部署到生产环境脚本
# 自动增加版本号并部署

set -e  # 遇到错误立即退出

echo "🚀 开始部署到生产环境..."

# 1. 自动增加版本号
echo "📦 更新版本号..."
npm version patch --no-git-tag-version

# 2. 构建应用
echo "🔨 构建应用..."
pnpm run build

# 3. 构建 SAM
echo "🛠️  构建 SAM..."
sam build --no-cached

# 4. 部署
echo "🚀 部署到生产环境..."
sam deploy --config-env prod --no-confirm-changeset

echo "✅ 部署完成！"

# 获取新版本号
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📝 新版本: $NEW_VERSION"

# 提示用户测试
echo "🧪 请测试部署结果:"
echo "curl https://si99mqqc2m.execute-api.ap-southeast-2.amazonaws.com/prod/api/health/database"