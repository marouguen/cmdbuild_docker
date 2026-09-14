import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import fr from './locales/fr.json';
export type Locale = 'en' | 'fr';
const STORAGE_KEY = 'cmms-locale';
function isLocale(value: unknown): value is Locale { return value === 'en' || value === 'fr'; }
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch { /* localStorage unavailable: private browsing, or a non-browser test environment */ }
  return 'en';
}
export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: {en, fr},
});
export function getLocale(): Locale {
  return i18n.global.locale.value as Locale;
}
export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* best-effort persistence only */ }
}
