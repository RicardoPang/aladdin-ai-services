#!/bin/bash

# Clean build directory
rm -rf dist-lambda

# Create minimal lambda build
mkdir -p dist-lambda

# Copy only necessary files
cp -r dist/src/ dist-lambda/
cp dist/src/lambda.js dist-lambda/
cp package.json dist-lambda/
cp .env.production dist-lambda/.env

# Install only production dependencies
cd dist-lambda
npm install --omit=dev --production
npm prune --production

# Remove unnecessary files and folders to reduce size
rm -rf node_modules/.cache
rm -rf node_modules/**/*.md
rm -rf node_modules/**/test
rm -rf node_modules/**/tests
rm -rf node_modules/**/*.test.js
rm -rf node_modules/**/*.spec.js
rm -rf node_modules/**/examples
rm -rf node_modules/**/docs
find node_modules -name "*.ts" -delete
find node_modules -name "*.map" -delete
find node_modules -name "*.d.ts" -delete
rm -rf node_modules/**/node_modules
rm -rf node_modules/**/.git
rm -rf node_modules/**/coverage
rm -rf node_modules/**/.nyc_output

# Remove large packages that we don't need in Lambda
rm -rf node_modules/typescript
rm -rf node_modules/@types
rm -rf node_modules/eslint
rm -rf node_modules/prettier
rm -rf node_modules/jest
rm -rf node_modules/@nestjs/testing
rm -rf node_modules/supertest
rm -rf node_modules/ts-jest
rm -rf node_modules/ts-loader
rm -rf node_modules/webpack*

echo "Lambda build completed in dist-lambda/"
ls -la
du -sh .