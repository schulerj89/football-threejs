import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const mode = process.argv.includes('--full') ? 'full' : 'smoke';
const executable = process.execPath;
const playwrightCli = join(
  process.cwd(),
  'node_modules',
  'playwright',
  'cli.js',
);
const result = spawnSync(
  executable,
  [playwrightCli, 'test', '-c', 'playwright.eleven-performance.config.ts'],
  {
    env: {
      ...process.env,
      FOOTBALL_PERF_MODE: mode,
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
