import { resolve } from 'node:path'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Tauri の CLI が dev サーバーの URL を固定で待つので、ポートがずれたら失敗させる
const DEV_PORT = 1420

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
  clearScreen: false,
  server: {
    port: DEV_PORT,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    // Tauri 2 の macOS は WKWebView (Safari 相当)
    target: 'safari16',
  },
})
