export const DEFAULT_APP_NAME = 'Maintenance Hub';
export const DEFAULT_APP_SHORT_NAME = 'Maintenance';

/** @param {Record<string, string | boolean | undefined>} env */
export function resolveBranding(env) {
  const appName = typeof env.VITE_APP_NAME === 'string' ? env.VITE_APP_NAME.trim() : '';
  const appShortName = typeof env.VITE_APP_SHORT_NAME === 'string' ? env.VITE_APP_SHORT_NAME.trim() : '';
  return {
    appName: appName || DEFAULT_APP_NAME,
    appShortName: appShortName || DEFAULT_APP_SHORT_NAME
  };
}
