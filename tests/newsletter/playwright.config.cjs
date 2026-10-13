const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname, testMatch: '*.spec.cjs', timeout: 30000, retries: 0, workers: 1,
  outputDir: '../../test-results/newsletter',
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', headless: true, launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: { command: 'python3 -m http.server 4174 --directory ../../maintenance-site', url: 'http://127.0.0.1:4174', reuseExistingServer: false, timeout: 15000 }
});
