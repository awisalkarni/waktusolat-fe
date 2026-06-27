// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: { cssPath: '~/assets/css/main.css' },

  runtimeConfig: {
    // Server-only: upstream waktu solat API base. Overridable via NUXT_API_URL.
    apiUrl: 'https://api.waktusolat.app',
  },

  routeRules: {
    // Zone list rarely changes — cache aggressively on the server/edge.
    '/api/zones': { swr: 86400 },
    // Monthly prayer times change once a day at most.
    '/api/solat/**': { swr: 3600 },
  },

  app: {
    head: {
      title: 'Waktu Solat Malaysia',
      htmlAttrs: { lang: 'ms' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Waktu solat Malaysia mengikut zon JAKIM.' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})