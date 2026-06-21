import { defineConfig, devices } from '@playwright/test';
import { PERFORMANCE_REFERENCE_PROFILE } from './src/performance/PerformanceBudget';

const benchmarkPort = Number(process.env.FOOTBALL_ELEVEN_PERF_PORT ?? 42732);
const benchmarkUrl = `http://127.0.0.1:${benchmarkPort}`;

export default defineConfig({
  testDir: './tests/performance',
  testMatch: /.*\.performance\.spec\.ts/,
  timeout: 600_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: benchmarkUrl,
    deviceScaleFactor: PERFORMANCE_REFERENCE_PROFILE.deviceScaleFactor,
    launchOptions: {
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--enable-gpu',
        '--ignore-gpu-blocklist',
      ],
    },
    trace: 'off',
    video: 'off',
    viewport: {
      height: PERFORMANCE_REFERENCE_PROFILE.height,
      width: PERFORMANCE_REFERENCE_PROFILE.width,
    },
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${benchmarkPort} --strictPort`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: benchmarkUrl,
  },
  projects: [
    {
      name: 'chromium-production',
    },
  ],
});
