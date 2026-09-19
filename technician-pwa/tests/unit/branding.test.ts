import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_NAME, DEFAULT_APP_SHORT_NAME, resolveBranding } from '../../src/config/branding.js';

describe('application branding', () => {
  it('uses generic multi-role defaults', () => {
    expect(resolveBranding({})).toEqual({appName: DEFAULT_APP_NAME, appShortName: DEFAULT_APP_SHORT_NAME});
    expect(DEFAULT_APP_NAME).toBe('Maintenance Hub');
    expect(DEFAULT_APP_SHORT_NAME).toBe('Maintenance');
  });

  it('honors both existing Vite branding overrides', () => {
    expect(resolveBranding({VITE_APP_NAME:'Acme Maintenance', VITE_APP_SHORT_NAME:'Acme'})).toEqual({appName:'Acme Maintenance', appShortName:'Acme'});
  });
});
