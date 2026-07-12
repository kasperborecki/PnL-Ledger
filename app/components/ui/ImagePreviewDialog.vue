<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  url: string | null
  title?: string
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
}>()

const model = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})
</script>

<template>
  <PDialog
    v-model:visible="model"
    modal
    dismissable-mask
    :draggable="false"
    class="image-preview-dialog"
    :header="title || 'Image preview'"
    :style="{ width: 'min(1500px, calc(100vw - 24px))' }"
    :breakpoints="{ '960px': '98vw', '640px': '100vw' }"
  >
    <div class="image-preview-stage">
      <img v-if="url" :src="url" :alt="title || 'Image preview'" class="image-preview-image">
    </div>
  </PDialog>
</template>
