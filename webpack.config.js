const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './dist/src/lambda.js',
  target: 'node',
  mode: 'production',
  externals: [
    nodeExternals({
      allowlist: [
        // Include these packages in the bundle
        '@prisma/client'
      ]
    })
  ],
  output: {
    path: path.resolve(__dirname, 'dist-webpack'),
    filename: 'lambda.js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['.js', '.json']
  },
  optimization: {
    minimize: true
  },
  node: {
    __dirname: false,
    __filename: false
  }
};