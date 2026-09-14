import { readFile, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
const env = loadEnv('production', process.cwd(), 'VITE_');
const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
if (env.VITE_APP_NAME) manifest.name = env.VITE_APP_NAME;
if (env.VITE_APP_SHORT_NAME) manifest.short_name = env.VITE_APP_SHORT_NAME;
await writeFile(new URL('../dist/manifest.webmanifest', import.meta.url), JSON.stringify(manifest, null, 2));
console.log('Generated manifest for', manifest.name);
