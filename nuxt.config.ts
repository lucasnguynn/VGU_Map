// nuxt.config.ts
export default defineNuxtConfig({
  // Modules
  modules: [
    '@vite-pwa/nuxt',
    '@nuxt/content'
  ],

  // PWA Configuration
  pwa: {
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html,woff,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/.*\.json$/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'vgu-data-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 // 24 hours
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    },
    manifest: {
      name: 'VGU Map Digital Twin',
      short_name: 'VGU Map',
      description: 'VGU MSI Holographic Map - Campus Digital Twin',
      theme_color: '#0F1E36',
      background_color: '#070A12',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,woff,woff2,json}']
    }
  },

  // Content Configuration
  content: {
    highlight: false,
    markdown: {
      toc: false
    }
  },

  // App Configuration
  app: {
    head: {
      title: 'VGU MSI Holographic Map',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0F1E36' },
        { name: 'description', content: 'VGU Campus Digital Twin - MSI Holographic Map' }
      ],
      link: [
        { rel: 'stylesheet', href: 'https://unpkg.com/maplibre-gl@4.0.2/dist/maplibre-gl.css' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap' }
      ],
      style: [
        {
          children: `
            :root {
              --color-primary: #EF5A24;
              --color-secondary: #06B6D4;
              --color-accent: #00FFCC;
              --color-bg-dark: #070A12;
              --color-panel: #0F1E36;
              --font-main: 'Be Vietnam Pro', sans-serif;
              --font-tech: 'Space Mono', monospace;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { 
              font-family: var(--font-main); 
              background: var(--color-bg-dark);
              color: white;
              overflow: hidden;
            }
            .vgu-panel {
              background: rgba(15, 30, 54, 0.85);
              backdrop-filter: blur(16px);
              border: 1px solid rgba(239, 90, 36, 0.3);
              box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(239, 90, 36, 0.05);
            }
          `
        }
      ]
    }
  },

  // Build Configuration
  vite: {
    build: {
      target: 'esnext',
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: {
            'maplibre': ['maplibre-gl'],
            'three': ['three']
          }
        }
      }
    },
    optimizeDeps: {
      include: ['maplibre-gl', 'three']
    }
  },

  // Compatibility Date
  compatibilityDate: '2024-01-01'
})
