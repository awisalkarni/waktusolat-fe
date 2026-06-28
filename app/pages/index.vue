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

// Zone list — server-cached (SWR 24h). Fetched once on app load.
const { data: groups, pending: zonesPending } = await useFetch<ZoneGroup[]>(
  '/api/zones',
  { key: 'zones', default: () => [] },
)

// Prayer times — reactive to zone (and, if you like, year/month via query).
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

/** Current prayer = the latest one today whose time has already passed. */
const nowSec = ref(Math.floor(Date.now() / 1000))
const currentPrayerName = computed<keyof PrayerTimestamps | null>(() => {
  const raw = today.value?.raw
  if (!raw) return null
  // Walk backwards so the most recent prayer is found first.
  for (const name of [...PRAYER_ORDER].reverse()) {
    if (raw[name] <= nowSec.value) return name
  }
  return null
})

let currentPrayerTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  currentPrayerTimer = setInterval(() => {
    nowSec.value = Math.floor(Date.now() / 1000)
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(currentPrayerTimer))

const monthLabel = computed(() =>
  solat.value
    ? `${solat.value.monthName} ${solat.value.year}`
    : '',
)

/** Display the date as e.g. "27 Jun 2026, Sabtu". */
const todayHeader = computed(() => {
  const d = new Date()
  return new Intl.DateTimeFormat('ms-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
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
const donationAmount = ref(500) // RM 5.00 in sen
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

/** True when the next prayer is less than 15 minutes away. */
const isUrgent = computed(
  () => next.remainingMs > 0 && next.remainingMs < 15 * 60 * 1000,
)

/** Trigger a tiny pop animation on the countdown every time it changes. */
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
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          Waktu Solat Malaysia
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Waktu solat mengikut zon JAKIM untuk {{ todayHeader }}
        </p>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div class="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <ZoneSelect
          v-model="zone"
          :groups="groups ?? []"
          :loading="zonesPending"
        />
      </div>

      <Transition name="fade" mode="out-in">
        <div
          v-if="solatPending"
          key="loading"
          class="space-y-4 py-8"
          aria-busy="true"
          aria-label="Memuatkan waktu solat"
        >
          <div
            class="h-40 rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-shimmer bg-[length:200%_100%]"
          />
          <div
            class="h-64 rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-shimmer bg-[length:200%_100%]"
          />
        </div>

        <div
          v-else-if="solatError"
          key="error"
          class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Gagal memuatkan data solat untuk {{ zone }}. Cuba zon lain sebentar
          lagi.
        </div>

        <div v-else-if="hasPrayers" key="content" class="space-y-6">
          <!-- Next prayer card -->
          <section
            class="overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-8 text-white shadow-md transition-all duration-500"
            :class="isUrgent ? 'animate-soft-pulse' : ''"
          >
            <p class="text-sm/relaxed text-brand-100">
              Waktu solat seterusnya
            </p>
            <p class="mt-1 text-3xl font-semibold">{{ next.label }}</p>
            <p class="mt-1 text-sm text-brand-100">
              {{ next.at ? formatNextAt(next.at) : '—' }}
            </p>
            <p
              class="mt-6 inline-block font-mono text-4xl tabular-nums tracking-tight transition-transform duration-200"
              :class="countdownChanged ? 'animate-digit-pop' : ''"
              aria-live="polite"
            >
              {{ next.countdown }}
            </p>
          </section>

          <!-- Today's eight times -->
          <section
            class="rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <header
              class="flex items-baseline justify-between border-b border-slate-200 px-4 py-3"
            >
              <h2 class="font-semibold text-slate-900">
                Waktu Solat Hari Ini
              </h2>
              <span class="text-xs uppercase tracking-wide text-slate-500">
                {{ monthLabel }}
              </span>
            </header>
            <ul class="divide-y divide-slate-100">
              <li
                v-for="key in PRAYER_ORDER"
                :key="key"
                class="flex items-center justify-between px-4 py-3 transition-all duration-500 ease-out"
                :class="[
                  currentPrayerName === key
                    ? 'bg-brand-50 scale-[1.01] shadow-sm'
                    : 'hover:bg-slate-50',
                ]"
              >
                <span class="flex items-center gap-2 font-medium text-slate-700">
                  {{ PRAYER_LABELS[key as keyof PrayerTimestamps] }}
                  <span
                    v-if="next.name === key && currentPrayerName !== key"
                    class="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700"
                  >
                    Seterusnya
                  </span>
                </span>
                <span class="font-mono text-lg tabular-nums text-slate-900">
                  {{ today!.times[key as keyof PrayerTimestamps] }}
                </span>
              </li>
            </ul>
          </section>

          <!-- Monthly grid -->
          <section
            class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <header
              class="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900"
            >
              Jadual {{ monthLabel }}
            </header>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th class="px-2 py-2 text-left">Hari</th>
                    <th
                      v-for="key in PRAYER_ORDER"
                      :key="key"
                      class="min-w-[4.5rem] px-2 py-2 text-right whitespace-nowrap"
                    >
                      {{ PRAYER_LABELS[key as keyof PrayerTimestamps] }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="p in solat?.prayers"
                    :key="p.day"
                    class="transition-colors duration-500"
                    :class="
                      today && p.day === today.day
                        ? 'bg-brand-50'
                        : 'hover:bg-slate-50'
                    "
                  >
                    <td class="px-2 py-2 font-medium text-slate-700">
                      {{ p.day }}
                    </td>
                    <td
                      v-for="key in PRAYER_ORDER"
                      :key="key"
                      class="min-w-[4.5rem] px-2 py-2 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap"
                    >
                      {{ p.times[key as keyof PrayerTimestamps] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div
          v-else
          key="empty"
          class="py-16 text-center text-slate-500"
        >
          Tiada data solat untuk {{ zone }} pada
          {{ monthLabel || 'bulan ini' }}.
        </div>
      </Transition>
    </main>

    <section
      v-if="donationUrl || config.toyyibpaySecretKey"
      class="mx-auto max-w-3xl px-4 py-6 sm:px-6"
    >
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="font-semibold text-slate-900">Sokong projek ini</h3>
        <p class="mt-1 text-sm text-slate-600">
          Pelayan dan domain memerlukan kos. Sumbangan anda membantu mengekalkan
          laman ini.
        </p>

        <div
          v-if="donationSuccess"
          class="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
        >
          Terima kasih atas sumbangan anda! Semoga Allah membalas jasa baik
          anda.
        </div>

        <div
          v-else-if="donationUrl"
          class="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
        >
          <img
            :src="`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(donationUrl)}`"
            alt="QR kod sumbangan"
            class="h-32 w-32 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
            loading="lazy"
          >
          <div class="flex flex-col gap-2">
            <a
              :href="donationUrl"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              Sumbang sekarang
            </a>
            <span class="text-xs text-slate-500">
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
              class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              :class="
                donationAmount === preset.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              "
              @click="donationAmount = preset.value"
            >
              {{ preset.label }}
            </button>
          </div>

          <div class="flex flex-1 items-center gap-2">
            <span class="text-sm text-slate-500">RM</span>
            <input
              v-model.number="donationAmount"
              type="number"
              min="100"
              step="100"
              class="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="500"
            >
            <span class="text-xs text-slate-400">sen</span>
          </div>

          <button
            class="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
            :disabled="donationPending || donationAmount < 100"
            @click="donate"
          >
            {{ donationPending ? 'Memuat…' : 'Sumbang' }}
          </button>
        </div>

        <p
          v-if="donationError"
          class="mt-2 text-sm text-red-600"
        >
          {{ donationError }}
        </p>
      </div>
    </section>

    <footer class="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
      Data daripada
      <a
        href="https://api.waktusolat.app/docs"
        class="underline hover:text-slate-600"
        target="_blank"
        rel="noopener"
      >api.waktusolat.app</a
      >. Dibangunkan oleh
      <a
        href="https://awislabs.com"
        class="underline hover:text-slate-600"
        target="_blank"
        rel="noopener"
      >awislabs.com</a
      >. Semua waktu dalam zon waktu Asia/Kuala_Lumpur.
    </footer>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
