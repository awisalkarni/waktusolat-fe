<script setup lang="ts">
import {
  PRAYER_ORDER,
  PRAYER_LABELS,
  type PrayerTimestamps,
  type SolatResponse,
  type ZoneGroup,
} from '#shared/types/waktusolat'

useHead({ title: 'Waktu Solat Malaysia' })

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
                  next.name === key
                    ? 'bg-brand-50 scale-[1.01] shadow-sm'
                    : 'hover:bg-slate-50',
                ]"
              >
                <span class="font-medium text-slate-700">
                  {{ PRAYER_LABELS[key as keyof PrayerTimestamps] }}
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
                    <th class="px-3 py-2 text-left">Hari</th>
                    <th
                      v-for="key in PRAYER_ORDER"
                      :key="key"
                      class="px-3 py-2 text-right"
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
                    <td class="px-3 py-2 font-medium text-slate-700">
                      {{ p.day }}
                    </td>
                    <td
                      v-for="key in PRAYER_ORDER"
                      :key="key"
                      class="px-3 py-2 text-right font-mono tabular-nums text-slate-900"
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

    <footer class="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
      Data daripada
      <a
        href="https://api.waktusolat.app/docs"
        class="underline hover:text-slate-600"
        target="_blank"
        rel="noopener"
      >api.waktusolat.app</a
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
