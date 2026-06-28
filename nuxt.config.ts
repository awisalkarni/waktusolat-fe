// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: { cssPath: '~/assets/css/main.css' },

  runtimeConfig: {
    // Server-only: upstream waktu solat API base. Overridable via NUXT_API_URL.
    apiUrl: 'https://api.waktusolat.app',

    // Server-only: ToyyibPay credentials for dynamic donation bills.
    // If you prefer a static link, set NUXT_PUBLIC_DONATION_URL instead.
    toyyibpaySecretKey: '',
    toyyibpayCategoryCode: '',

    public: {
      // Google Analytics 4 measurement ID (e.g. G-XXXXXXXXXX).
      gaId: '',

      // Static donation/payment link. If set, the footer links directly here
      // and shows a QR code. Override via NUXT_PUBLIC_DONATION_URL.
      donationUrl: 'https://toyyibpay.com/Donation-Link',
    },
  },

  routeRules: {
    // Zone list rarely changes — cache aggressively on the server/edge.
    '/api/zones': { swr: 86400 },
    // Handler response (today/tomorrow highlighting) changes daily, but the
    // upstream API call itself is cached for a year via defineCachedFunction.
    '/api/solat/**': { swr: 60 },
  },

  nitro: {
    // Persist cached upstream responses as JSON files in the project root so
    // they survive builds and PM2 restarts.
    storage: {
      cache: {
        driver: 'fs',
        base: './.cache/nitro',
      },
    },
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