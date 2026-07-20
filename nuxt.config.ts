// nuxt.config.ts
export default defineNuxtConfig({
  // Kích hoạt các module cần thiết
  modules: [
    '@pinia/nuxt',
    '@nuxt/content',
    '@vite-pwa/nuxt'
  ],

  // Cấu hình Vite để build mượt mà với MapLibre và Three.js
  vite: {
    optimizeDeps: {
      include: ['three', 'maplibre-gl']
    }
  },

  // Xử lý lỗi SSR cho các thư viện đồ họa 3D (chỉ chạy trên Client)
  build: {
    transpile: ['three']
  },

  // Lưu ý: Bản đồ được render trực tiếp trong app.vue (route "/"), không phải "/map",
  // và đã được bọc trong <ClientOnly> nên không cần routeRules ssr:false riêng nữa.

  // Cấu hình PWA (Tiến trình web ngoại tuyến)
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'VGU Campus Map',
      short_name: 'VGU Map',
      theme_color: '#ffffff',
      display: 'standalone',
      icons: [
        {
          src: '/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },
    workbox: {
      // Chiến lược Cache
      runtimeCaching: [
        {
          // Ưu tiên mạng cho API Google Sheets, rớt mạng mới dùng Cache
          urlPattern: /^https:\/\/script\.google\.com\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-rooms-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 // 1 ngày
            }
          }
        },
        {
          // Ưu tiên Cache cho các file ảnh/model 3D
          urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gltf|glb)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'assets-3d-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 * 30 // 30 ngày
            }
          }
        }
      ]
    }
  },

  compatibilityDate: '2026-07-20'
})
