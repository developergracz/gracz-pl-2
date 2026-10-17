const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "admin.spec.cjs",
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4179",
    headless: true,
    launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: { browserName: "chromium", viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: "node ../../contact-api/admin-r1/testing/preview.mjs",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: false,
  },
});
