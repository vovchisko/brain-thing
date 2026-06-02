// IDE-only Vite config: lets WebStorm / IntelliJ resolve the `@`, `@renderer`
// and `@shared` import aliases via its native Vite support (it reads top-level
// `resolve.alias`, which it can't extract from the nested `renderer.resolve`
// block in electron.vite.config.mjs).
//
// The actual build uses electron.vite.config.mjs — electron-vite never loads
// this file, and nothing runs bare `vite`. Keep this to aliases only; do not
// add build logic here.
import { fileURLToPath, URL } from 'node:url'

export default {
  resolve: {
    alias: {
      '@':         fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      '@renderer': fileURLToPath(new URL('./src/renderer/src', import.meta.url)),
      '@shared':   fileURLToPath(new URL('./src/shared/dataset', import.meta.url)),
    },
  },
}
