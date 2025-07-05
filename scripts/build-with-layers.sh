#!/bin/bash

# Clean build directories
rm -rf dist-function
rm -rf dist-layer

echo "🏗️  构建Lambda Function代码..."

# Create function code build (without node_modules)
mkdir -p dist-function

# Copy only the compiled JavaScript files
cp dist/src/lambda.js dist-function/
cp -r dist/src/modules dist-function/
cp -r dist/src/config dist-function/
cp -r dist/src/common dist-function/
cp dist/src/app.*.js dist-function/

# Copy environment file
cp .env.production dist-function/.env

echo "📦 构建Lambda Layer..."

# Create layer build (only node_modules)
mkdir -p dist-layer/nodejs

# Create minimal package.json for layer
cat > dist-layer/nodejs/package.json << 'EOF'
{
  "name": "aladdin-ai-services-layer",
  "version": "1.0.0",
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/swagger": "^11.2.0",
    "@nestjs/config": "^4.0.2",
    "@nestjs/throttler": "^6.4.0",
    "@prisma/client": "^6.11.1",
    "aws-serverless-express": "^3.4.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.2",
    "compression": "^1.8.0",
    "helmet": "^8.1.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "dotenv": "^17.0.1"
  }
}
EOF

# Install dependencies in layer
cd dist-layer/nodejs
npm install --omit=dev --production

# Clean up layer
rm -rf node_modules/.cache
rm -rf node_modules/**/test
rm -rf node_modules/**/tests
rm -rf node_modules/**/*.test.js
rm -rf node_modules/**/*.spec.js
rm -rf node_modules/**/examples
rm -rf node_modules/**/docs
rm -rf node_modules/**/*.md
find node_modules -name "*.ts" -delete
find node_modules -name "*.map" -delete
find node_modules -name "*.d.ts" -delete

cd ../..

echo "✅ 构建完成！"
echo "Function 代码大小:"
du -sh dist-function/
echo "Layer 大小:"
du -sh dist-layer/