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
        })
    ]
};
