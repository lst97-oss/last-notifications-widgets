import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), dts({ include: ['src/**/*.ts', 'src/**/*.vue'], exclude: ['src/**/*.test.ts'] })],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    outDir: 'dist',
    emptyOutDir: true,
    // Ship the latest ratified ECMAScript standard (see the repo tsconfig).
    target: 'es2025',
    rollupOptions: {
      external: [
        'vue',
        '@lucide/vue',
        'reka-ui',
        // The client stays a runtime import, resolved by the assembled package.
        /^@last-notifications-widgets\/client(\/|$)/,
        'tailwind-merge',
      ],
    },
  },
})
