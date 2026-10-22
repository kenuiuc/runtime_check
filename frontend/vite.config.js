import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const proxy = {
  '/api/node': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/node/, '')
  },
  '/api/java': {
    target: 'http://localhost:8080',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/java/, '')
  }
}

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy
  },
  preview: {
    port: 4173,
    proxy
  }
})
