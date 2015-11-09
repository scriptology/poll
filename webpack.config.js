const NODE_ENV = process.env.NODE_ENV || 'development';
//const webpack = require('webpack');

var webpack = require("webpack");
var BowerWebpackPlugin = require('bower-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
    entry:  {
        Main:  __dirname + '/app/main.js'
    },
    output:  {
        path:  __dirname + '/dist/',
        filename: '[name].js', // Template based on keys in entry above
        library: 'app'
    },
    watch : NODE_ENV == 'development',
    watchOptions: {
      aggregateTimeout: 50,
    },
    //devtool: NODE_ENV == 'development' ? 'cheap-inline-module-source-map': null,
    module:  {
        loaders: [
            // fonts
            {test: /\.(woff|svg|ttf|eot)([\?]?.*)$/, loader: "file-loader?name=[name].[ext]"},

            // CSS
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("style-loader", "css-loader")
            },

            // IMAGES
            { test: /\.(png|jpg|jpeg|gif|woff)$/, loader: 'url-loader?limit=8192' },

            // SASS
            {
                test: /\.sass$/,
                loader: ExtractTextPlugin.extract('css!sass?indentedSyntax')
            }
        ]
    },
    // run -  webpack-dev-server
    devServer: {
        contentBase: "./dist",
    },
    plugins: [
        new BowerWebpackPlugin({
          excludes: /.*\.less$/
        }),

        new webpack.ProvidePlugin({
            $:      "jquery",
            jQuery: "jquery",
            _: "underscore",
        }),

        new ExtractTextPlugin('[name].css', {
            allChunks: true
        }),

    ]

};

//  NODE_ENV=production webpack
if(NODE_ENV == 'production') {
  module.exports.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false,
        drop_console: true,
        unsafe: true
      }
    })
  )
}
