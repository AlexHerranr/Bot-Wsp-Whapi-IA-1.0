import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
    input: 'src/app.ts',
    output: {
        file: 'dist/app.js',
        format: 'cjs',
        sourcemap: false,
        exports: 'auto'
    },
    external: [
        'express',
        'openai', 
        'dotenv/config',
        'fs',
        'path',
        'url',
        'http',
        'https',
        'util',
        'events',
        'stream',
        'crypto',
        'os',
        'buffer',
        'querystring',
        'zlib'
    ],
    plugins: [
        resolve({
            preferBuiltins: true
        }),
        commonjs(),
        json(),
        typescript({
            tsconfig: './tsconfig.json'
        })
    ],
    onwarn: (warning) => {
        if (warning.code === 'UNRESOLVED_IMPORT') return;
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        console.warn(warning.message);
    }
}; 