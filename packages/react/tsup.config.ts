import { defineConfig } from 'tsup'

// 'use client' keeps the bell usable from Next.js and other RSC frameworks.
export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  banner: { js: "'use client';" },
})
