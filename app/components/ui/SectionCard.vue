<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  padded?: boolean
}>()
</script>

<template>
  <v-card class="glass-card" :class="{ 'glass-card--soft': !padded }">
    <div :class="['panel', { tight: !padded }]">
      <div class="section-title">
        <div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
        <slot name="action" />
      </div>
      <slot />
    </div>
  </v-card>
</template>
