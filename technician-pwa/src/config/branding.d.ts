export const DEFAULT_APP_NAME: string;
export const DEFAULT_APP_SHORT_NAME: string;
export function resolveBranding(env: Record<string, string | boolean | undefined>): {
  appName: string;
  appShortName: string;
};
