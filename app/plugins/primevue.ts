import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { defineComponent, h, type PropType } from 'vue'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Dropdown, { type DropdownProps } from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MultiSelect, { type MultiSelectProps } from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

const AppDropdown = defineComponent({
  name: 'AppDropdown',
  inheritAttrs: false,
  props: {
    filter: { type: Boolean, default: true },
    filterPlaceholder: { type: String, default: 'Search...' },
    resetFilterOnHide: { type: Boolean, default: true },
    autoFilterFocus: { type: Boolean, default: true },
    appendTo: { type: [String, Object] as PropType<DropdownProps['appendTo']>, default: 'self' },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        Dropdown,
        {
          ...props,
          ...attrs,
        },
        slots,
      )
  },
})

const AppMultiSelect = defineComponent({
  name: 'AppMultiSelect',
  inheritAttrs: false,
  props: {
    appendTo: { type: [String, Object] as PropType<MultiSelectProps['appendTo']>, default: 'self' },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        MultiSelect,
        {
          ...props,
          ...attrs,
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
