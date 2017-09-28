const path = require('path');

const HtmlPlugin = require('html-webpack-plugin')
const htmlPlugin = new HtmlPlugin({
    template: './index.html',
    filename: 'index.html',
    inject: 'body'
})

module.exports = {
    entry: './js/application.js',
    output: {
        path: path.resolve(__dirname, './build'),
        filename: 'app.bundle.js'
    },
    module: {
        rules: [
            { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/ },
            { test: /\.jsx$/, loader: 'babel-loader', exclude: /node_modules/ },
            {
                test: /\.scss$/,
                use: [
                    { loader: "style-loader" },
                    { loader: "css-loader" },
                    { loader: "sass-loader" }
                ]
            }
        ]
    },
    plugins: [htmlPlugin],
    target: 'electron'
}