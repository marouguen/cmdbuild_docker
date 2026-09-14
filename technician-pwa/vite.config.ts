import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy: Record<string, ProxyOptions> = { '/cmdbuild/services/rest/v3': {
    target: env.OPENMAINT_ORIGIN || 'http://localhost:8091', changeOrigin: true,
    configure(server) {
      server.on('proxyRes', (response: import('node:http').IncomingMessage) => {
        response.headers['cache-control'] = 'no-store';
        delete response.headers['set-cookie'];
      });
    }
  }};
  return { plugins: [vue()], server: {port: 5173, strictPort: true, proxy}, preview: {port: 4173, strictPort: true, proxy} };
});
