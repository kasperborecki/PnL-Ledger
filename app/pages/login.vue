<script setup lang="ts">
definePageMeta({
  layout: false,
})

const auth = useAuth()

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)
const loginError = ref('')

async function handleSubmit() {
  isSubmitting.value = true
  loginError.value = ''

  try {
    await auth.signIn(email.value.trim(), password.value)
    const route = useRoute()
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/dashboard'

    await navigateTo(redirect)
  } catch (caught) {
    loginError.value = caught instanceof Error ? caught.message : 'Unable to sign in.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login-screen">
    <div class="login-shell">
      <section class="login-hero glass-card">
        <div class="login-kicker">Private workspace</div>
        <h1>Log in to P&L Ledger</h1>
        <p>
          This is a closed app for you and your colleague. Sign in with pre-created Supabase
          accounts only. No registration flow is exposed.
        </p>
        <div class="login-points">
          <div>Dashboard, journal, analytics and playbook all read from the database.</div>
          <div>New trades and screenshot labels are written back to Supabase.</div>
          <div>After sign in you land directly in the active workspace.</div>
        </div>
      </section>

      <section class="login-card glass-card">
        <div class="login-card-head">
          <div>
            <div class="login-kicker">Access</div>
            <h2>Sign in</h2>
          </div>
          <div class="login-badge">No signup</div>
        </div>

        <form class="login-form" @submit.prevent="handleSubmit">
          <label class="field">
            <span>Email</span>
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              class="form-input"
              placeholder="name@domain.com"
              required
            >
          </label>

          <label class="field mt-2">
            <span>Password</span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="form-input"
              placeholder="Your password"
              required
            >
          </label>

          <div v-if="loginError" class="login-error">
            {{ loginError }}
          </div>

          <PButton
            type="submit"
            label="Sign in"
            icon="pi pi-sign-in"
            :loading="isSubmitting"
            class="login-submit mt-14"
          />
        </form>
      </section>
    </div>
  </div>
</template>
