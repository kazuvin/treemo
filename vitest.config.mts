import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // theme.test.ts が globals.css を ?raw で読む
    css: { include: [/globals\.css/] },
  },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
})
