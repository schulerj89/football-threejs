import { isDirectCli, normalizePathForManifest, validateBrandImageSize } from './schemas';

export type PlayArtCandidateId = 'candidate-a' | 'candidate-b' | 'candidate-c';

export interface PlayArtImageAssetPlan {
  readonly assetId: string;
  readonly background: 'opaque';
  readonly candidateId: PlayArtCandidateId;
  readonly generationStatus: 'planned' | 'selected';
  readonly model: 'gpt-image-2';
  readonly notes: string;
  readonly outputFormat: 'webp';
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: 'high';
  readonly referenceImagePath: string;
  readonly requestedSize: '1472x896';
}

const PLAY_ART_REFERENCE_DIRECTION = [
  'Use the optional attached screenshot only as context for what the current Football JS play cards look like: a centered tray of six small SVG football play diagrams with routes, blockers, markers, and arrows.',
  'The current issue is that the diagrams feel flat, cramped, and visually raw.',
  'Create only a polished blank play-diagram board/background that the game can place exact SVG route and blocking overlays on top of.',
  'Do not redraw, interpret, simplify, or bake in any specific play route from the screenshot.',
].join(' ');

const PLAY_ART_SHARED_DIRECTION = [
  'Create an original Football JS tactical play-call diagram background for a stylized low-poly American-football video game.',
  'Asset use: one reusable background image behind exact runtime SVG route art inside a play-card diagram.',
  'Composition: wide landscape play-board rectangle matching a 184:112 football play-card aspect ratio, straight-on 2D view, no perspective tilt, no camera angle.',
  'Visual language: polished modern football broadcast telestrator board, dark synthetic turf surface, subtle yard-line grid, faint hash marks, restrained field texture, low-poly angular edge accents, clean readable central field area.',
  'The middle 80 percent must remain uncluttered so white/yellow/blue SVG routes, blocking lines, player markers, and arrowheads remain readable.',
  'Add tasteful vignette, subtle bevels, soft inner shadow, and very light worn-turf texture without busy noise.',
  'Use dark emerald, charcoal, slate, and muted broadcast-metal neutrals; keep contrast high for light route overlays.',
  'Opaque WebP, no transparency required.',
].join(' ');

const PLAY_ART_NEGATIVE_DIRECTION = [
  'Do not include words, letters, numbers, play names, team names, logos, real brands, network marks, EA, Madden, NCAA, ESPN, FOX, CBS, NBC, CFB references, watermark, UI buttons, scorebug graphics, player names, jersey numbers, route arrows, route lines, blocking lines, X-and-O symbols, circles, triangles, player dots, football icons, ball markers, or any baked play-specific diagram elements.',
  'Do not create a busy illustrated football field that would hide runtime SVG art.',
  'Leave the board blank enough for exact runtime overlays.',
].join(' ');

export const FOOTBALL_JS_PLAY_ART_ASSET_PLAN: readonly PlayArtImageAssetPlan[] = [
  {
    assetId: 'candidate-a',
    background: 'opaque',
    candidateId: 'candidate-a',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Modern broadcast telestrator board with dark turf and clean overlay room.',
    outputFormat: 'webp',
    outputPath: 'public/branding/play-art/candidate-a.webp',
    prompt: [
      PLAY_ART_REFERENCE_DIRECTION,
      PLAY_ART_SHARED_DIRECTION,
      'Candidate A variation: clean contemporary broadcast telestrator board, crisp beveled card edges, subtle premium sports UI finish, very clean center field.',
      PLAY_ART_NEGATIVE_DIRECTION,
    ].join(' '),
    quality: 'high',
    referenceImagePath: 'public/branding/play-art/current-play-svg-context.png',
    requestedSize: '1472x896',
  },
  {
    assetId: 'candidate-b',
    background: 'opaque',
    candidateId: 'candidate-b',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Chalkboard/telestrator hybrid with field texture and restrained console style.',
    outputFormat: 'webp',
    outputPath: 'public/branding/play-art/candidate-b.webp',
    prompt: [
      PLAY_ART_REFERENCE_DIRECTION,
      PLAY_ART_SHARED_DIRECTION,
      'Candidate B variation: tactical chalkboard meets modern broadcast, faint chalk-smudge texture, subtle sideline hash rhythm, controlled retro-console influence, no actual chalk route markings.',
      PLAY_ART_NEGATIVE_DIRECTION,
    ].join(' '),
    quality: 'high',
    referenceImagePath: 'public/branding/play-art/current-play-svg-context.png',
    requestedSize: '1472x896',
  },
  {
    assetId: 'candidate-c',
    background: 'opaque',
    candidateId: 'candidate-c',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Minimal stadium-board panel with strongest route-overlay readability.',
    outputFormat: 'webp',
    outputPath: 'public/branding/play-art/candidate-c.webp',
    prompt: [
      PLAY_ART_REFERENCE_DIRECTION,
      PLAY_ART_SHARED_DIRECTION,
      'Candidate C variation: minimal stadium-board design, smooth dark field plate, fine horizontal yard bands, broad clean overlay safe area, quiet metallic frame, maximum contrast for route art.',
      PLAY_ART_NEGATIVE_DIRECTION,
    ].join(' '),
    quality: 'high',
    referenceImagePath: 'public/branding/play-art/current-play-svg-context.png',
    requestedSize: '1472x896',
  },
] as const;

export function validateFootballJsPlayArtAssetPlan(
  plan: readonly PlayArtImageAssetPlan[] = FOOTBALL_JS_PLAY_ART_ASSET_PLAN,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (plan.length !== 3) {
    errors.push(`Expected exactly 3 planned play-art images, found ${plan.length}`);
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
    if (asset.requestedSize !== '1472x896') {
      errors.push(`${asset.assetId}: requestedSize must be 1472x896`);
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
    if (!/Do not include.*route arrows.*route lines.*player dots/is.test(asset.prompt)) {
      errors.push(`${asset.assetId}: prompt must prohibit baked route and player-marker graphics`);
    }
    if (normalizePathForManifest(asset.referenceImagePath) !== 'public/branding/play-art/current-play-svg-context.png') {
      errors.push(`${asset.assetId}: referenceImagePath must point to the current play-art screenshot context`);
    }

    errors.push(...validatePlayArtOutputPath(asset));
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
      errors.push(`${candidateId}: expected exactly one play-art candidate`);
    }
  }

  return errors;
}

export function assertValidFootballJsPlayArtAssetPlan(
  plan: readonly PlayArtImageAssetPlan[] = FOOTBALL_JS_PLAY_ART_ASSET_PLAN,
): void {
  const errors = validateFootballJsPlayArtAssetPlan(plan);

  if (errors.length > 0) {
    throw new Error(`Invalid play-art asset plan:\n${errors.join('\n')}`);
  }
}

export function validatePlayArtOutputPath(asset: PlayArtImageAssetPlan): string[] {
  const errors: string[] = [];
  const normalizedPath = normalizePathForManifest(asset.outputPath);

  if (normalizedPath.includes('..')) {
    errors.push(`${asset.assetId}: outputPath must not contain parent traversal`);
  }
  if (!normalizedPath.startsWith('public/branding/play-art/')) {
    errors.push(`${asset.assetId}: outputPath must stay under public/branding/play-art`);
  }
  if (!normalizedPath.endsWith('.webp')) {
    errors.push(`${asset.assetId}: outputPath must use .webp`);
  }

  return errors;
}

if (isDirectCli(import.meta.url)) {
  const validationErrors = validateFootballJsPlayArtAssetPlan();
  console.log(
    JSON.stringify(
      {
        assetCount: FOOTBALL_JS_PLAY_ART_ASSET_PLAN.length,
        assets: FOOTBALL_JS_PLAY_ART_ASSET_PLAN,
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
