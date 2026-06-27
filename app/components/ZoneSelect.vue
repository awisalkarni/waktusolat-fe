<script setup lang="ts">
import type { ZoneGroup } from '#shared/types/waktusolat'

defineProps<{
  groups: ZoneGroup[]
  modelValue: string
  loading?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [zone: string] }>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="block" for="zone">
    <span class="mb-1 block text-sm font-medium text-slate-600">Zon</span>
    <div class="relative">
      <select
        id="zone"
        class="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-base text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        :value="modelValue"
        :disabled="loading"
        @change="onChange"
      >
        <optgroup v-for="g in groups" :key="g.negeri" :label="g.negeri">
          <option
            v-for="z in g.zones"
            :key="z.jakimCode"
            :value="z.jakimCode"
          >
            {{ z.daerah }} ({{ z.jakimCode }})
          </option>
        </optgroup>
      </select>
      <span
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      >
        ▾
      </span>
    </div>
  </label>
</template>