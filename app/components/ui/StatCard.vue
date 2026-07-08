<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string
  note?: string
  icon: string
  tone?: 'positive' | 'negative' | 'warning' | 'neutral'
  progress?: number
}>()

const toneClass = computed(() => props.tone ?? 'neutral')
</script>

<template>
  <v-card class="glass-card kpi-card" :class="toneClass">
    <div class="kpi-label">
      <span>{{ label }}</span>
      <v-icon size="18">{{ icon }}</v-icon>
    </div>
    <div class="kpi-value" :class="toneClass">{{ value }}</div>
    <div v-if="note" class="kpi-note">{{ note }}</div>
    <v-progress-linear
      v-if="typeof progress === 'number'"
      class="mt-4"
      color="success"
      height="8"
      rounded
      :model-value="Math.max(0, Math.min(100, progress * 100))"
    />
  </v-card>
</template>
