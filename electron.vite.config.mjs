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
        '@renderer': resolve('src/renderer/src'),
        '@':         resolve('src/renderer/src'),
        '@shared':   resolve('src/shared/dataset'),
      },
    },
    plugins: [vue()],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: (src, filename) => {
            const f = filename.replaceAll('\\', '/')
            const isInRenderer = f.includes('/renderer/src/')
            const isMixinFile = f.includes('/ui-kit/scss/')
                             || f.endsWith('/ui-kit/reset.scss')
                             || f.endsWith('/ui-kit/main.scss')
            if (isInRenderer && !isMixinFile) {
              return `@use "${ resolve('src/renderer/src/ui-kit/scss/ui.scss').replaceAll('\\', '/') }" as *;\n` +
                     `@use "${ resolve('src/renderer/src/ui-kit/scss/typo.scss').replaceAll('\\', '/') }" as *;\n` +
                     src
            }
            return src
          },
        },
      },
    },
  },
})
