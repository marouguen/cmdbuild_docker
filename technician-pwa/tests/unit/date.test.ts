import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '../../src/i18n/date';

const timestamp = '2026-09-19T10:52:48.442388Z';

describe('locale date formatting', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('formats the same timestamp using English and French locale conventions', () => {
    const english = formatDateTime(timestamp, 'en');
    const french = formatDateTime(timestamp, 'fr');
    expect(english).toBe(new Intl.DateTimeFormat('en', {dateStyle:'medium', timeStyle:'short'}).format(new Date(timestamp)));
    expect(french).toBe(new Intl.DateTimeFormat('fr', {dateStyle:'medium', timeStyle:'short'}).format(new Date(timestamp)));
    expect(english).not.toBe(french);
    expect(timestamp).toBe('2026-09-19T10:52:48.442388Z');
  });

  it('uses the active application locale by default', async () => {
    vi.stubGlobal('localStorage', {getItem:()=>null,setItem:()=>{},removeItem:()=>{}});
    const i18n = await import('../../src/i18n');
    const dates = await import('../../src/i18n/date');
    i18n.setLocale('fr');
    expect(dates.formatDateTime(timestamp)).toBe(dates.formatDateTime(timestamp, 'fr'));
  });

  it('preserves unparseable backend values and handles empty values', () => {
    expect(formatDateTime('backend-date-value', 'en')).toBe('backend-date-value');
    expect(formatDateTime(null, 'fr')).toBe('');
  });
});
