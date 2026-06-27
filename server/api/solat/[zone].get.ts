import {
  PRAYER_ORDER,
  type PrayerTimestamps,
  type SolatDay,
  type SolatResponse,
} from '../../../shared/types/waktusolat'

/** Raw upstream shape of GET /v2/solat/{zone} (Unix-second timestamps). */
interface UpstreamPrayer extends PrayerTimestamps {
  day: number
  hijri: string
}

interface UpstreamSolatResponse {
  zone: string
  year: number
  month: string // e.g. "JUN"
  month_number: number
  last_updated: string | null
  prayers: UpstreamPrayer[]
}

/** Format a Unix-second timestamp as "HH:mm" in Asia/Kuala_Lumpur. */
function fmtTime(ts: number): string {
  // toLocaleTimeString with 24h + Asia/Kuala_Lumpur is locale-stable in Node 22+.
  return new Date(ts * 1000).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Today's calendar day-of-month in Asia/Kuala_Lumpur (1–31). */
function todayKLMonthDay(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
  }).formatToParts(new Date())
  return Number(parts.find((p) => p.type === 'day')?.value ?? NaN)
}

/** Narrow an unknown upstream into a usable UpstreamSolatResponse or throw. */
function parseSolat(raw: unknown): UpstreamSolatResponse {
  if (
    raw &&
    typeof raw === 'object' &&
    'prayers' in raw &&
    Array.isArray((raw as { prayers?: unknown }).prayers) &&
    'zone' in raw &&
    typeof (raw as { zone?: unknown }).zone === 'string' &&
    'year' in raw &&
    typeof (raw as { year?: unknown }).year === 'number' &&
    'month' in raw &&
    typeof (raw as { month?: unknown }).month === 'string' &&
    'month_number' in raw &&
    typeof (raw as { month_number?: unknown }).month_number === 'number'
  ) {
    return raw as UpstreamSolatResponse
  }
  throw new Error('Respon API hulu tidak sah.')
}

function toSolatDay(p: UpstreamPrayer): SolatDay {
  const times = {} as Record<keyof PrayerTimestamps, string>
  for (const key of PRAYER_ORDER) {
    times[key] = fmtTime(p[key])
  }
  const raw: PrayerTimestamps = {
    imsak: p.imsak,
    fajr: p.fajr,
    syuruk: p.syuruk,
    dhuha: p.dhuha,
    dhuhr: p.dhuhr,
    asr: p.asr,
    maghrib: p.maghrib,
    isha: p.isha,
  }
  return { day: p.day, hijri: p.hijri, times, raw }
}

/**
 * GET /api/solat/[zone]?year=&month=
 *
 * Proxies upstream V2, converts Unix timestamps to "HH:mm" in MYT, and surfaces
 * today's row. Year/month default to current (server-controlled) so calendar
 * boundary edge cases (end of month) are handled here, not on the client.
 */
export default defineEventHandler(async (event) => {
  const zone = getRouterParam(event, 'zone')?.toUpperCase()
  if (!zone) {
    throw createError({ statusCode: 400, statusMessage: 'Zon diperlukan.' })
  }

  const { apiUrl } = useRuntimeConfig(event)
  const query = getQuery(event)

  const now = new Date()
  const year =
    query.year && !isNaN(Number(query.year))
      ? Number(query.year)
      : now.getFullYear()
  const month = // month_number diperlukan jika query.month diberikan (default: bulan semasa)
    query.month != null && !isNaN(Number(query.month))
      ? Number(query.month)
      : now.getMonth() + 1

  let raw: unknown
  try {
    raw = await $fetch(`${apiUrl}/v2/solat/${encodeURIComponent(zone)}`, {
      query: { year, month },
      headers: { accept: 'application/json' },
      timeout: 8000,
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Gagal mengambil waktu solat dari API hulu.',
    })
  }

  let parsed: UpstreamSolatResponse
  try {
    parsed = parseSolat(raw)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Respon API hulu tidak dapat ditafsir.',
    })
  }

  const prayers = parsed.prayers.map(toSolatDay)
  const todayDay = todayKLMonthDay()
  const today =
    year === now.getFullYear() && month === now.getMonth() + 1
      ? prayers.find((p) => p.day === todayDay) ?? null
      : null

  // The upstream `last_updated` field is null in practice; omit it from our
  // public shape to avoid implying freshness we can’t prove.
  return {
    zone: parsed.zone,
    year: parsed.year,
    monthName: parsed.month,
    monthNumber: parsed.month_number,
    today,
    prayers,
  } satisfies SolatResponse
})