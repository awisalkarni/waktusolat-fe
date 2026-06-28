import {
  PRAYER_ORDER,
  PRAYER_LABELS,
  type PrayerTimestamps,
} from '#shared/types/waktusolat'

export interface NextPrayerState {
  name: keyof PrayerTimestamps
  label: string
  at: number // Unix ms
  remainingMs: number
  /** "Hj Mjj Ss" countdown string, recomputed every second. */
  countdown: string
}

export interface NextPrayerInput {
  today: PrayerTimestamps | null | undefined
  tomorrow: PrayerTimestamps | null | undefined
}

/**
 * Given today's and tomorrow's raw prayer timestamps (Unix seconds), compute
 * the next upcoming waktu and a live countdown. After today's Isyak passes,
 * tomorrow's Subuh becomes the next prayer. Updates every second via
 * setInterval on the client; SSR-safe (returns a static initial state).
 */
export function useNextPrayer(inputGetter: () => NextPrayerInput) {
  const state = reactive<NextPrayerState>({
    name: 'fajr',
    label: PRAYER_LABELS.fajr,
    at: 0,
    remainingMs: 0,
    countdown: '--:--:--',
  })

  let timer: ReturnType<typeof setInterval> | undefined

  function recompute() {
    const now = Date.now()
    const { today, tomorrow } = inputGetter()

    // Only notify for the 5 daily solat + Syuruk (end of Subuh).
    const solatOrder: Array<keyof PrayerTimestamps> = [
      'fajr', 'syuruk', 'dhuhr', 'asr', 'maghrib', 'isha',
    ]
    const order = solatOrder

    // Search today first, then tomorrow (so after Isyak we roll to Subuh).
    const candidates = [
      ...order.map((name) => ({ name, at: (today?.[name] ?? 0) * 1000 })),
      ...order.map((name) => ({ name, at: (tomorrow?.[name] ?? 0) * 1000 })),
    ]

    for (const { name, at } of candidates) {
      if (at > now) {
        state.name = name
        state.label = PRAYER_LABELS[name]
        state.at = at
        state.remainingMs = at - now
        state.countdown = formatCountdown(state.remainingMs)
        return
      }
    }

    // Both today and tomorrow have passed (unlikely unless the page is left
    // open across two midnights without a refresh).
    state.name = 'fajr'
    state.label = PRAYER_LABELS.fajr
    state.at = 0
    state.remainingMs = 0
    state.countdown = 'Lewat hari ini'
  }

  onMounted(() => {
    recompute()
    timer = setInterval(recompute, 1000)
  })

  onBeforeUnmount(() => {
    clearInterval(timer)
  })

  // Recompute on data change (e.g. zone switched).
  watch(inputGetter, recompute, { immediate: import.meta.client })

  return state
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}