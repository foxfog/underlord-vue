import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@data': resolve(__dirname, 'src/renderer/public/data')
    }
  },
  test: {
    environment: 'node'
  }
})
