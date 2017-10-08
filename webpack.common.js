const path = require('path');

module.exports = {
    entry: './js/application.js',
    output: {
        path: path.resolve(__dirname, './webpack-build'),
        filename: 'app.bundle.js'
    },
    module: {
        rules: [
            { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/ },
            { test: /\.jsx$/, loader: 'babel-loader', exclude: /node_modules/ },
        ]
    },
    target: 'electron'
}