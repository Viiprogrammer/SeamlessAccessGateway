import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import nodeExternals from 'rollup-plugin-node-externals'

export default {
    input: 'src/index.js',
    output: {
        dir: 'build',
        format: 'cjs'
    },
    external: ['ws'],
    plugins: [
        nodeResolve({
            exportConditions: ['node']
        }),
        commonjs({
            include: 'node_modules/**',
            extensions: [ '.js', '.node']
        }),
        nodeExternals({
            builtinsPrefix: 'strip',
            deps: false,
            packagePath: 'package.json'
        })
    ]
};
