const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/main.ts',
  
  output: {
    path: path.resolve(__dirname, '../../dist-dev'),
    filename: 'main.js',
    clean: true,
  },
  
  // 开发环境：排除所有 node_modules，保持外部依赖
  externals: {},
  
  devtool: 'inline-source-map',
  
  watch: true,
  watchOptions: {
    ignored: /node_modules/,
    poll: 1000,
  },
};