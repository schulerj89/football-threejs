import { isDirectCli, normalizePathForManifest, validateBrandImageSize } from './schemas';

export type CoinFace = 'heads' | 'tails';
export type CoinSetId = 'candidate-a' | 'candidate-b';

export interface CoinImageAssetPlan {
  readonly assetId: string;
  readonly background: 'opaque';
  readonly coinSetId: CoinSetId;
  readonly face: CoinFace;
  readonly generationStatus: 'planned' | 'selected';
  readonly model: 'gpt-image-2';
  readonly notes: string;
  readonly outputFormat: 'webp';
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: 'high';
  readonly referenceAssetId?: string;
  readonly requestedSize: '1024x1024';
}

const SHARED_NEGATIVE_CONSTRAINTS = [
  'Do not include words, letters, numbers, denomination, country name, national seal, political symbol, real currency design, real team logo, league logo, watermark, or readable text.',
  'Do not include perspective distortion, angled camera, cropped coin edges, transparent background, or off-center composition.',
].join(' ');

const SHARED_TECHNICAL_DIRECTION = [
  'Opaque background.',
  'Straight top-down view.',
  'Perfectly centered circular coin.',
  'No perspective distortion.',
  'Designed as a square WebP texture for a rotating 3D coin.',
].join(' ');

const HEADS_PROMPT = [
  'Create an original ceremonial coin face for the fictional Football JS video game.',
  'Design: circular brushed-metal commemorative coin, stylized low-poly American-football helmet or helmeted player silhouette, strong raised relief, geometric ring pattern, subtle field-hash motifs, premium sports-broadcast presentation, perfectly centered, directly overhead, clean lighting.',
  SHARED_TECHNICAL_DIRECTION,
  SHARED_NEGATIVE_CONSTRAINTS,
].join(' ');

const TAILS_PROMPT = [
  'Create the matching reverse side of the same fictional Football JS ceremonial coin.',
  'Preserve identical metal, identical rim, identical lighting, identical relief depth, and identical visual style as the matching heads face.',
  'Reverse design: stylized football with prominent laces, field hash marks, subtle goalpost or stadium-light geometry, original raised-relief composition.',
  SHARED_TECHNICAL_DIRECTION,
  SHARED_NEGATIVE_CONSTRAINTS,
].join(' ');

export const FOOTBALL_JS_COIN_ASSET_PLAN: readonly CoinImageAssetPlan[] = [
  {
    assetId: 'candidate-a-heads',
    background: 'opaque',
    coinSetId: 'candidate-a',
    face: 'heads',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Candidate A heads: helmet/player relief face.',
    outputFormat: 'webp',
    outputPath: 'public/branding/coin/candidate-a-heads.webp',
    prompt: [
      HEADS_PROMPT,
      'Candidate A style: dark gunmetal silver with cool blue highlights, crisp broadcast lighting, restrained premium contrast.',
    ].join(' '),
    quality: 'high',
    requestedSize: '1024x1024',
  },
  {
    assetId: 'candidate-a-tails',
    background: 'opaque',
    coinSetId: 'candidate-a',
    face: 'tails',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Candidate A tails: matching football/laces reverse face.',
    outputFormat: 'webp',
    outputPath: 'public/branding/coin/candidate-a-tails.webp',
    prompt: [
      TAILS_PROMPT,
      'Candidate A style: match the dark gunmetal silver and cool blue highlights from candidate-a-heads.',
    ].join(' '),
    quality: 'high',
    referenceAssetId: 'candidate-a-heads',
    requestedSize: '1024x1024',
  },
  {
    assetId: 'candidate-b-heads',
    background: 'opaque',
    coinSetId: 'candidate-b',
    face: 'heads',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Candidate B heads: warmer bronze-silver helmet/player relief face.',
    outputFormat: 'webp',
    outputPath: 'public/branding/coin/candidate-b-heads.webp',
    prompt: [
      HEADS_PROMPT,
      'Candidate B style: warm brushed silver with subtle bronze accents, strong relief shadows, refined ceremonial finish.',
    ].join(' '),
    quality: 'high',
    requestedSize: '1024x1024',
  },
  {
    assetId: 'candidate-b-tails',
    background: 'opaque',
    coinSetId: 'candidate-b',
    face: 'tails',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Candidate B tails: matching football/laces reverse face.',
    outputFormat: 'webp',
    outputPath: 'public/branding/coin/candidate-b-tails.webp',
    prompt: [
      TAILS_PROMPT,
      'Candidate B style: match the warm brushed silver and subtle bronze accents from candidate-b-heads.',
    ].join(' '),
    quality: 'high',
    referenceAssetId: 'candidate-b-heads',
    requestedSize: '1024x1024',
  },
] as const;

export function validateFootballJsCoinAssetPlan(
  plan: readonly CoinImageAssetPlan[] = FOOTBALL_JS_COIN_ASSET_PLAN,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (plan.length !== 4) {
    errors.push(`Expected exactly 4 planned coin images, found ${plan.length}`);
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
    if (asset.requestedSize !== '1024x1024') {
      errors.push(`${asset.assetId}: requestedSize must be 1024x1024`);
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
    if (!/\b(no|do not include)\b.*\b(words|letters|numbers|watermark|logo)/i.test(asset.prompt)) {
      errors.push(`${asset.assetId}: prompt must explicitly prohibit text/logos/watermarks`);
    }

    errors.push(...validateCoinOutputPath(asset));
    errors.push(...validateBrandImageSize({
      assetId: asset.assetId,
      category: 'emblem',
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

  for (const setId of ['candidate-a', 'candidate-b'] as const) {
    const setAssets = plan.filter((asset) => asset.coinSetId === setId);
    if (setAssets.filter((asset) => asset.face === 'heads').length !== 1) {
      errors.push(`${setId}: expected one heads face`);
    }
    if (setAssets.filter((asset) => asset.face === 'tails').length !== 1) {
      errors.push(`${setId}: expected one tails face`);
    }
  }

  for (const tails of plan.filter((asset) => asset.face === 'tails')) {
    const reference = plan.find((asset) => asset.assetId === tails.referenceAssetId);
    if (!reference || reference.coinSetId !== tails.coinSetId || reference.face !== 'heads') {
      errors.push(`${tails.assetId}: tails reference must point to matching heads asset`);
    }
  }

  return errors;
}

export function assertValidFootballJsCoinAssetPlan(
  plan: readonly CoinImageAssetPlan[] = FOOTBALL_JS_COIN_ASSET_PLAN,
): void {
  const errors = validateFootballJsCoinAssetPlan(plan);

  if (errors.length > 0) {
    throw new Error(`Invalid coin asset plan:\n${errors.join('\n')}`);
  }
}

export function validateCoinOutputPath(asset: CoinImageAssetPlan): string[] {
  const errors: string[] = [];
  const normalizedPath = normalizePathForManifest(asset.outputPath);

  if (normalizedPath.includes('..')) {
    errors.push(`${asset.assetId}: outputPath must not contain parent traversal`);
  }
  if (!normalizedPath.startsWith('public/branding/coin/')) {
    errors.push(`${asset.assetId}: outputPath must stay under public/branding/coin`);
  }
  if (!normalizedPath.endsWith('.webp')) {
    errors.push(`${asset.assetId}: outputPath must use .webp`);
  }

  return errors;
}

if (isDirectCli(import.meta.url)) {
  const validationErrors = validateFootballJsCoinAssetPlan();
  console.log(
    JSON.stringify(
      {
        assetCount: FOOTBALL_JS_COIN_ASSET_PLAN.length,
        assets: FOOTBALL_JS_COIN_ASSET_PLAN,
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
