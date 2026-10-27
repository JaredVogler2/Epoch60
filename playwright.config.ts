import { defineConfig, devices } from '@playwright/test';

// Chromium-based desktop and iPhone-sized profiles. WebKit projects are enabled when a WebKit
// build is installed (EPOCH_WEBKIT=1); the cloud sandbox ships Chromium only.
const projects = [
  { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  {
    name: 'iphone',
    use: {
      ...devices['iPhone 13'],
      // Run the iPhone profile (touch, DPR 3, 390x664 safari viewport) on Chromium.
      defaultBrowserType: 'chromium' as const,
    },
  },
];
if (process.env.EPOCH_WEBKIT === '1') {
  projects.push({ name: 'webkit-iphone', use: { ...devices['iPhone 13'] } });
}

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects,
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
