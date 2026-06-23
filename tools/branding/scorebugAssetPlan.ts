import { isDirectCli, normalizePathForManifest, validateBrandImageSize } from './schemas';

export type ScorebugCandidateId = 'candidate-a' | 'candidate-b' | 'candidate-c';

export interface ScorebugImageAssetPlan {
  readonly assetId: string;
  readonly background: 'opaque';
  readonly candidateId: ScorebugCandidateId;
  readonly generationStatus: 'planned' | 'selected';
  readonly model: 'gpt-image-2';
  readonly notes: string;
  readonly outputFormat: 'webp';
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: 'high';
  readonly requestedSize: '1536x512';
}

const SCOREBUG_SHARED_DIRECTION = [
  'Create an original broadcast scorebug shell for a fictional low-poly college-football video game named Football JS.',
  'Format: wide horizontal 3:1 source image designed for a top-of-screen football broadcast scorebug; the visible scorebug shell should be a centered, low-height band with minimal black padding.',
  'Use a dark charcoal and metallic-neutral base, subtle angular low-poly geometry, and polished modern sports-broadcast presentation.',
  'Build the shell on a strict symmetrical grid from left to right: one circular logo well, one abbreviation panel, one large score well, one small central quarter/clock panel, one large score well, one abbreviation panel, and one circular logo well.',
  'The left and right halves must be mirror-balanced with equal logo-well sizes, equal score-well sizes, equal abbreviation-panel sizes, and equal vertical alignment.',
  'Leave clean blank horizontal timeout/status rails below each score well; do not draw pips, hashes, bars, or placeholder marks inside those timeout rails.',
  'Add one clean lower context strip with three blank readable compartments for possession, down and distance, and ball location.',
  'Keep restrained highlight edges and high readability over a bright football field.',
  'Make the shell flexible enough for any team colors.',
  'Straight-on 2D presentation, no perspective, opaque background.',
].join(' ');

const SCOREBUG_NEGATIVE_DIRECTION = [
  'Do not include words, letters, numbers, scores, clock text, team logos, team colors, timeout dots, timeout bars, decorative pips, possession arrows, network logo, television-brand mark, ESPN, FOX, CBS, NBC, EA, Madden, NCAA, CFB references, mock player data, perspective tilt, watermark, or busy gradients that make overlay text unreadable.',
  'The final runtime will overlay all text and logos through HTML, so leave every label and score area blank.',
].join(' ');

export const FOOTBALL_JS_SCOREBUG_ASSET_PLAN: readonly ScorebugImageAssetPlan[] = [
  {
    assetId: 'candidate-a',
    background: 'opaque',
    candidateId: 'candidate-a',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Clean symmetric angular package with blank timeout rails.',
    outputFormat: 'webp',
    outputPath: 'public/branding/scorebug/candidate-a.webp',
    prompt: [
      SCOREBUG_SHARED_DIRECTION,
      'Candidate A variation: clean contemporary angular package with crisp beveled panels, subtle metallic layering, high symmetry, and neutral broadcast polish.',
      SCOREBUG_NEGATIVE_DIRECTION,
    ].join(' '),
    quality: 'high',
    requestedSize: '1536x512',
  },
  {
    assetId: 'candidate-b',
    background: 'opaque',
    candidateId: 'candidate-b',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Retro-console influence with symmetric blank wells.',
    outputFormat: 'webp',
    outputPath: 'public/branding/scorebug/candidate-b.webp',
    prompt: [
      SCOREBUG_SHARED_DIRECTION,
      'Candidate B variation: slightly retro 1990s-console influence with modern polish, chunky but symmetric panel rhythm, restrained scanline-inspired details, and clean modern material finish.',
      SCOREBUG_NEGATIVE_DIRECTION,
    ].join(' '),
    quality: 'high',
    requestedSize: '1536x512',
  },
  {
    assetId: 'candidate-c',
    background: 'opaque',
    candidateId: 'candidate-c',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Minimal stadium-board design with maximum overlay clarity.',
    outputFormat: 'webp',
    outputPath: 'public/branding/scorebug/candidate-c.webp',
    prompt: [
      SCOREBUG_SHARED_DIRECTION,
      'Candidate C variation: minimal stadium-board design, broad readable dark panels, thin metallic dividers, restrained low-poly texture, and generous clean safe zones for live overlay text.',
      SCOREBUG_NEGATIVE_DIRECTION,
    ].join(' '),
    quality: 'high',
    requestedSize: '1536x512',
  },
] as const;

export function validateFootballJsScorebugAssetPlan(
  plan: readonly ScorebugImageAssetPlan[] = FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (plan.length !== 3) {
    errors.push(`Expected exactly 3 planned scorebug shell images, found ${plan.length}`);
  }

  for (const asset of plan) {
    if (ids.has(asset.assetId)) {
      errors.push(`${asset.assetId}: duplicate asset ID`);
    }
    ids.add(asset.assetId);

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(asset.assetId)) {
      errors.push(`${asset.assetId}: assetId must be stable lowercase with hyphen or underscore separators`);
    }
    if (asset.model !== 'gpt-image-2') {
      errors.push(`${asset.assetId}: model must be gpt-image-2`);
    }
    if (asset.requestedSize !== '1536x512') {
      errors.push(`${asset.assetId}: requestedSize must be 1536x512`);
    }
    if (asset.quality !== 'high') {
      errors.push(`${asset.assetId}: quality must be high`);
    }
    if (asset.outputFormat !== 'webp') {
      errors.push(`${asset.assetId}: outputFormat must be webp`);
    }
    if (asset.background !== 'opaque') {
      errors.push(`${asset.assetId}: background must be opaque`);
    }
    if (!asset.prompt.trim()) {
      errors.push(`${asset.assetId}: prompt is required`);
    }
    if (!/\b(do not include|no)\b.*\b(words|letters|numbers|scores|logos|watermark)/i.test(asset.prompt)) {
      errors.push(`${asset.assetId}: prompt must explicitly prohibit text/logos/scores/watermarks`);
    }

    errors.push(...validateScorebugOutputPath(asset));
    errors.push(...validateBrandImageSize({
      assetId: asset.assetId,
      category: 'title',
      generationStatus: asset.generationStatus,
      model: asset.model,
      outputFormat: asset.outputFormat,
      outputPath: asset.outputPath,
      prompt: asset.prompt,
      provisionalApproval: 'needsReview',
      quality: asset.quality,
      requestedSize: asset.requestedSize,
    }));
  }

  for (const candidateId of ['candidate-a', 'candidate-b', 'candidate-c'] as const) {
    if (plan.filter((asset) => asset.candidateId === candidateId).length !== 1) {
      errors.push(`${candidateId}: expected exactly one scorebug shell`);
    }
  }

  return errors;
}

export function assertValidFootballJsScorebugAssetPlan(
  plan: readonly ScorebugImageAssetPlan[] = FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
): void {
  const errors = validateFootballJsScorebugAssetPlan(plan);

  if (errors.length > 0) {
    throw new Error(`Invalid scorebug asset plan:\n${errors.join('\n')}`);
  }
}

export function validateScorebugOutputPath(asset: ScorebugImageAssetPlan): string[] {
  const errors: string[] = [];
  const normalizedPath = normalizePathForManifest(asset.outputPath);

  if (normalizedPath.includes('..')) {
    errors.push(`${asset.assetId}: outputPath must not contain parent traversal`);
  }
  if (!normalizedPath.startsWith('public/branding/scorebug/')) {
    errors.push(`${asset.assetId}: outputPath must stay under public/branding/scorebug`);
  }
  if (!normalizedPath.endsWith('.webp')) {
    errors.push(`${asset.assetId}: outputPath must use .webp`);
  }

  return errors;
}

if (isDirectCli(import.meta.url)) {
  const validationErrors = validateFootballJsScorebugAssetPlan();
  console.log(
    JSON.stringify(
      {
        assetCount: FOOTBALL_JS_SCOREBUG_ASSET_PLAN.length,
        assets: FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
        validationErrors,
      },
      null,
      2,
    ),
  );
  if (validationErrors.length > 0) {
    process.exitCode = 1;
  }
}
