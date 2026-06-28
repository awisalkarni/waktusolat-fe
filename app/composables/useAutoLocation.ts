/**
 * Automatic location detection composable.
 *
 * On first visit (or when not overridden), requests browser geolocation and
 * looks up the nearest JAKIM zone. Once the user manually changes the zone,
 * sets an override flag so geolocation is never called again.
 *
 * Usage:
 *   const { detect, detecting, detected, status, error } = useAutoLocation(zone)
 *   onMounted(() => detect())    // auto-trigger
 *   <button @click="detect()">  // manual retry
 */
export function useAutoLocation(zone: Ref<string>) {
  const OVERRIDE_KEY = 'waktusolatfe.location_overridden'

  const detecting = ref(false)
  const detected = ref(false)
  const error = ref<string | null>(null)
  const status = ref<'idle' | 'detecting' | 'detected' | 'denied' | 'failed'>(
    'idle',
  )

  const isOverridden = computed(() => {
    if (!import.meta.client) return false
    return localStorage.getItem(OVERRIDE_KEY) === 'true'
  })

  function getCurrentPosition(
    options?: PositionOptions,
  ): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak disokong oleh pelayar ini.'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options)
    })
  }

  async function detect(): Promise<boolean> {
    if (isOverridden.value) return false
    if (!import.meta.client) return false

    detecting.value = true
    status.value = 'detecting'
    error.value = null

    try {
      const pos = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 min — reuse recent result
      })

      const { latitude, longitude } = pos.coords
      const zoneCode = await $fetch<string>('/api/zone-by-gps', {
        params: {
          lat: latitude.toFixed(6),
          lng: longitude.toFixed(6),
        },
      })

      // Only set if user hasn't overridden while we were detecting
      if (!isOverridden.value) {
        zone.value = zoneCode
        detected.value = true
        status.value = 'detected'
        localStorage.removeItem(OVERRIDE_KEY)
        return true
      }
      return false
    } catch (e: unknown) {
      if (e instanceof GeolocationPositionError) {
        if (e.code === e.PERMISSION_DENIED) {
          status.value = 'denied'
          error.value = 'Benarkan akses lokasi dalam tetapan pelayar.'
        } else {
          status.value = 'failed'
          error.value = 'Gagal mendapat lokasi. Cuba lagi.'
        }
      } else {
        status.value = 'failed'
        error.value = 'Gagal menentukan zon dari lokasi.'
      }
      return false
    } finally {
      detecting.value = false
    }
  }

  function markOverridden() {
    if (import.meta.client) {
      localStorage.setItem(OVERRIDE_KEY, 'true')
    }
    detected.value = false
  }

  return { detect, detecting, detected, status, error, markOverridden, isOverridden }
}
