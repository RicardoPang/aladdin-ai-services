#!/bin/bash

# Clean build directory
rm -rf dist-minimal

# Create minimal lambda build
mkdir -p dist-minimal

# Copy only the essential compiled files
cp dist/src/lambda.js dist-minimal/
cp -r dist/src/modules dist-minimal/
cp -r dist/src/config dist-minimal/
cp -r dist/src/common dist-minimal/
cp dist/src/app.*.js dist-minimal/

# Create package.json with all production dependencies
cp package.json dist-minimal/package.json

cp .env.production dist-minimal/.env

# Copy Prisma schema (essential for @prisma/client)
cp -r prisma dist-minimal/

# Install only the minimal dependencies
cd dist-minimal
npm install --omit=dev --production

# Generate Prisma client
npx prisma generate

# Clean up unnecessary files
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

echo "Minimal Lambda build completed in dist-minimal/"
ls -la
du -sh .