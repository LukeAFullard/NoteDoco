import { defineConfig, devices } from '@playwright/test';

// In cloud dev containers Chromium is preinstalled; CI installs it with `playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // The whole run normally takes 2–3 minutes. In CI, stop (with a report) rather than hang.
  globalTimeout: process.env.CI ? 15 * 60_000 : undefined,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
