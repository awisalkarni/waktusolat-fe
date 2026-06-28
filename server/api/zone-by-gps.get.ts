/**
 * GET /api/zone-by-gps?lat=3.139&lng=101.6869
 *
 * Proxies upstream GET /zones/{lat}/{lng} and returns the JAKIM zone code
 * (e.g. "WLY01"). Used by the client for automatic location detection.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const lat = query.lat
  const lng = query.lng

  if (!lat || !lng) {
    throw createError({ statusCode: 400, statusMessage: 'lat dan lng diperlukan.' })
  }

  const { apiUrl } = useRuntimeConfig(event)

  try {
    const res = await $fetch<{ zone: string }>(
      `${apiUrl}/zones/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`,
      { timeout: 5000 },
    )
    return res.zone
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Gagal menentukan zon dari lokasi.',
    })
  }
})
