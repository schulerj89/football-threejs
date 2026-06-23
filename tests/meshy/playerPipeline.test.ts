import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FOOTBALL_PLAYER_CANDIDATE_PLAN,
  FOOTBALL_PLAYER_REFERENCE_PLAN,
} from '../../tools/meshy/playerGenerationPlan';
import { createMeshyPlayerRequest, generatePlayerCandidates } from '../../tools/meshy/generatePlayerCandidate';
import { downloadPlayerCandidates } from '../../tools/meshy/downloadMeshyResult';
import { rigPlayerCandidates } from '../../tools/meshy/rigPlayerCandidate';
import {
  validatePlayerPlan,
  type PlayerReferenceImagePlan,
} from '../../tools/meshy/schemas';

describe('player Meshy pipeline', () => {
  it('defines a valid GPT Image 2 to Meshy low-poly player plan', () => {
    const errors = validatePlayerPlan(FOOTBALL_PLAYER_REFERENCE_PLAN, FOOTBALL_PLAYER_CANDIDATE_PLAN);

    expect(errors).toEqual([]);
    expect(FOOTBALL_PLAYER_CANDIDATE_PLAN).toHaveLength(2);
    expect(FOOTBALL_PLAYER_REFERENCE_PLAN).toHaveLength(8);
    expect(new Set(FOOTBALL_PLAYER_REFERENCE_PLAN.map((reference) => reference.model))).toEqual(
      new Set(['gpt-image-2']),
    );
    expect(new Set(FOOTBALL_PLAYER_REFERENCE_PLAN.map((reference) => reference.view))).toEqual(
      new Set(['front', 'right', 'back', 'left']),
    );
  });

  it('dry-runs generation, download, and rigging without requiring API keys', async () => {
    const options = {
      candidateId: 'candidate-a' as const,
      execute: false,
      force: false,
      maxCandidates: 1,
      retryCount: 1,
    };

    await expect(generatePlayerCandidates(options)).resolves.toMatchObject({
      dryRun: true,
      skippedCandidates: ['candidate-a'],
      submittedCandidates: [],
    });
    await expect(downloadPlayerCandidates(options)).resolves.toMatchObject({
      dryRun: true,
      skipped: ['candidate-a'],
    });
    await expect(rigPlayerCandidates(options)).resolves.toMatchObject({
      dryRun: true,
      skipped: ['candidate-a'],
    });
  });

  it('passes ordered PNG references to Meshy with the requested player configuration', () => {
    const tempRoot = 'test-results/player-pipeline';
    mkdirSync(tempRoot, { recursive: true });
    const references: PlayerReferenceImagePlan[] = ['front', 'right', 'back', 'left'].map((view) => {
      const outputPath = `${tempRoot}/candidate-a-${view}.png`;
      writeFileSync(outputPath, `fake-${view}`);
      return {
        assetId: `candidate-a-${view}`,
        candidateId: 'candidate-a',
        model: 'gpt-image-2',
        outputFormat: 'png',
        outputPath,
        prompt: `fake ${view} no text logo number watermark`,
        quality: 'high',
        requestedSize: '1024x1024',
        view: view as PlayerReferenceImagePlan['view'],
      };
    });

    try {
      const request = createMeshyPlayerRequest(FOOTBALL_PLAYER_CANDIDATE_PLAN[0], references);

      expect(request.image_urls).toHaveLength(4);
      expect(request.image_urls.every((url) => url.startsWith('data:image/png;base64,'))).toBe(true);
      expect(request.should_texture).toBe(true);
      expect(request.enable_pbr).toBe(false);
      expect(request.hd_texture).toBe(false);
      expect(request.should_remesh).toBe(true);
      expect(request.target_polycount).toBe(7000);
      expect(request.topology).toBe('triangle');
      expect(request.pose_mode).toBe('a-pose');
      expect(request.origin_at).toBe('bottom');
      expect(request.auto_size).toBe(true);
      expect(request.multi_view_thumbnails).toBe(true);
      expect(request.texture_prompt).toMatch(/medium-gray practice jersey/i);
    } finally {
      if (existsSync(tempRoot)) {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  });

  it('keeps Meshy and OpenAI generation secrets out of browser source', () => {
    const browserSourceFiles = [
      ...collectFiles('src'),
      ...collectFiles('public').filter((path) => !path.includes('/models/helmet/helmet-preview.html')),
    ];
    const secretReferences = browserSourceFiles.filter((path) => {
      const text = readFileSync(path, 'utf8');
      return /MESHY_API_KEY|OPENAI_API_KEY|Authorization|Bearer\s+/.test(text);
    });

    expect(secretReferences).toEqual([]);
  });

  it('defines the headless Blender player-preparation entrypoint', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const runner = readFileSync('tools/blender/run-player-preparation.mjs', 'utf8');

    expect(existsSync('tools/blender/prepare_modular_player.py')).toBe(true);
    expect(existsSync('tools/blender/validate_modular_player.py')).toBe(true);
    expect(existsSync('tools/blender/run-player-preparation.mjs')).toBe(true);
    expect(packageJson.scripts['asset:prepare:player']).toBe(
      'node tools/blender/run-player-preparation.mjs',
    );
    expect(runner).toContain('--background');
    expect(runner).toContain('prepare_modular_player.py');
    expect(runner).toContain('validate_modular_player.py');
    expect(runner).toContain('art-source/meshy/player-base/rigged/player-base-rigged.glb');
    expect(runner).toContain('public/models/player');
    expect(runner).toContain('blenderUnavailable');
  });

  it('prepares a bounded four-region customizable player kit contract', () => {
    const prepareScript = readFileSync('tools/blender/prepare_modular_player.py', 'utf8');
    const validateScript = readFileSync('tools/blender/validate_modular_player.py', 'utf8');
    const requiredSockets = [
      'socket_helmet',
      'socket_hair',
      'socket_head_accessory',
      'socket_shoulder_pads',
      'socket_left_hand',
      'socket_right_hand',
      'socket_left_foot',
      'socket_right_foot',
      'socket_ball_carry',
      'socket_ball_throw',
    ];

    for (const socket of requiredSockets) {
      expect(prepareScript).toContain(socket);
      expect(validateScript).toContain(socket);
    }

    expect(prepareScript).toContain('"skin"');
    expect(prepareScript).toContain('"jersey"');
    expect(prepareScript).toContain('"pants_socks"');
    expect(prepareScript).toContain('"shoes"');
    expect(prepareScript).toContain('export_animations=False');
    expect(prepareScript).toContain('"headModularity"');
    expect(prepareScript).toContain('"shoeModularity"');
    expect(validateScript).toContain('Expected zero animation clips');
    expect(validateScript).toContain('Expected no more than four body material regions');
    expect(validateScript).toContain('{"up": "+Y", "forward": "+Z"}');
  });
});

function collectFiles(root: string): string[] {
  const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }) : [];
  const files: string[] = [];

  for (const entry of entries) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
    } else if (entry.isFile() && statSync(path).size < 2_000_000) {
      files.push(path.replace(/\\/g, '/'));
    }
  }

  return files;
}
