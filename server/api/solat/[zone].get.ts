import {
  PRAYER_ORDER,
  type PrayerTimestamps,
  type SolatDay,
  type SolatResponse,
} from '#shared/types/waktusolat'

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

/** Current calendar values in Asia/Kuala_Lumpur. */
function nowKL() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = dtf.formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  }
}

/** Narrow an unknown upstream into a usable UpstreamSolatResponse or throw. */
function parseSolat(raw: unknown): UpstreamSolatResponse {
  if (
    raw &&
    typeof raw === 'object' &&
    'prayers' in raw &&
    Array.isArray(raw.prayers) &&
    'zone' in raw &&
    typeof raw.zone === 'string' &&
    'year' in raw &&
    typeof raw.year === 'number' &&
    'month' in raw &&
    typeof raw.month === 'string' &&
    'month_number' in raw &&
    typeof raw.month_number === 'number'
  ) {
    return raw as UpstreamSolatResponse
  }
  throw new Error('Respon API hulu tidak sah.')
}

const fetchUpstreamMonth = defineCachedFunction(
  async (
    apiUrl: string,
    zone: string,
    year: number,
    month: number,
  ): Promise<UpstreamSolatResponse> => {
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
    return parseSolat(raw)
  },
  {
    name: 'solat-month',
    // Data for a zone+year+month never changes within the year, so cache
    // aggressively. This minimizes calls to api.waktusolat.app.
    maxAge: 365 * 24 * 60 * 60,
    getKey: (apiUrl: string, zone: string, year: number, month: number) =>
      `${zone}:${year}:${month}`,
  },
)

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
  const kl = nowKL()

  const year =
    query.year && !isNaN(Number(query.year)) ? Number(query.year) : kl.year
  const month =
    query.month != null && !isNaN(Number(query.month))
      ? Number(query.month)
      : kl.month

  const parsed = await fetchUpstreamMonth(apiUrl, zone, year, month)
  const prayers = parsed.prayers.map(toSolatDay)

  const today =
    year === kl.year && month === kl.month
      ? prayers.find((p) => p.day === kl.day) ?? null
      : null

  let tomorrow: SolatDay | null = null
  if (today) {
    const lastDayOfMonth = Math.max(...prayers.map((p) => p.day))
    if (today.day < lastDayOfMonth) {
      tomorrow = prayers.find((p) => p.day === today.day + 1) ?? null
    } else {
      // Month boundary: ask upstream for the next month and grab day 1.
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      try {
        const nextParsed = await fetchUpstreamMonth(
          apiUrl,
          zone,
          nextYear,
          nextMonth,
        )
        tomorrow =
          nextParsed.prayers.map(toSolatDay).find((p) => p.day === 1) ?? null
      } catch {
        tomorrow = null
      }
    }
  }

  // The upstream `last_updated` field is null in practice; omit it from our
  // public shape to avoid implying freshness we can’t prove.
  return {
    zone: parsed.zone,
    year: parsed.year,
    monthName: parsed.month,
    monthNumber: parsed.month_number,
    today,
    tomorrow,
    prayers,
  } satisfies SolatResponse
})