import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@client': path.resolve(import.meta.dirname, './src/client'),
      '@server': path.resolve(import.meta.dirname, './src/server'),
      '@shared': path.resolve(import.meta.dirname, './src/shared'),
    },
  },
  root: '.',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
