import typescript from 'rollup-plugin-typescript2'

export default {
    input: 'src/app-unified.ts',
    output: {
        file: 'dist/app-unified.js',
        format: 'commonjs',
    },
    onwarn: (warning) => {
        if (warning.code === 'UNRESOLVED_IMPORT') return
    },
    plugins: [typescript()],
}
