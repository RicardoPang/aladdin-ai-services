const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'production',
  entry: './src/lambda.ts',
  
  output: {
    path: path.resolve(__dirname, '../dist-lambda'),
    filename: 'lambda.js',
    libraryTarget: 'commonjs2',
    clean: true,
  },
  
  // 生产环境：打包所有依赖到 bundle 中，简化架构
  externals: {
    // 仅排除 AWS SDK (Lambda 运行时已提供)
    'aws-sdk': 'commonjs aws-sdk',
    '@aws-sdk/client-lambda': 'commonjs @aws-sdk/client-lambda', 
    '@aws-sdk/client-s3': 'commonjs @aws-sdk/client-s3',
    // 可选的 NestJS 依赖，避免打包错误
    '@nestjs/microservices': 'commonjs @nestjs/microservices',
    '@nestjs/microservices/microservices-module': 'commonjs @nestjs/microservices/microservices-module',
    '@nestjs/websockets': 'commonjs @nestjs/websockets',
    '@nestjs/websockets/socket-module': 'commonjs @nestjs/websockets/socket-module',
    '@nestjs/graphql': 'commonjs @nestjs/graphql',
    'class-transformer/storage': 'commonjs class-transformer/storage',
  },
  
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          compress: {
            drop_console: false, // 保留 console.log 用于 CloudWatch
            drop_debugger: true,
            pure_funcs: ['console.debug'], // 删除 debug 日志
            // 激进压缩选项
            unused: true,
            dead_code: true,
            if_return: true,
            join_vars: true,
            reduce_vars: true,
          },
          mangle: {
            keep_classnames: true, // NestJS 需要类名
            keep_fnames: true, // 装饰器需要函数名
          },
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
    // Tree shaking 和优化
    sideEffects: false,
    usedExports: true,
  },
  
  performance: {
    maxAssetSize: 50 * 1024 * 1024, // 50MB 警告阈值
    maxEntrypointSize: 50 * 1024 * 1024,
    hints: 'warning',
  },
  
  devtool: 'source-map',
  
  stats: {
    colors: true,
    modules: false,
    chunks: true,
    chunkModules: false,
    children: false,
    builtAt: true,
    timings: true,
    assets: true,
    assetsSort: 'size',
    warnings: true,
    errors: true,
  },
};