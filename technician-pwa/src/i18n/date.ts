import { getLocale, type Locale } from './index';

const localeTags: Record<Locale, string> = {en: 'en', fr: 'fr'};

export function formatDateTime(value: unknown, locale: Locale = getLocale()) {
  if (value === null || value === undefined || value === '') return '';
  const original = String(value);
  const date = new Date(original);
  if (!Number.isFinite(date.getTime())) return original;
  return new Intl.DateTimeFormat(localeTags[locale], {dateStyle: 'medium', timeStyle: 'short'}).format(date);
}
