import {
  PRAYER_ORDER,
  PRAYER_LABELS,
  type PrayerTimestamps,
} from '#shared/types/waktusolat'

/** Prayer times that trigger a notification (excludes Imsak and Dhuha). */
const NOTIFY_PRAYERS: Array<keyof PrayerTimestamps> = [
  'fajr',
  'syuruk',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
]

export interface PrayerNotificationState {
  supported: boolean
  permission: Ref<NotificationPermission>
  enabled: Ref<boolean>
  requestPermission: () => Promise<void>
  disable: () => void
}

/**
 * Enable prayer-time notifications. After permission is granted, a one-minute
 * interval checks whether the current Malaysian time matches any prayer time
 * for today (or tomorrow after Isyak) and fires a browser notification.
 */
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
      const now = new Date()
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kuala_Lumpur',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now)
      const hour = parts.find((p) => p.type === 'hour')?.value ?? ''
      const minute = parts.find((p) => p.type === 'minute')?.value ?? ''
      const currentKey = `${hour}:${minute}`

      // Build list of candidate prayers: today's + tomorrow's (after Isyak).
      const candidates = [
        ...NOTIFY_PRAYERS.map((name) => ({
          name,
          ts: todayRaw()?.[name],
        })),
        ...NOTIFY_PRAYERS.map((name) => ({
          name,
          ts: tomorrowRaw()?.[name],
        })),
      ]

      for (const { name, ts } of candidates) {
        if (!ts) continue
        const prayerKey = new Date(ts * 1000).toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kuala_Lumpur',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        const uid = `${name}:${prayerKey}`
        if (prayerKey === currentKey && !fired.has(uid)) {
          fired.add(uid)
          new Notification('Waktu Solat', {
            body: `${PRAYER_LABELS[name]} — ${new Date(ts * 1000).toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: true })}`,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
          })
        }
      }

      // Reset the fired set once per minute so the same minute won't refire.
      // We keep it simple: clear everything 61 seconds after any fire.
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
