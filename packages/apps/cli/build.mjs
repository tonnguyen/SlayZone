import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/slay.js',
  banner: { js: '#!/usr/bin/env node' },
  external: ['node:sqlite'],
})
