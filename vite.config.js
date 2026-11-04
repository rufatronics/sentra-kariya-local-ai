import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ClearForm – Form & T&C Helper',
        short_name: 'ClearForm',
        description: 'Fill forms and understand T&Cs using voice and plain language, running on-device with Llama 3.2',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/assets/ai-*.js', '**/ort/**'],
        runtimeCaching: [
          { urlPattern: /\/assets\/ai-.*\.js$/i, handler: 'CacheFirst', options: { cacheName: 'ai-chunks', expiration: { maxEntries: 10 } } },
          { urlPattern: /\/ort\//i, handler: 'CacheFirst', options: { cacheName: 'ort-runtime', expiration: { maxEntries: 20 } } },
          { urlPattern: /^https:\/\/(huggingface\.co|cdn-lfs[\w.-]*\.huggingface\.co|raw\.githubusercontent\.com)\/.*/i, handler: 'CacheFirst', options: { cacheName: 'model-files', cacheableResponse: { statuses: [0, 200] } } }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mlc-ai/web-llm')) return 'ai-webllm'
          if (id.includes('@huggingface/transformers') || id.includes('onnxruntime')) return 'ai-nllb'
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
})

// .
