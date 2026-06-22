import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const executable = process.execPath;
const playwrightCli = join(
  process.cwd(),
  'node_modules',
  'playwright',
  'cli.js',
);
const passthroughArgs = process.argv.slice(2);
const playwrightArgs = passthroughArgs.length > 0 && passthroughArgs.every((arg) => !arg.startsWith('-'))
  ? ['--grep', passthroughArgs.join(' ')]
  : passthroughArgs;
const result = spawnSync(
  executable,
  [playwrightCli, 'test', ...playwrightArgs],
  {
    env: {
      ...process.env,
      FOOTBALL_EXTENDED_SMOKE: '1',
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
