import fs from 'fs'
import { resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function canonicalDataPlugin() {
  const dataDir = resolve(__dirname, 'src/renderer/public/data')
  const prefix = '@data/'

  return {
    name: 'vite-plugin-canonical-data',
    enforce: 'pre',
    resolveId(id) {
      if (id.includes('?url')) return null

      const normalized = id.replace(/\\/g, '/')
      if (normalized.startsWith(prefix) || normalized.includes('/src/renderer/public/data/')) {
        let rel = normalized
        if (normalized.startsWith(prefix)) {
          rel = normalized.slice(prefix.length)
        } else {
          rel = normalized.slice(normalized.indexOf('/src/renderer/public/data/') + '/src/renderer/public/data/'.length)
        }
        return '\0@data/' + rel
      }
      return null
    },
    load(id) {
      if (id.startsWith('\0@data/')) {
        const raw = id.slice('\0@data/'.length)
        const cleanRel = raw.split('?')[0]
        let filePath = join(dataDir, cleanRel)
        if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.json')) {
          filePath = filePath + '.json'
        }
        this.addWatchFile(filePath)
        if (!fs.existsSync(filePath)) {
          return null
        }
        return fs.readFileSync(filePath, 'utf-8')
      }
      return null
    }
  }
}

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
        '@data': resolve(__dirname, 'src/renderer/public/data')
      }
    },
    plugins: [canonicalDataPlugin(), vue()],
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
