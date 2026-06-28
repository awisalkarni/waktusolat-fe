/**
 * Google Analytics 4 (gtag) — only loads on the client and only when a
 * NUXT_PUBLIC_GA_ID is configured.
 */
export default defineNuxtPlugin(() => {
  const { public: { gaId } } = useRuntimeConfig()
  if (!gaId) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args)
  }
  gtag('js', new Date())
  gtag('config', gaId)
})

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}
