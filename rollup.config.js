import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
    input: 'src/app.ts',
    output: {
        file: 'dist/app.js',
        format: 'esm',
        sourcemap: false
    },
    external: [
        'express',
        'openai', 
        'dotenv/config',
        'fs',
        'path',
        'url'
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