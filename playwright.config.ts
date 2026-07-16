import { defineConfig, devices } from '@playwright/test';

const exampleBasePath = '/dialkit/';
const exampleBaseURL = `http://127.0.0.1:4173${exampleBasePath}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  testTimeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: exampleBaseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build:example && cd example && npm run preview',
    url: `${exampleBaseURL}demo`,
    env: { VITE_BASE: exampleBasePath },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
