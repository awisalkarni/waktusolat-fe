<script setup lang="ts">
import {
  PRAYER_ORDER,
  PRAYER_LABELS,
  type PrayerTimestamps,
  type SolatResponse,
  type ZoneGroup,
} from '#shared/types/waktusolat'

useHead({ title: 'Waktu Solat Malaysia' })

const route = useRoute()
const zone = useZonePersistence()

const { data: groups, pending: zonesPending } = await useFetch<ZoneGroup[]>(
  '/api/zones',
  { key: 'zones', default: () => [] },
)

const { data: solat, pending: solatPending, error: solatError } =
  await useFetch<SolatResponse>(
    () => `/api/solat/${zone.value}`,
    { key: 'solat', watch: [zone] },
  )

const today = computed(() => solat.value?.today ?? null)
const tomorrow = computed(() => solat.value?.tomorrow ?? null)
const next = useNextPrayer(() => ({
  today: today.value?.raw,
  tomorrow: tomorrow.value?.raw,
}))

const nowSec = ref(0)
const currentPrayerName = computed<keyof PrayerTimestamps | null>(() => {
  const raw = today.value?.raw
  if (!raw) return null
  for (const name of [...PRAYER_ORDER].reverse()) {
    if (raw[name] <= nowSec.value) return name
  }
  return null
})

let currentPrayerTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  nowSec.value = Math.floor(Date.now() / 1000)
  currentPrayerTimer = setInterval(() => {
    nowSec.value = Math.floor(Date.now() / 1000)
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(currentPrayerTimer))

const heroPrayerName = computed<keyof PrayerTimestamps>(() => {
  return currentPrayerName.value ?? PRAYER_ORDER[0]
})
const heroPrayerTime = computed(() => {
  return today.value?.times[heroPrayerName.value] ?? '--:-- --'
})
const heroPrayerLabel = computed(() => {
  return PRAYER_LABELS[heroPrayerName.value]
})
const heroIsCurrent = computed(() => {
  return currentPrayerName.value === heroPrayerName.value
})

const notifications = usePrayerNotifications(
  () => today.value?.raw,
  () => tomorrow.value?.raw,
)

const installPrompt = ref<BeforeInstallPromptEvent | null>(null)
const isInstallable = ref(false)
const isIOS = ref(false)

if (import.meta.client) {
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt.value = e as BeforeInstallPromptEvent
    isInstallable.value = true
  })
}

async function installPWA() {
  if (!installPrompt.value) return
  await installPrompt.value.prompt()
  const { outcome } = await installPrompt.value.userChoice
  if (outcome === 'accepted') {
    isInstallable.value = false
    installPrompt.value = null
  }
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const monthLabel = computed(() =>
  solat.value
    ? `${solat.value.monthName} ${solat.value.year}`
    : '',
)

const todayHeader = computed(() => {
  const d = new Date()
  return new Intl.DateTimeFormat('ms-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
})

const HIJRI_MONTHS: Record<string, string> = {
  '01': 'Muharram', '02': 'Safar', '03': 'Rabiulawal', '04': 'Rabiulakhir',
  '05': 'Jamadilawal', '06': 'Jamadilakhir', '07': 'Rejab', '08': 'Syaban',
  '09': 'Ramadan', '10': 'Syawal', '11': 'Zulkaedah', '12': 'Zulhijjah',
}

const hijriLabel = computed(() => {
  const h = today.value?.hijri
  if (!h) return ''
  const parts = h.split('-')
  if (parts.length !== 3) return h
  const monthName = HIJRI_MONTHS[parts[1]] || parts[1]
  const day = parseInt(parts[2], 10)
  return `${day} ${monthName} ${parts[0]}H`
})

const zoneName = computed(() => {
  const code = zone.value
  if (!groups.value) return code
  for (const g of groups.value) {
    const z = g.zones.find((z) => z.jakimCode === code)
    if (z) return z.daerah
  }
  return code
})

function formatNextAt(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(ms))
}

const hasPrayers = computed(() => (solat.value?.prayers?.length ?? 0) > 0)

const config = useRuntimeConfig()
const donationUrl = config.public.donationUrl
const donationAmount = ref(500)
const donationPending = ref(false)
const donationError = ref<string | null>(null)

const donationSuccess = computed(
  () => route.query.donation === 'success',
)

async function donate() {
  if (donationUrl) {
    window.open(donationUrl, '_blank')
    return
  }
  donationPending.value = true
  donationError.value = null
  try {
    const res = await $fetch<{ url: string }>('/api/donate', {
      method: 'POST',
      body: { amount: donationAmount.value },
    })
    window.location.href = res.url
  } catch (e: unknown) {
    const err = e as { statusMessage?: string }
    donationError.value = err.statusMessage || 'Gagal membuat pembayaran.'
  } finally {
    donationPending.value = false
  }
}

const donationPresets = [
  { label: 'RM 5', value: 500 },
  { label: 'RM 10', value: 1000 },
  { label: 'RM 20', value: 2000 },
  { label: 'RM 50', value: 5000 },
]

const isUrgent = computed(
  () => next.remainingMs > 0 && next.remainingMs < 15 * 60 * 1000,
)

const countdownChanged = ref(false)
let countdownTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => next.countdown,
  () => {
    countdownChanged.value = true
    clearTimeout(countdownTimer)
    countdownTimer = setTimeout(() => (countdownChanged.value = false), 250)
  },
)
onBeforeUnmount(() => clearTimeout(countdownTimer))

const showSettings = ref(false)
</script>

<template>
  <div class="min-h-screen bg-emerald-600 text-white">
    <!-- Settings overlay -->
    <Transition name="fade">
      <div
        v-if="showSettings"
        class="fixed inset-0 z-50 flex items-start justify-center bg-emerald-600 pt-14"
      >
        <div class="w-full max-w-lg px-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold">Tukar zon</h2>
            <button
              class="rounded-full p-2 text-white/70 hover:text-white"
              @click="showSettings = false"
            >
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ZoneSelect
            v-model="zone"
            :groups="groups ?? []"
            :loading="zonesPending"
          />
        </div>
      </div>
    </Transition>

    <!-- Loading state -->
    <div
      v-if="solatPending"
      class="mx-auto flex max-w-lg flex-col gap-6 px-6 pt-14"
      aria-busy="true"
      aria-label="Memuatkan waktu solat"
    >
      <div class="h-40 animate-shimmer rounded-xl bg-emerald-500/30 bg-[length:200%_100%]" />
      <div class="h-64 animate-shimmer rounded-xl bg-emerald-500/30 bg-[length:200%_100%]" />
    </div>

    <!-- Error state -->
    <div
      v-else-if="solatError"
      class="mx-auto max-w-lg px-6 pt-20 text-center"
    >
      <p class="rounded-lg bg-red-500/20 px-4 py-3 text-sm text-white">
        Gagal memuatkan data solat untuk {{ zone }}. Cuba zon lain sebentar lagi.
      </p>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!hasPrayers && !solatPending"
      class="mx-auto max-w-lg px-6 pt-20 text-center text-white/60"
    >
      Tiada data solat untuk {{ zone }} pada {{ monthLabel || 'bulan ini' }}.
    </div>

    <!-- Main content -->
    <div v-else-if="hasPrayers" class="mx-auto max-w-lg">
      <!-- Hero dashboard -->
      <section class="relative px-6 pt-14 pb-4">
        <!-- Settings gear -->
        <button
          class="absolute right-6 top-14 text-white/60 hover:text-white"
          @click="showSettings = true"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <!-- Current prayer time (massive) -->
        <p class="text-5xl font-bold leading-none tracking-tight sm:text-6xl">
          {{ heroPrayerTime }}
        </p>
        <!-- Prayer name -->
        <p class="mt-1.5 text-xl font-medium sm:text-2xl">
          {{ heroPrayerLabel }}
        </p>
        <p class="mt-0.5 text-sm text-white/50">
          {{ heroIsCurrent ? 'Waktu solat sekarang' : 'Waktu solat seterusnya' }}
        </p>

        <!-- Location & dates -->
        <p class="mt-5 text-sm text-white/70">
          {{ zoneName }}
        </p>
        <p class="mt-0.5 text-sm text-white/50">
          {{ todayHeader }} · {{ hijriLabel }}
        </p>

        <!-- Sun icon + countdown row -->
        <div class="mt-4 flex items-center gap-4">
          <svg class="h-6 w-6 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke-linecap="round" />
          </svg>
          <p
            class="font-mono text-base tabular-nums tracking-tight transition-transform duration-200"
            :class="countdownChanged ? 'scale-105' : ''"
            aria-live="polite"
          >
            {{ next.label }} dalam {{ next.countdown }}
          </p>
        </div>
      </section>

      <!-- Prayer times list -->
      <section class="perspective-[800px]">
        <ul>
          <li
            v-for="(key, i) in PRAYER_ORDER"
            :key="key"
            class="flex items-center justify-between px-6 py-3.5 transition-colors duration-500 prayer-row"
            :class="
              currentPrayerName === key
                ? 'bg-amber-600'
                : i % 2 === 1
                  ? 'bg-emerald-700'
                  : ''
            "
            :style="{ animationDelay: `${i * 0.07}s` }"
          >
            <span class="flex items-center gap-2 font-medium">
              {{ PRAYER_LABELS[key] }}
              <span
                v-if="next.name === key && currentPrayerName !== key"
                class="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              >
                Seterusnya
              </span>
            </span>
            <span class="font-mono text-lg tabular-nums">
              {{ today!.times[key] }}
            </span>
          </li>
        </ul>
      </section>

      <!-- Monthly timetable -->
      <section class="mt-6 px-6">
        <div class="overflow-hidden rounded-xl bg-emerald-700">
          <div class="border-b border-emerald-600 px-4 py-3 text-sm font-semibold">
            Jadual {{ monthLabel }}
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-emerald-800/50 text-xs uppercase text-white/50">
                <tr>
                  <th class="min-w-[2.5rem] px-2 py-2 text-left">Hari</th>
                  <th
                    v-for="key in PRAYER_ORDER"
                    :key="key"
                    class="min-w-[4rem] px-2 py-2 text-right whitespace-nowrap"
                  >
                    {{ PRAYER_LABELS[key] }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-emerald-600">
                <tr
                  v-for="p in solat?.prayers"
                  :key="p.day"
                  class="transition-colors duration-500"
                  :class="
                    today && p.day === today.day
                      ? 'bg-emerald-600'
                      : 'hover:bg-emerald-600/50'
                  "
                >
                  <td class="px-2 py-1.5 font-medium text-white/80">
                    {{ p.day }}
                  </td>
                  <td
                    v-for="key in PRAYER_ORDER"
                    :key="key"
                    class="min-w-[4rem] px-2 py-1.5 text-right font-mono tabular-nums text-white/70 whitespace-nowrap"
                  >
                    {{ p.times[key] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- PWA & notifications -->
      <section class="mt-6 px-6">
        <div class="rounded-xl bg-emerald-700 px-4 py-4">
          <h3 class="font-semibold">Pasang aplikasi & pemberitahuan</h3>
          <p class="mt-1 text-sm text-white/60">
            Tambah ke skrin utama untuk akses pantas dan terima pemberitahuan setiap waktu solat.
          </p>

          <div class="mt-4 flex flex-wrap gap-3">
            <button
              v-if="isInstallable"
              class="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-white/90"
              @click="installPWA"
            >
              Pasang aplikasi
            </button>

            <button
              v-else-if="isIOS"
              class="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/70"
              disabled
            >
              iOS: Tekan <strong class="mx-1">Share → Add to Home Screen</strong>
            </button>

            <button
              v-if="notifications.supported"
              class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors"
              :class="
                notifications.permission.value === 'granted'
                  ? 'bg-white/15 text-white'
                  : 'bg-white text-emerald-700 hover:bg-white/90'
              "
              :disabled="notifications.permission.value === 'denied'"
              @click="notifications.requestPermission"
            >
              <template v-if="notifications.permission.value === 'granted'">
                Pemberitahuan aktif
              </template>
              <template v-else-if="notifications.permission.value === 'denied'">
                Pemberitahuan disekat
              </template>
              <template v-else>
                Aktifkan pemberitahuan
              </template>
            </button>
          </div>

          <p
            v-if="notifications.permission.value === 'denied'"
            class="mt-2 text-xs text-white/50"
          >
            Anda perlu benarkan pemberitahuan dalam tetapan pelayar untuk mengaktifkannya.
          </p>
        </div>
      </section>

      <!-- Donation -->
      <section
        v-if="donationUrl || config.toyyibpaySecretKey"
        class="mt-6 px-6"
      >
        <div class="rounded-xl bg-emerald-700 px-4 py-4">
          <h3 class="font-semibold">Sokong projek ini</h3>
          <p class="mt-1 text-sm text-white/60">
            Pelayan dan domain memerlukan kos. Sumbangan anda membantu mengekalkan laman ini.
          </p>

          <div
            v-if="donationSuccess"
            class="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
          >
            Terima kasih atas sumbangan anda! Semoga Allah membalas jasa baik anda.
          </div>

          <div
            v-else-if="donationUrl"
            class="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
          >
            <img
              :src="`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(donationUrl)}`"
              alt="QR kod sumbangan"
              class="h-28 w-28 rounded-lg bg-white p-1 shadow-sm"
              loading="lazy"
            >
            <div class="flex flex-col gap-2">
              <a
                :href="donationUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-white/90"
              >
                Sumbang sekarang
              </a>
              <span class="text-xs text-white/50">
                Imbas QR kod atau klik butang untuk menyumbang.
              </span>
            </div>
          </div>

          <div v-else class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in donationPresets"
                :key="preset.value"
                type="button"
                class="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium transition-colors"
                :class="
                  donationAmount === preset.value
                    ? 'bg-white text-emerald-700'
                    : 'text-white/70 hover:bg-white/10'
                "
                @click="donationAmount = preset.value"
              >
                {{ preset.label }}
              </button>
            </div>

            <div class="flex flex-1 items-center gap-2">
              <span class="text-sm text-white/50">RM</span>
              <input
                v-model.number="donationAmount"
                type="number"
                min="100"
                step="100"
                class="w-24 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
                placeholder="500"
              >
              <span class="text-xs text-white/40">sen</span>
            </div>

            <button
              class="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-white/90 disabled:opacity-60"
              :disabled="donationPending || donationAmount < 100"
              @click="donate"
            >
              {{ donationPending ? 'Memuat…' : 'Sumbang' }}
            </button>
          </div>

          <p v-if="donationError" class="mt-2 text-sm text-red-300">
            {{ donationError }}
          </p>
        </div>
      </section>

      <!-- Footer -->
      <footer class="px-6 pb-8 pt-8 text-center text-xs text-white/40">
        Data daripada
        <a
          href="https://api.waktusolat.app/docs"
          class="underline hover:text-white/60"
          target="_blank"
          rel="noopener"
        >api.waktusolat.app</a>. Dibangunkan oleh
        <a
          href="https://awislabs.com"
          class="underline hover:text-white/60"
          target="_blank"
          rel="noopener"
        >awislabs.com</a>. Semua waktu dalam zon waktu Asia/Kuala_Lumpur.
      </footer>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes flip-in {
  0% {
    opacity: 0;
    transform: rotateX(-40deg) translateZ(-60px);
  }
  100% {
    opacity: 1;
    transform: rotateX(0deg) translateZ(0);
  }
}

.prayer-row {
  animation: flip-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) both;
}
</style>
