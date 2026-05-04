import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ru from './locales/ru.json'

const savedLanguage = localStorage.getItem('enno_lang') || 'en'

export const i18n = createI18n({
  locale: savedLanguage,
  fallbackLocale: 'en',
  messages: {
    en,
    ru
  },
  legacy: false
})
