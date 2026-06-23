import {
  HELMET_GENERATED_DIR,
  HELMET_REFERENCE_DIR,
  assertValidHelmetPlan,
  isDirectCli,
  validateHelmetPlan,
  type HelmetCandidatePlan,
  type HelmetReferenceImagePlan,
  type HelmetReferenceView,
} from './schemas';

const DESIGN_DIRECTION = [
  'Create a stylized modern American-football helmet reference for a modular 3D asset pipeline.',
  'The helmet has a slightly exaggerated low-poly silhouette suitable for a stylized browser football game.',
  'Show only the helmet shell and compact modern faceguard.',
  'The shell is neutral white or very light gray.',
  'The faceguard is dark charcoal.',
  'The background is plain contrasting medium gray.',
  'Depict the shell and faceguard as visually separate parts with a tiny non-contact gap at the mounting areas.',
  'Use a rounded shell, readable ear opening, clear lower shell edge, complete rear shell profile, and thick faceguard bars.',
  'Do not include a player head, neck, body, football, chinstrap, loose straps, padding, screws, visor, mouthguard, logo, lettering, numbers, decals, team marks, scenery, shadows, watermark, or readable text.',
  'Keep the helmet centered, isolated, orthographic, and at the same apparent scale as the other views in the set.',
].join(' ');

const VIEW_PROMPTS: Record<HelmetReferenceView, string> = {
  back: 'Back orthographic view. The rear shell is complete and rounded, with no faceguard visible except tiny side mounting hints.',
  front: 'Front orthographic view. The face opening and compact faceguard are centered and symmetrical, with thick bars and clear separation from the shell.',
  left: 'Left orthographic side view. The faceguard projects forward on the helmet front, the ear opening is readable, and the shell rear is complete.',
  right: 'Right orthographic side view. Mirror the left view exactly in design language, scale, and lighting.',
};

const CANDIDATE_STYLE: Record<'candidate-a' | 'candidate-b', string> = {
  'candidate-a': 'Candidate A style: clean broadcast-game silhouette, smooth white shell, charcoal facemask, crisp low-poly planes, neutral studio lighting.',
  'candidate-b': 'Candidate B style: slightly more angular low-poly crown and brow, smooth white shell, charcoal facemask, strong readable football silhouette.',
};

export const FOOTBALL_HELMET_REFERENCE_PLAN: readonly HelmetReferenceImagePlan[] = createReferencePlan();

export const FOOTBALL_HELMET_CANDIDATE_PLAN: readonly HelmetCandidatePlan[] = [
  {
    aiModel: 'latest',
    assetId: 'candidate-a',
    enablePbr: false,
    generationStatus: 'planned',
    imageEnhancement: false,
    notes: 'Primary clean modern shell and standard faceguard candidate.',
    outputPath: `${HELMET_GENERATED_DIR}/candidate-a.glb`,
    removeLighting: true,
    savePreRemeshedModel: true,
    shouldRemesh: true,
    shouldTexture: false,
    targetFormats: ['glb'],
    targetPolycount: 7600,
    topology: 'triangle',
  },
  {
    aiModel: 'latest',
    assetId: 'candidate-b',
    enablePbr: false,
    generationStatus: 'planned',
    imageEnhancement: false,
    notes: 'Alternate angular low-poly shell and standard faceguard candidate.',
    outputPath: `${HELMET_GENERATED_DIR}/candidate-b.glb`,
    removeLighting: true,
    savePreRemeshedModel: true,
    shouldRemesh: true,
    shouldTexture: false,
    targetFormats: ['glb'],
    targetPolycount: 7600,
    topology: 'triangle',
  },
] as const;

export function assertValidFootballHelmetGenerationPlan(): void {
  assertValidHelmetPlan(FOOTBALL_HELMET_REFERENCE_PLAN, FOOTBALL_HELMET_CANDIDATE_PLAN);
}

function createReferencePlan(): HelmetReferenceImagePlan[] {
  const plan: HelmetReferenceImagePlan[] = [];
  for (const candidateId of ['candidate-a', 'candidate-b'] as const) {
    for (const view of ['front', 'right', 'back', 'left'] as const) {
      plan.push({
        assetId: `${candidateId}-${view}`,
        candidateId,
        model: 'gpt-image-2',
        outputFormat: 'webp',
        outputPath: `${HELMET_REFERENCE_DIR}/${candidateId}-${view}.webp`,
        prompt: [
          DESIGN_DIRECTION,
          CANDIDATE_STYLE[candidateId],
          VIEW_PROMPTS[view],
          'Output an opaque square WebP-ready image. No text, no logo, no numbers, no watermark.',
        ].join(' '),
        quality: 'high',
        requestedSize: '1024x1024',
        view,
      });
    }
  }
  return plan;
}

if (isDirectCli(import.meta.url)) {
  const validationErrors = validateHelmetPlan(
    FOOTBALL_HELMET_REFERENCE_PLAN,
    FOOTBALL_HELMET_CANDIDATE_PLAN,
  );
  console.log(
    JSON.stringify(
      {
        candidateCount: FOOTBALL_HELMET_CANDIDATE_PLAN.length,
        candidates: FOOTBALL_HELMET_CANDIDATE_PLAN,
        referenceCount: FOOTBALL_HELMET_REFERENCE_PLAN.length,
        references: FOOTBALL_HELMET_REFERENCE_PLAN,
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
