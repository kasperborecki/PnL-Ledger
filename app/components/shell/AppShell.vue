<script setup lang="ts">
import AppSidebar from '~/components/shell/AppSidebar.vue'
import AppTopbar from '~/components/shell/AppTopbar.vue'
import OpenTradeDialog from '~/components/shell/OpenTradeDialog.vue'
import TradeComposerDialog from '~/components/shell/TradeComposerDialog.vue'
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <div class="app-main">
      <AppTopbar />
      <main class="app-content">
        <slot />
      </main>
    </div>
    <OpenTradeDialog />
    <TradeComposerDialog />
  </div>
</template>
