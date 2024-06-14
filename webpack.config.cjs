const { resolve } = require("path")

module.exports = {
    entry: "./src/index.js",
    target: "node",
    mode: "production",
    output: {
        path: resolve(__dirname, "build"),
        chunkFormat: "commonjs",
    }
};
