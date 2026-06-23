import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sanitizeMeshyTaskPayload } from '../../tools/meshy/downloadHelmetCandidate';
import {
  FOOTBALL_HELMET_CANDIDATE_PLAN,
  FOOTBALL_HELMET_REFERENCE_PLAN,
} from '../../tools/meshy/helmetGenerationPlan';
import { createMeshyRequest, generateHelmetCandidates } from '../../tools/meshy/generateHelmetCandidate';
import { auditGlbAsset } from '../../tools/meshy/helmetAssetReport';
import { validatePreparedHelmet } from '../../tools/meshy/validatePreparedHelmet';
import {
  HELMET_COMBINED_RUNTIME_PATH,
  HELMET_FACEGUARD_RUNTIME_PATH,
  HELMET_MANIFEST_RUNTIME_PATH,
  HELMET_SHELL_RUNTIME_PATH,
  readJsonFile,
  validateHelmetPlan,
  type HelmetReferenceImagePlan,
} from '../../tools/meshy/schemas';

describe('helmet Meshy pipeline', () => {
  it('defines a valid GPT Image 2 to Meshy helmet plan', () => {
    const errors = validateHelmetPlan(FOOTBALL_HELMET_REFERENCE_PLAN, FOOTBALL_HELMET_CANDIDATE_PLAN);

    expect(errors).toEqual([]);
    expect(FOOTBALL_HELMET_CANDIDATE_PLAN).toHaveLength(2);
    expect(FOOTBALL_HELMET_REFERENCE_PLAN).toHaveLength(8);
    expect(new Set(FOOTBALL_HELMET_REFERENCE_PLAN.map((reference) => reference.model))).toEqual(
      new Set(['gpt-image-2']),
    );
    expect(new Set(FOOTBALL_HELMET_REFERENCE_PLAN.map((reference) => reference.view))).toEqual(
      new Set(['front', 'right', 'back', 'left']),
    );
  });

  it('dry-runs without requiring OpenAI or Meshy keys', async () => {
    const summary = await generateHelmetCandidates({
      candidateId: 'candidate-a',
      execute: false,
      force: false,
      maxCandidates: 1,
      retryCount: 1,
    });

    expect(summary.dryRun).toBe(true);
    expect(summary.generatedReferences).toEqual([]);
    expect(summary.submittedCandidates).toEqual([]);
    expect(summary.skippedCandidates).toEqual(['candidate-a']);
  });

  it('passes generated reference images to Meshy as ordered image URLs', () => {
    const tempRoot = 'test-results/helmet-pipeline';
    mkdirSync(tempRoot, { recursive: true });
    const references: HelmetReferenceImagePlan[] = ['front', 'right', 'back', 'left'].map((view) => {
      const outputPath = `${tempRoot}/candidate-a-${view}.webp`;
      writeFileSync(outputPath, `fake-${view}`);
      return {
        assetId: `candidate-a-${view}`,
        candidateId: 'candidate-a',
        model: 'gpt-image-2',
        outputFormat: 'webp',
        outputPath,
        prompt: `fake ${view}`,
        quality: 'high',
        requestedSize: '1024x1024',
        view: view as HelmetReferenceImagePlan['view'],
      };
    });

    try {
      const request = createMeshyRequest(FOOTBALL_HELMET_CANDIDATE_PLAN[0], references);

      expect(request.image_urls).toHaveLength(4);
      expect(request.image_urls.every((url) => url.startsWith('data:image/webp;base64,'))).toBe(true);
      expect(request.should_texture).toBe(false);
      expect(request.enable_pbr).toBe(false);
      expect(request.should_remesh).toBe(true);
      expect(request.target_polycount).toBe(7600);
      expect(request.topology).toBe('triangle');
    } finally {
      if (existsSync(tempRoot)) {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  });

  it('audits the existing helmet as a non-modular fused runtime asset', () => {
    const audit = auditGlbAsset('low_poly_helmet.glb');

    expect(audit.nodeNames).toContain('Mesh1.0');
    expect(audit.meshCount).toBe(1);
    expect(audit.materialCount).toBe(0);
    expect(audit.triangleCount).toBeGreaterThan(0);
    expect(audit.shellFaceguardSeparable).toBe(false);
  });

  it('validates the prepared modular runtime helmet kit', () => {
    const validation = validatePreparedHelmet();
    const combined = auditGlbAsset(HELMET_COMBINED_RUNTIME_PATH);
    const shell = auditGlbAsset(HELMET_SHELL_RUNTIME_PATH);
    const faceguard = auditGlbAsset(HELMET_FACEGUARD_RUNTIME_PATH);
    const manifest = readJsonFile<{ sourceCandidate: string; totalTriangles: number }>(HELMET_MANIFEST_RUNTIME_PATH);

    expect(validation.passed).toBe(true);
    expect(validation.failures).toEqual([]);
    expect(combined.meshNames).toEqual(expect.arrayContaining(['helmet_shell', 'faceguard_standard']));
    expect(combined.materialNames).toEqual(expect.arrayContaining(['mat_helmet_shell', 'mat_faceguard']));
    expect(shell.meshNames).toEqual(['helmet_shell']);
    expect(faceguard.meshNames).toEqual(['faceguard_standard']);
    expect(combined.triangleCount).toBeLessThanOrEqual(8500);
    expect(combined.triangleCount).toBe(manifest.totalTriangles);
    expect(manifest.sourceCandidate).toMatch(/^candidate-[ab]$/);
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

  it('redacts temporary Meshy signed asset URLs from provenance', () => {
    const sanitized = sanitizeMeshyTaskPayload({
      consumed_credits: 20,
      id: 'task-id',
      model_url: 'https://assets.meshy.ai/example/model.glb?Signature=secret&Key-Pair-Id=key',
      model_urls: {
        glb: 'https://assets.meshy.ai/example/model.glb?Signature=secret',
      },
      status: 'SUCCEEDED',
    });

    expect(JSON.stringify(sanitized)).not.toMatch(/Signature=|Key-Pair-Id|assets\.meshy\.ai/);
    expect(sanitized).toMatchObject({
      consumed_credits: 20,
      id: 'task-id',
      model_url: '[redacted signed asset URL]',
      model_urls: {
        glb: '[redacted signed asset URL]',
      },
      status: 'SUCCEEDED',
    });
  });
});

function collectFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
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
