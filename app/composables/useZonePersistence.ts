/**
 * Two-way-bind a ref to the `zone` URL query param, persisting the choice in
 * localStorage so a returning user keeps their zone. Falls back to `WLY01`
 * (KL/Putrajaya) when nothing is set.
 */
export function useZonePersistence() {
  const STORAGE_KEY = 'waktusolatfe.zone'
  const route = useRoute()
  const router = useRouter()

  const initial =
    (typeof route.query.zone === 'string' && route.query.zone) ||
    (import.meta.client && localStorage.getItem(STORAGE_KEY)) ||
    'WLY01'

  const zone = ref(initial.toUpperCase())

  // Sync into the URL (shallow, history-replace) + localStorage.
  watch(zone, (value) => {
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, value)
      router.replace({ query: { ...route.query, zone: value } })
    }
  })

  return zone
}