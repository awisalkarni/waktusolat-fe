// Shared between Nuxt client + Nitro server (auto-imported in Nuxt 4).

/** A JAKIM prayer-time zone, as returned by https://api.waktusolat.app/zones */
export interface Zone {
  jakimCode: string // e.g. "WLY01"
  negeri: string // e.g. "Wilayah Persekutuan"
  daerah: string // e.g. "Kuala Lumpur, Putrajaya"
}

/** Zones grouped by state — shape returned by our /api/zones route. */
export interface ZoneGroup {
  negeri: string
  zones: Zone[]
}

/** Unix-second timestamps for each prayer, as returned by V2. */
export interface PrayerTimestamps {
  imsak: number
  fajr: number
  syuruk: number
  dhuha: number
  dhuhr: number
  asr: number
  maghrib: number
  isha: number
}

/** One day's prayer times after we format the V2 timestamps to HH:mm. */
export interface SolatDay {
  day: number
  hijri: string
  /** Formatted "HH:mm" in Asia/Kuala_Lumpur. */
  times: Record<keyof PrayerTimestamps, string>
  /** Raw Unix-second timestamps, for countdown math on the client. */
  raw: PrayerTimestamps
}

/** Shape returned by our /api/solat/[zone] route. */
export interface SolatResponse {
  zone: string
  year: number
  monthName: string // e.g. "JUN"
  monthNumber: number
  today: SolatDay | null
  /** The day after today, so the client can show Subuh after Isyak passes. */
  tomorrow: SolatDay | null
  prayers: SolatDay[]
}

/** Ordered prayer names for display. */
export const PRAYER_ORDER: Array<keyof PrayerTimestamps> = [
  'imsak',
  'fajr',
  'syuruk',
  'dhuha',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
]

/** Human-readable labels for the eight daily times. */
export const PRAYER_LABELS: Record<keyof PrayerTimestamps, string> = {
  imsak: 'Imsak',
  fajr: 'Subuh',
  syuruk: 'Syuruk',
  dhuha: 'Dhuha',
  dhuhr: 'Zohor',
  asr: 'Asar',
  maghrib: 'Maghrib',
  isha: 'Isyak',
}