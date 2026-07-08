<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  type: 'area' | 'bar' | 'donut' | 'heatmap'
  series: any
  options: any
  height?: number
  value?: string
  legendItems?: Array<{
    label: string
    color: string
  }>
}>()
</script>

<template>
  <v-card class="glass-card">
    <div class="panel">
      <div class="section-title">
        <div>
          <h2>{{ title }}</h2>
          <p>{{ subtitle }}</p>
        </div>
        <div v-if="value" class="text-h5 font-weight-bold positive">
          {{ value }}
        </div>
      </div>

      <div v-if="legendItems?.length" class="chart-legend">
        <div v-for="item in legendItems" :key="item.label" class="chart-legend-item">
          <span class="chart-legend-swatch" :style="{ background: item.color }" />
          <span>{{ item.label }}</span>
        </div>
      </div>

      <div class="chart-wrap">
        <ClientOnly>
          <apexchart :type="type" :series="series" :options="options" :height="height ?? 320" />
        </ClientOnly>
      </div>
    </div>
  </v-card>
</template>
