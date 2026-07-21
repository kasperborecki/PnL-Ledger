import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { defineComponent, h } from 'vue'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

const AppDropdown = defineComponent({
  name: 'AppDropdown',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        Dropdown,
        {
          filter: attrs.filter ?? true,
          filterPlaceholder: attrs.filterPlaceholder ?? 'Search...',
          resetFilterOnHide: attrs.resetFilterOnHide ?? true,
          autoFilterFocus: attrs.autoFilterFocus ?? true,
          ...attrs,
          appendTo: attrs.appendTo ?? 'self',
        },
        slots,
      )
  },
})

const AppMultiSelect = defineComponent({
  name: 'AppMultiSelect',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        MultiSelect,
        {
          ...attrs,
          appendTo: attrs.appendTo ?? 'self',
        },
        slots,
      )
  },
})

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(PrimeVue, {
    ripple: true,
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: '.p-dark',
      },
    },
  })

  nuxtApp.vueApp.component('PBadge', Badge)
  nuxtApp.vueApp.component('PButton', Button)
  nuxtApp.vueApp.component('PColumn', Column)
  nuxtApp.vueApp.component('PDataTable', DataTable)
  nuxtApp.vueApp.component('PDialog', Dialog)
  nuxtApp.vueApp.component('PDropdown', AppDropdown)
  nuxtApp.vueApp.component('PInputNumber', InputNumber)
  nuxtApp.vueApp.component('PInputText', InputText)
  nuxtApp.vueApp.component('PMultiSelect', AppMultiSelect)
  nuxtApp.vueApp.component('PSelectButton', SelectButton)
  nuxtApp.vueApp.component('PTag', Tag)
  nuxtApp.vueApp.component('PTextarea', Textarea)
})
