import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  // D0032 (B0318 R019) — 拆分 vendor chunk 解决 entry 1.13MB 超 Vite 500KB 警告
  // 拆 6 个独立 chunk: echarts / vue-quill / driver / confetti / vue-vendor / vendor
  // 目标: entry chunk < 300KB, 单 chunk < 500KB
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          // D0032: 命名 chunk 顺序敏感 (具体包名优先于通用 vendor)
          if (id.includes('echarts')) return 'echarts'
          if (id.includes('@vueup/vue-quill')) return 'vue-quill'
          if (id.includes('driver.js')) return 'driver'
          if (id.includes('canvas-confetti')) return 'confetti'
          if (id.includes('vue-router') || id.includes('pinia')) return 'vue-vendor'
          if (id.includes('/vue/') || id.includes('/@vue/')) return 'vue-vendor'
          // 兜底: 其他 deps (dayjs, axios, jwt-decode 等)
          return 'vendor'
        }
      }
    }
  }
})