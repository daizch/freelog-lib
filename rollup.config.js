import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import postcss from 'rollup-plugin-postcss'
import {uglify} from 'rollup-plugin-uglify';
import pkg from './package.json';
import babel from 'rollup-plugin-babel';
import autoprefixer from 'autoprefixer'
import _ from 'lodash'


var isProd = process.env.NODE_ENV === 'production'
var baseOpts = {
  input: 'markdown/index.js',
  output: {
    file: 'dist/markdown-parser.js',
    format: 'cjs', //iife
    name: 'MarkdownParser',
    sourcemap: true
  },
  plugins: [
    resolve({
      main: true,
      browser: true
    }),
    postcss({
      // extensions: [],
      plugins: [autoprefixer]
    }),
    babel({
      exclude: 'node_modules/**' // only transpile our source code
    }),
    commonjs({
      include: ["node_modules/**"]
    })
  ],
  watch: {
    include: 'markdown/**'
  }
}

var prodOpts = _.cloneDeep(baseOpts);
// prodOpts.plugins.push(uglify());  /* minify, but only in production*/

var devOpts = _.cloneDeep(baseOpts);
devOpts.output.format = 'iife'
devOpts.output.file = 'dist/bundle.js'

export default [
  isProd ? prodOpts : devOpts
];