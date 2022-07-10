const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'demo.js'),
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        use: ["source-map-loader"],
        enforce: "pre",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: [
      'node_modules',
      // path.resolve(__dirname, '..'),
      // path.resolve(__dirname, '../addons')
    ],
    extensions: [ '.tsx', '.ts', '.js' ],
    // alias: {
    //   common: path.resolve('./out/common'),
    //   browser: path.resolve('./out/browser')
    // }
  },
  output: {
    filename: 'demo.bundle.js',
    path: __dirname
  },
  mode: 'development'
}
