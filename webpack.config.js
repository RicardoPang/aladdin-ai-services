const path = require('path');

// 基础公用配置
const baseConfig = {
  target: 'node18',
  
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // pnpm 兼容性配置
    modules: [
      'node_modules',
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, 'node_modules/.pnpm'),
    ],
    symlinks: false,
  },
  
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, 'tsconfig.json'),
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  
  node: {
    __dirname: false,
    __filename: false,
  },
  
  stats: {
    colors: true,
    modules: false,
    chunks: false,
    chunkModules: false,
    children: false,
    builtAt: true,
    timings: true,
    warnings: true,
    errors: true,
  },
};

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  if (isProduction) {
    // 生产环境：合并基础配置和生产配置
    const productionConfig = require('./config/webpack.production.js');
    return { ...baseConfig, ...productionConfig };
  } else {
    // 开发环境：合并基础配置和开发配置
    const developmentConfig = require('./config/webpack.development.js');
    return { ...baseConfig, ...developmentConfig };
  }
};