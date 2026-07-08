import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { createVuetify } from 'vuetify'
import * as directives from 'vuetify/directives'
import * as components from 'vuetify/components'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'pnlDark',
      themes: {
        pnlDark: {
          dark: true,
          colors: {
            background: '#070a0f',
            surface: '#111827',
            surfaceVariant: '#0f172a',
            primary: '#22c55e',
            secondary: '#9ca3af',
            error: '#ef4444',
            info: '#60a5fa',
            success: '#22c55e',
            warning: '#f97316',
          },
        },
      },
    },
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: { mdi },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})
