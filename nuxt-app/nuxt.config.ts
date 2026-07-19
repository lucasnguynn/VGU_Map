// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  css: ['maplibre-gl/dist/maplibre-gl.css'],
  routeRules: {
    '/api/sheets/**': { proxy: 'https://script.google.com/macros/s/AKfycbzfuL15z4KTKgTVGR5j24PJunAKvC6PP1YRL2Fw0TlH3zxKIDv_e4kQc_sxorlIia07/exec ' }
  }
})
