<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ZoneGroup } from '#shared/types/waktusolat'

const props = defineProps<{
  groups: ZoneGroup[]
  modelValue: string
  loading?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [zone: string] }>()

const open = ref(false)
const query = ref('')
const inputRef = ref<HTMLInputElement>()
const listRef = ref<HTMLDivElement>()

const selectedLabel = computed(() => {
  for (const g of props.groups) {
    const z = g.zones.find(z => z.jakimCode === props.modelValue)
    if (z) return `${z.daerah} (${z.jakimCode})`
  }
  return ''
})

const filtered = computed(() => {
  if (!query.value) return props.groups
  const q = query.value.toLowerCase()
  return props.groups
    .map(g => ({
      ...g,
      zones: g.zones.filter(
        z => z.daerah.toLowerCase().includes(q) || z.jakimCode.toLowerCase().includes(q)
      )
    }))
    .filter(g => g.zones.length > 0)
})

function select(code: string) {
  emit('update:modelValue', code)
  query.value = ''
  open.value = false
  inputRef.value?.blur()
}

function onInputFocus() {
  open.value = true
}

function onInputBlur() {
  // Delay so click on list item registers first
  setTimeout(() => { open.value = false }, 200)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open.value = false
    inputRef.value?.blur()
  }
}
</script>

<template>
  <label class="block" for="zone">
    <span class="mb-1 block text-sm font-medium text-white/70">Zon</span>
    <div class="relative">
      <input
        ref="inputRef"
        id="zone"
        class="w-full rounded-lg border border-white/20 bg-emerald-700 px-3 py-2.5 pr-9 text-base text-white shadow-sm placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
        :placeholder="selectedLabel || 'Cari zon...'"
        :value="open ? query : selectedLabel"
        :disabled="loading"
        autocomplete="off"
        @input="query = ($event.target as HTMLInputElement).value"
        @focus="onInputFocus"
        @blur="onInputBlur"
        @keydown="onKeydown"
      />
      <span
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
      >
        ▾
      </span>

      <div
        v-if="open"
        ref="listRef"
        class="absolute left-0 right-0 top-full z-50 mt-1 max-h-[18rem] overflow-y-auto rounded-lg border border-white/10 bg-emerald-800 shadow-xl"
      >
        <div v-if="filtered.length === 0" class="px-3 py-4 text-center text-sm text-white/40">
          Tiada zon dijumpai
        </div>
        <template v-for="g in filtered" :key="g.negeri">
          <div class="sticky top-0 bg-emerald-800/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40 backdrop-blur-sm">
            {{ g.negeri }}
          </div>
          <button
            v-for="z in g.zones"
            :key="z.jakimCode"
            class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
            :class="{ 'bg-white/10': z.jakimCode === modelValue }"
            @mousedown.prevent="select(z.jakimCode)"
          >
            <span>{{ z.daerah }}</span>
            <span class="font-mono text-xs text-white/40">{{ z.jakimCode }}</span>
          </button>
        </template>
      </div>
    </div>
  </label>
</template>
