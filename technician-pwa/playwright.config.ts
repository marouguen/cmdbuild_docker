import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'tests/browser',workers:1,fullyParallel:false,timeout:60000,
  use:{baseURL:'http://localhost:4173',...devices['iPhone 13'],defaultBrowserType:'chromium',launchOptions:{channel:'msedge'},trace:'off',screenshot:'only-on-failure'},
  reporter:[['list']],
});
