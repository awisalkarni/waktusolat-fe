import {
  PRAYER_LABELS,
  type PrayerTimestamps,
} from '#shared/types/waktusolat'

const NOTIFY_PRAYERS: Array<keyof PrayerTimestamps> = [
  'fajr',
  'syuruk',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
]

const NOTIFY_BEFORE_MS = 5 * 60 * 1000
const IMSAK_BEFORE_MS = 10 * 60 * 1000

export interface PrayerNotificationState {
  supported: boolean
  permission: Ref<NotificationPermission>
  enabled: Ref<boolean>
  requestPermission: () => Promise<void>
  disable: () => void
}

export function usePrayerNotifications(
  todayRaw: () => PrayerTimestamps | null | undefined,
  tomorrowRaw: () => PrayerTimestamps | null | undefined,
): PrayerNotificationState {
  const supported = import.meta.client && 'Notification' in window
  const permission = ref<NotificationPermission>(
    supported ? Notification.permission : 'default',
  )
  const enabled = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined

  async function requestPermission() {
    if (!supported) return
    const result = await Notification.requestPermission()
    permission.value = result
    if (result === 'granted') {
      enabled.value = true
      startWatching()
    }
  }

  function disable() {
    enabled.value = false
    clearInterval(timer)
  }

  function startWatching() {
    if (!supported) return
    clearInterval(timer)

    const fired = new Set<string>()

    function check() {
      const nowMs = Date.now()
      const today = todayRaw()
      const tomorrow = tomorrowRaw()
      if (!today) return

      const candidates = [
        ...NOTIFY_PRAYERS.map((name) => ({ name, ts: today[name] })),
        ...NOTIFY_PRAYERS.map((name) => ({ name, ts: tomorrow?.[name] })),
      ]

      for (const { name, ts } of candidates) {
        if (!ts) continue
        const prayerMs = ts * 1000
        const notifyMs = prayerMs - NOTIFY_BEFORE_MS

        if (nowMs >= notifyMs && nowMs < notifyMs + 60_000) {
          const uid = `prayer:${name}:${prayerMs}`
          if (!fired.has(uid)) {
            fired.add(uid)
            const timeStr = new Date(prayerMs).toLocaleTimeString('en-US', {
              timeZone: 'Asia/Kuala_Lumpur',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
            new Notification('Waktu Solat', {
              body: `${PRAYER_LABELS[name]} — ${timeStr} (5 minit lagi)`,
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png',
            })
          }
        }
      }

      const subuhTs = today.fajr
      if (subuhTs) {
        const imsakMs = subuhTs * 1000 - IMSAK_BEFORE_MS
        if (nowMs >= imsakMs && nowMs < imsakMs + 60_000) {
          const uid = `imsak:${subuhTs}`
          if (!fired.has(uid)) {
            fired.add(uid)
            new Notification('Waktu Solat', {
              body: 'Imsak — 10 minit sebelum Subuh',
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png',
            })
          }
        }
      }

      if (fired.size > 0) {
        setTimeout(() => fired.clear(), 61_000)
      }
    }

    check()
    timer = setInterval(check, 60_000)
  }

  onBeforeUnmount(() => clearInterval(timer))

  return {
    supported,
    permission,
    enabled,
    requestPermission,
    disable,
  }
}
