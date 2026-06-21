import { isDirectCli, validateBrandAssetPlan, type BrandImageAssetPlan } from './schemas';

const TITLE_NEGATIVE_CONSTRAINTS = [
  'No rendered text, no words, no letters, no numbers, no logos, no watermarks.',
  'No real professional or college team uniforms, logos, mascots, league marks, broadcast marks, or stadium branding.',
  'No photorealistic player likenesses, no celebrity faces, no readable signage.',
].join(' ');

const TITLE_STYLE_DIRECTION = [
  'Original stylized low-poly American-football video game title background.',
  'Cinematic broadcast presentation, twilight stadium atmosphere, regulation football field, low-poly players in fictional uniforms, dramatic clean lighting, readable central football action.',
  'Leave clean negative space for future title UI overlay and keep the image usable behind a title screen.',
].join(' ');

const EMBLEM_STYLE_DIRECTION = [
  'Original stylized low-poly American-football game emblem artwork.',
  'Contained square composition with a dark simple background, a faceted football and field-stripe motif, strong silhouette, suitable for icon cropping.',
  'Graphic but not a logo for a real team or league.',
].join(' ');

export const FOOTBALL_JS_BRAND_ASSET_PLAN: readonly BrandImageAssetPlan[] = [
  {
    assetId: 'football-js-title-01',
    category: 'title',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Wide cinematic field-level title background with player silhouettes and room for UI overlay.',
    outputFormat: 'webp',
    outputPath: 'public/branding/title/football-js-title-01.webp',
    prompt: [
      TITLE_STYLE_DIRECTION,
      'Camera: low broadcast sideline angle looking across a low-poly football field toward an end zone, ball carrier silhouette in the foreground, defenders and blockers arranged as abstract faceted shapes.',
      'Palette: rich stadium greens, charcoal stands, warm rim light, team colors are fictional and non-specific.',
      TITLE_NEGATIVE_CONSTRAINTS,
    ].join(' '),
    provisionalApproval: 'needsReview',
    quality: 'high',
    requestedSize: '1536x864',
  },
  {
    assetId: 'football-js-title-02',
    category: 'title',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Elevated title background emphasizing broadcast scale and low-poly football geometry.',
    outputFormat: 'webp',
    outputPath: 'public/branding/title/football-js-title-02.webp',
    prompt: [
      TITLE_STYLE_DIRECTION,
      'Camera: elevated three-quarter broadcast angle above the offense, faceted players at the line of scrimmage, stadium bowl hinted in the distance, football near the center as the visual anchor.',
      'Composition: clean foreground field texture, balanced room near the top-left and center for future title text.',
      TITLE_NEGATIVE_CONSTRAINTS,
    ].join(' '),
    provisionalApproval: 'needsReview',
    quality: 'high',
    requestedSize: '1536x864',
  },
  {
    assetId: 'football-js-emblem-01',
    category: 'emblem',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Square football-and-field emblem candidate for title/setup surfaces.',
    outputFormat: 'webp',
    outputPath: 'public/branding/emblem/football-js-emblem-01.webp',
    prompt: [
      EMBLEM_STYLE_DIRECTION,
      'Subject: a low-poly prolate football hovering above simplified yard-line geometry, subtle stadium-light glow, symmetrical crop-safe framing.',
      'Colors: dark navy-charcoal background, warm brown football, muted green field accents, small amber highlight.',
      'No rendered text, no words, no letters, no numbers, no logos, no watermarks, no real team or league references.',
    ].join(' '),
    provisionalApproval: 'needsReview',
    quality: 'high',
    requestedSize: '1024x1024',
  },
  {
    assetId: 'football-js-emblem-02',
    category: 'emblem',
    generationStatus: 'planned',
    model: 'gpt-image-2',
    notes: 'Square faceted helmet-and-football emblem candidate without text.',
    outputFormat: 'webp',
    outputPath: 'public/branding/emblem/football-js-emblem-02.webp',
    prompt: [
      EMBLEM_STYLE_DIRECTION,
      'Subject: an original low-poly football helmet silhouette beside a faceted football on a small field-stripe base, no team identity, no lettering, no logo mark.',
      'Keep the design centered, dark contained background, clear crop-safe edges, simple enough for a small UI emblem.',
      'No rendered text, no words, no letters, no numbers, no logos, no watermarks, no real team or league references.',
    ].join(' '),
    provisionalApproval: 'needsReview',
    quality: 'high',
    requestedSize: '1024x1024',
  },
] as const;

export function validateFootballJsBrandAssetPlan(): string[] {
  return validateBrandAssetPlan(FOOTBALL_JS_BRAND_ASSET_PLAN);
}

if (isDirectCli(import.meta.url)) {
  const validationErrors = validateFootballJsBrandAssetPlan();
  console.log(
    JSON.stringify(
      {
        assetCount: FOOTBALL_JS_BRAND_ASSET_PLAN.length,
        assets: FOOTBALL_JS_BRAND_ASSET_PLAN,
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
