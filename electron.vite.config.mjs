// electron.vite.config.mjs

import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'


export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@resources': resolve(__dirname, 'resources'),
      }
    },
    plugins: [vue()],
    publicDir: resolve(__dirname, 'src/renderer/public'),
  },
  builderOptions: { 
    asar: false,
    files: [
      "out/**/*",
      "package.json",
      "resources/**/*",
      "!src/**/*"
    ]
  }
})
