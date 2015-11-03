var webpack = require("webpack");
var BowerWebpackPlugin = require('bower-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
    entry:  {
        Main:  __dirname + '/app/main.js'
    },
    output:  {
        path:  __dirname + '/dist/',
        filename: '[name].js' // Template based on keys in entry above
    },
    module:  {
        loaders: [
            // fonts
            {test: /\.(woff|svg|ttf|eot)([\?]?.*)$/, loader: "file-loader?name=[name].[ext]"},

            // CSS
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("style-loader", "css-loader")
            },
            // SASS
            {
                test: /\.sass$/,
                loader: ExtractTextPlugin.extract('css!sass?indentedSyntax')
            }
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            $:      "jquery",
            jQuery: "jquery"
        }),
        new ExtractTextPlugin('[name].css', {
            allChunks: true
        })
    ]
};
