import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function coupleRoomFallback() {
  const rewrite = (server) => {
    server.middlewares.use((request, _response, next) => {
      if (/^\/couple\/?(?:[?#].*)?$/.test(request.url || '')
        || /^\/couple\/r\/[^?#]*(?:[?#].*)?$/.test(request.url || '')) {
        request.url = '/couple/index.html'
      }
      next()
    })
  }

  return {
    name: 'couple-room-fallback',
    configureServer: rewrite,
    configurePreviewServer: rewrite,
  }
}

export default defineConfig({
  plugins: [coupleRoomFallback(), react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        couple: resolve(import.meta.dirname, 'couple/index.html'),
      },
    },
  },
})
