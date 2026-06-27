import type { Zone, ZoneGroup } from '#shared/types/waktusolat'

/**
 * GET /api/zones
 *
 * Proxies the upstream JAKIM zone list and groups it by state (negeri) so the
 * client can render an optgroup-style dropdown. The upstream API sends no CORS
 * headers, so this Nitro route is the single place that talks to it.
 */
export default defineEventHandler(async (event) => {
  const { apiUrl } = useRuntimeConfig(event)

  let zones: Zone[]
  try {
    zones = await $fetch<Zone[]>(`${apiUrl}/zones`, {
      headers: { accept: 'application/json' },
      timeout: 8000,
    })
  } catch (err) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Gagal mengambil senarai zon dari API hulu.',
    })
  }

  // Group by negeri, preserving each state's first-appearance order.
  const groups = new Map<string, Zone[]>()
  for (const z of zones) {
    const list = groups.get(z.negeri)
    if (list) list.push(z)
    else groups.set(z.negeri, [z])
  }

  return [...groups.entries()].map(
    ([negeri, list]): ZoneGroup => ({ negeri, zones: list }),
  )
})