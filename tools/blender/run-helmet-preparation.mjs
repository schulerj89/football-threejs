import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const mode = readArg('--mode') ?? 'prepare';
const candidate = readArg('--candidate') ?? process.env.npm_config_candidate ?? readSelectedCandidate() ?? 'candidate-a';
const blender = process.env.BLENDER_PATH || 'blender';

if (mode !== 'prepare' && mode !== 'validate') {
  throw new Error(`Unsupported helmet preparation mode: ${mode}`);
}

const generatedCandidate = resolve(repoRoot, 'art-source/meshy/football-helmet/generated', `${candidate}.glb`);
const preparedDir = resolve(repoRoot, 'art-source/meshy/football-helmet/prepared');
const publicDir = resolve(repoRoot, 'public/models/helmet');

if (mode === 'prepare' && !existsSync(generatedCandidate)) {
  throw new Error(`Missing generated candidate ${generatedCandidate}. Run meshy:helmet:generate and download first.`);
}

const script = mode === 'prepare'
  ? resolve(repoRoot, 'tools/blender/prepare_modular_helmet.py')
  : resolve(repoRoot, 'tools/blender/validate_modular_helmet.py');
const blenderArgs = mode === 'prepare'
  ? [
      '--background',
      '--python',
      script,
      '--',
      '--input',
      generatedCandidate,
      '--output-dir',
      preparedDir,
      '--public-dir',
      publicDir,
      '--candidate-id',
      candidate,
    ]
  : [
      '--background',
      '--python',
      script,
      '--',
      '--kit',
      resolve(publicDir, 'football-helmet-kit.glb'),
      '--shell',
      resolve(publicDir, 'helmet-shell.glb'),
      '--faceguard',
      resolve(publicDir, 'faceguard-standard.glb'),
      '--report',
      resolve(preparedDir, 'helmet-validation-report.json'),
    ];

let result = spawnSync(blender, blenderArgs, {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  if (result.error.code !== 'ENOENT') {
    throw result.error;
  }
  const fallbackScript = mode === 'prepare'
    ? 'tools/meshy/prepareHelmetNode.ts'
    : 'tools/meshy/validatePreparedHelmet.ts';
  console.warn(`Blender was not found on PATH. Falling back to ${fallbackScript}.`);
  result = spawnSync(process.execPath, [resolve(repoRoot, 'node_modules/tsx/dist/cli.mjs'), fallbackScript, `--candidate=${candidate}`], {
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
}
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}

function readArg(name) {
  const match = args.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

function readSelectedCandidate() {
  const manifestPath = resolve(repoRoot, 'public/models/helmet/helmet-kit-manifest.json');
  if (!existsSync(manifestPath)) {
    return undefined;
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return typeof manifest.sourceCandidate === 'string' ? manifest.sourceCandidate : undefined;
  } catch {
    return undefined;
  }
}
