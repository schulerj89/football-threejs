import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const DEFAULT_INPUT = 'art-source/meshy/player-base/rigged/player-base-rigged.glb';
const DEFAULT_OUTPUT_DIR = 'public/models/player';
const DEFAULT_METADATA_DIR = 'art-source/meshy/player-base/metadata';

function parseArgs(argv) {
  const options = {
    blender: process.env.BLENDER_PATH || 'blender',
    input: path.join(repoRoot, DEFAULT_INPUT),
    outputDir: path.join(repoRoot, DEFAULT_OUTPUT_DIR),
    metadataDir: path.join(repoRoot, DEFAULT_METADATA_DIR),
    mode: 'all',
    style: 'ps1Flat',
  };

  for (const arg of argv) {
    if (arg.startsWith('--blender=')) {
      options.blender = arg.slice('--blender='.length);
    } else if (arg.startsWith('--input=')) {
      options.input = path.resolve(repoRoot, arg.slice('--input='.length));
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = path.resolve(repoRoot, arg.slice('--output-dir='.length));
    } else if (arg.startsWith('--metadata-dir=')) {
      options.metadataDir = path.resolve(repoRoot, arg.slice('--metadata-dir='.length));
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length);
    } else if (arg.startsWith('--style=')) {
      options.style = arg.slice('--style='.length);
    }
  }

  if (!['all', 'prepare', 'validate'].includes(options.mode)) {
    throw new Error(`Unsupported --mode=${options.mode}`);
  }
  if (!['smooth', 'ps1Flat'].includes(options.style)) {
    throw new Error(`Unsupported --style=${options.style}`);
  }

  return options;
}

async function checkBlender(blenderExecutable) {
  return new Promise((resolve) => {
    const child = spawn(blenderExecutable, ['--version'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', () => resolve({ available: false, version: null }));
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ available: true, version: output.split(/\r?\n/)[0] || 'Blender' });
      } else {
        resolve({ available: false, version: null });
      }
    });
  });
}

async function runBlender(blenderExecutable, scriptPath, scriptArgs) {
  const args = ['--background', '--python', scriptPath, '--', ...scriptArgs];
  await new Promise((resolve, reject) => {
    const child = spawn(blenderExecutable, args, {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Blender exited with code ${code} while running ${path.basename(scriptPath)}`));
      }
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runtimeGlb = path.join(options.outputDir, 'player-base-rigged.glb');
  const manifest = path.join(options.outputDir, 'player-asset-manifest.json');
  const validationReport = path.join(options.metadataDir, 'player-validation-report.json');

  if (!existsSync(options.input) && options.mode !== 'validate') {
    console.error(
      JSON.stringify(
        {
          status: 'missingInput',
          input: path.relative(repoRoot, options.input).replace(/\\/g, '/'),
          expectedSource: DEFAULT_INPUT,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const blender = await checkBlender(options.blender);
  if (!blender.available) {
    console.warn(
      JSON.stringify(
        {
          status: 'blenderUnavailable',
          executable: options.blender,
          input: path.relative(repoRoot, options.input).replace(/\\/g, '/'),
          plannedOutputs: [
            path.relative(repoRoot, runtimeGlb).replace(/\\/g, '/'),
            path.relative(repoRoot, manifest).replace(/\\/g, '/'),
          ],
          note: 'Install Blender or set BLENDER_PATH to run headless preparation. No runtime player assets were created.',
        },
        null,
        2,
      ),
    );
    return;
  }

  await mkdir(options.outputDir, { recursive: true });
  await mkdir(options.metadataDir, { recursive: true });

  console.log(`Using ${blender.version}`);

  if (options.mode === 'all' || options.mode === 'prepare') {
    await runBlender(options.blender, path.join(__dirname, 'prepare_modular_player.py'), [
      '--input',
      options.input,
      '--output-dir',
      options.outputDir,
      '--metadata-dir',
      options.metadataDir,
      '--style',
      options.style,
    ]);
  }

  if (options.mode === 'all' || options.mode === 'validate') {
    await runBlender(options.blender, path.join(__dirname, 'validate_modular_player.py'), [
      '--kit',
      runtimeGlb,
      '--manifest',
      manifest,
      '--report',
      validationReport,
    ]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
