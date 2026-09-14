import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from './i18n';
import './style.css';
createApp(App).use(i18n).mount('#app');
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
