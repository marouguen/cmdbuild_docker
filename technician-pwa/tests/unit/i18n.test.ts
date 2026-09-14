import { describe,it,expect,beforeEach,afterEach,vi } from 'vitest';
function memoryStorage() {
  const store = new Map<string,string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
}
describe('locale persistence', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => { storage = memoryStorage(); vi.stubGlobal('localStorage', storage); vi.resetModules(); });
  afterEach(() => vi.unstubAllGlobals());
  it('defaults to English with no stored preference', async () => {
    const { getLocale } = await import('../../src/i18n');
    expect(getLocale()).toBe('en');
  });
  it('ignores an invalid stored value and falls back to English', async () => {
    storage.setItem('cmms-locale', 'xx');
    const { getLocale } = await import('../../src/i18n');
    expect(getLocale()).toBe('en');
  });
  it('restores a previously persisted language on load', async () => {
    storage.setItem('cmms-locale', 'fr');
    const { getLocale } = await import('../../src/i18n');
    expect(getLocale()).toBe('fr');
  });
  it('switches the active locale and updates translated text', async () => {
    const { i18n, setLocale } = await import('../../src/i18n');
    expect(i18n.global.t('jobs.title')).toBe('My jobs');
    setLocale('fr');
    expect(getLocaleAfter(i18n)).toBe('fr');
    expect(i18n.global.t('jobs.title')).toBe('Mes interventions');
    function getLocaleAfter(instance: typeof i18n) { return instance.global.locale.value; }
  });
  it('persists the selected language to storage', async () => {
    const { setLocale } = await import('../../src/i18n');
    setLocale('fr');
    expect(storage.getItem('cmms-locale')).toBe('fr');
  });
  it('does not persist when storage is unavailable', async () => {
    vi.stubGlobal('localStorage', undefined);
    const { getLocale, setLocale } = await import('../../src/i18n');
    expect(getLocale()).toBe('en');
    expect(() => setLocale('fr')).not.toThrow();
    expect(getLocale()).toBe('fr');
  });
});
describe('API error message translation', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); vi.resetModules(); });
  afterEach(() => vi.unstubAllGlobals());
  it('translates known English error text once the locale is French', async () => {
    const { setLocale } = await import('../../src/i18n');
    const { translateError } = await import('../../src/i18n/errors');
    setLocale('fr');
    expect(translateError('Outcome is required to conclude activity.')).toBe("Le résultat est obligatoire pour terminer l'intervention.");
  });
  it('interpolates dynamic segments such as HTTP status and field names', async () => {
    const { setLocale } = await import('../../src/i18n');
    const { translateError } = await import('../../src/i18n/errors');
    setLocale('fr');
    expect(translateError('openMAINT could not complete this request (404).')).toContain('404');
    expect(translateError('ExecStartDate is not writable in this activity.')).toContain('ExecStartDate');
  });
  it('leaves unrecognized text — such as server-forwarded messages — untouched', async () => {
    const { setLocale } = await import('../../src/i18n');
    const { translateError } = await import('../../src/i18n/errors');
    setLocale('fr');
    const serverText = 'Required field missing: NomDuChamp';
    expect(translateError(serverText)).toBe(serverText);
  });
  it('is a no-op in English, matching the original hardcoded text', async () => {
    const { translateError } = await import('../../src/i18n/errors');
    expect(translateError('Outcome is required to conclude activity.')).toBe('Outcome is required to conclude activity.');
  });
});
