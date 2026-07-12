<script setup lang="ts">
import { navigationItems } from '~/data/ledger'

const route = useRoute()
const ledger = useLedger()
const auth = useAuth()

const accountName = computed(() => auth.displayName.value)
const accountInitials = computed(() => auth.initials.value)
const accountBalance = computed(() => ledger.formatMoney(auth.currentBalance.value ?? 0))
const accountBalanceStyle = computed(() => {
  const length = accountBalance.value.replace(/\s+/g, '').length

  const fontSize =
    length <= 9 ? 0.86 : length <= 12 ? 0.78 : length <= 15 ? 0.7 : length <= 18 ? 0.63 : 0.58

  return {
    fontSize: `${fontSize}rem`,
  }
})
const accountAvatarUrl = computed(() => auth.profile.value?.avatarUrl ?? null)

function isActive(path: string) {
  return route.path === path || (path !== '/dashboard' && route.path.startsWith(path))
}

async function handleSignOut() {
  try {
    ledger.clearLedgerData()
    await auth.signOut()
    await navigateTo('/login')
  } catch (error) {
    console.error('Failed to sign out', error)
  }
}
</script>

<template>
  <aside class="app-sidebar">
    <div class="sidebar-brand">
      <div class="sidebar-logo">
        <v-icon size="22">mdi-trending-up</v-icon>
      </div>
    </div>

    <v-btn
      class="sidebar-cta mb-4"
      color="success"
      size="default"
      rounded="xl"
      variant="flat"
      :title="'Start Trade'"
      @click="ledger.openStartTradeDialog()"
    >
      <v-icon size="22">mdi-plus</v-icon>
    </v-btn>

    <div class="sidebar-menu">
      <NuxtLink
        v-for="item in navigationItems"
        :key="item.to"
        :to="item.to"
        class="sidebar-link"
        :class="{ 'is-active': isActive(item.to) }"
        :title="item.label"
      >
        <v-icon size="20">{{ item.icon }}</v-icon>
      </NuxtLink>
    </div>

    <div class="sidebar-footer">
      <div class="account-card">
        <div class="account-top">
          <v-avatar color="success" size="40">
            <img
              v-if="accountAvatarUrl"
              :src="accountAvatarUrl"
              :alt="accountName"
              class="account-avatar-image"
            >
            <span v-else class="text-body-2 font-weight-bold">{{ accountInitials }}</span>
          </v-avatar>
          <div class="account-meta" :title="auth.user.value?.email ?? accountName">
            <div class="account-balance" :style="accountBalanceStyle">{{ accountBalance }}</div>
          </div>
        </div>

        <div class="account-actions">
          <button
            type="button"
            class="mini-action"
            :title="'Sign out'"
            @click="handleSignOut"
          >
            <v-icon size="18">mdi-logout-variant</v-icon>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
