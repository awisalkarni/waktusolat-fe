import { PRAYER_ORDER, PRAYER_LABELS, type PrayerTimestamps } from '#shared/types/waktusolat'

export interface NextPrayerState {
  name: keyof PrayerTimestamps
  label: string
  at: number // Unix ms
  remainingMs: number
  /** "Hj Mjj Ss" countdown string, recomputed every second. */
  countdown: string
}

/**
 * Given today's raw prayer timestamps (Unix seconds), compute the next upcoming
 * waktu and a live countdown. Updates every second via setInterval on the
 * client; SSR-safe (returns a static initial state).
 */
export function useNextPrayer(rawGetter: () => PrayerTimestamps | null | undefined) {
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

    // Skip imsak for "next waktu" — it's a reminder 10min before subuh, not a
    // solat. Find the first PRAYER_ORDER (after imsak) strictly in the future.
    const order = PRAYER_ORDER.filter((k) => k !== 'imsak')

    const raw = rawGetter()
    for (const name of order) {
      const at = (raw?.[name] ?? 0) * 1000
      if (at > now) {
        state.name = name
        state.label = PRAYER_LABELS[name]
        state.at = at
        state.remainingMs = at - now
        state.countdown = formatCountdown(state.remainingMs)
        return
      }
    }

    // All of today's times have passed — next is tomorrow's subuh, unknown here.
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
  watch(rawGetter, recompute, { immediate: import.meta.client })

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