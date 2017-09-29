const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const MinifyPlugin = require('babel-minify-webpack-plugin')
const ExtractTextPlugin = require("extract-text-webpack-plugin");

const extractSass = new ExtractTextPlugin({
    filename: "app.bundle.css"
});

module.exports = merge(common, {
    plugins: [
        new MinifyPlugin(), extractSass
    ],
    module: {
        rules: [{
            test: /\.scss$/,
            use: extractSass.extract({
                use: [{
                    loader: "css-loader?minimize"
                }, {
                    loader: "sass-loader"
                }],
                // use style-loader in development
                fallback: "style-loader"
            })
        }]
    }
});