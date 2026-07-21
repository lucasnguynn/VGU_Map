export default defineNuxtConfig({
  app: {
    baseURL: '/VGU_Map/',
    buildAssetsDir: 'assets',
  },

  nitro: {
    preset: 'github_pages', // lưu ý: dùng gạch dưới "github_pages", không phải "github-pages"
    prerender: {
      routes: ['/']
    }
  },

  modules: [
    '@pinia/nuxt',
    '@nuxt/content',
    '@vite-pwa/nuxt'
  ],

  vite: {
    optimizeDeps: {
      include: ['three', 'maplibre-gl']
    }
  },

  build: {
    transpile: ['three']
  },

  pwa: {
    base: '/VGU_Map/',
    registerType: 'autoUpdate',
    manifest: {
      name: 'VGU Campus Map',
      short_name: 'VGU Map',
      theme_color: '#ffffff',
      display: 'standalone',
      icons: [
        { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    workbox: {
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/script\.google\.com\/.*/i,
          handler: 'NetworkFirst',
          options: { cacheName: 'api-rooms-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 } }
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gltf|glb)$/,
          handler: 'CacheFirst',
          options: { cacheName: 'assets-3d-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 } }
        }
      ]
    }
  },

  compatibilityDate: '2026-07-20'
})
