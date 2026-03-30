import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: [
          '@xenova/transformers',
          'fastify',
          '@modelcontextprotocol/sdk',
          '@modelcontextprotocol/sdk/server/index.js',
          '@modelcontextprotocol/sdk/server/stdio.js',
          '@modelcontextprotocol/sdk/types.js',
          'gray-matter',
        ],
      },
    },
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()]
  }
})
