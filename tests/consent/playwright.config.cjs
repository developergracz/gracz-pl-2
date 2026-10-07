const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'consent.spec.cjs',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true
  },
  webServer: {
    command: 'python3 -m http.server 4173 --directory ../../maintenance-site',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 15000
  }
});
