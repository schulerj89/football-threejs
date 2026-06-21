import { defineConfig, devices } from '@playwright/test';
import { REFERENCE_BENCHMARK_CONFIG } from './tools/performance/referenceBenchmark';

const benchmarkPort = Number(process.env.FOOTBALL_BENCHMARK_PORT ?? 42731);
const benchmarkUrl = `http://127.0.0.1:${benchmarkPort}`;

export default defineConfig({
  testDir: './tools/performance',
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: benchmarkUrl,
    deviceScaleFactor: REFERENCE_BENCHMARK_CONFIG.viewport.deviceScaleFactor,
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
      height: REFERENCE_BENCHMARK_CONFIG.viewport.height,
      width: REFERENCE_BENCHMARK_CONFIG.viewport.width,
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
