import {
  PLAYER_GENERATED_DIR,
  PLAYER_REFERENCE_DIR,
  PLAYER_RIGGED_DIR,
  assertValidPlayerPlan,
  isDirectCli,
  validatePlayerPlan,
  type PlayerCandidatePlan,
  type PlayerReferenceImagePlan,
  type PlayerReferenceView,
} from './schemas';

const CHARACTER_DIRECTION = [
  'Create one orthographic reference view for the same stylized low-poly athletic male American-football video-game body.',
  'The character uses chunky PS1-inspired proportions with a clean humanoid silhouette and a neutral A-pose.',
  'He wears a tight generic practice uniform: medium-gray jersey, darker pants, neutral shoes, and visible skin.',
  'The arms and legs are clearly separated from the torso and from each other.',
  'Use simple mitten-style hands, simplified face, simple ears, and no hair extending far from the head.',
  'Do not include helmet, football, shoulder pads, pads integrated into the body, logo, text, jersey number, scenery, cast shadow, watermark, or readable marks.',
  'Use neutral flat lighting, opaque white background, centered full body, same apparent scale across views, feet on the ground line, and no perspective distortion.',
].join(' ');

const TEXTURE_DIRECTION = [
  'Simple neutral temporary humanoid texture for rigging.',
  'Medium-gray practice jersey, darker charcoal pants, neutral shoes, visible skin on head and hands.',
  'No baked highlights, no numbers, no logos, no team marks, no text.',
].join(' ');

const VIEW_PROMPTS: Record<PlayerReferenceView, string> = {
  back: 'Back orthographic view. The shoulder width, hip width, arm separation, leg separation, and shoe placement match the same front-view character.',
  front: 'Front orthographic view. The simplified face is visible, arms are slightly away from the torso in A-pose, and both legs are separated.',
  left: 'Left orthographic side view. The character faces toward the viewer right side of the image, with the same A-pose and full-body scale.',
  right: 'Right orthographic side view. Mirror the left view exactly in proportions, clothing, scale, and lighting.',
};

const CANDIDATE_STYLE: Record<'candidate-a' | 'candidate-b', string> = {
  'candidate-a': 'Candidate A style: clean athletic build, broad shoulders, compact torso, readable forearms and calves, browser-game low-poly planes.',
  'candidate-b': 'Candidate B style: slightly stockier running-back build, squared shoulders, strong legs, same neutral uniform and low-poly PS1 silhouette.',
};

export const FOOTBALL_PLAYER_REFERENCE_PLAN: readonly PlayerReferenceImagePlan[] = createReferencePlan();

export const FOOTBALL_PLAYER_CANDIDATE_PLAN: readonly PlayerCandidatePlan[] = [
  {
    aiModel: 'latest',
    assetId: 'candidate-a',
    autoSize: true,
    enablePbr: false,
    generationStatus: 'planned',
    hdTexture: false,
    imageEnhancement: false,
    multiViewThumbnails: true,
    notes: 'Primary PS1-inspired athletic body candidate for rigged player exploration.',
    originAt: 'bottom',
    outputPath: `${PLAYER_GENERATED_DIR}/candidate-a.glb`,
    poseMode: 'a-pose',
    removeLighting: true,
    riggedFbxOutputPath: `${PLAYER_RIGGED_DIR}/candidate-a.fbx`,
    riggedGlbOutputPath: `${PLAYER_RIGGED_DIR}/candidate-a.glb`,
    shouldRemesh: true,
    shouldTexture: true,
    targetFormats: ['glb'],
    targetPolycount: 7000,
    texturePrompt: TEXTURE_DIRECTION,
    topology: 'triangle',
  },
  {
    aiModel: 'latest',
    assetId: 'candidate-b',
    autoSize: true,
    enablePbr: false,
    generationStatus: 'planned',
    hdTexture: false,
    imageEnhancement: false,
    multiViewThumbnails: true,
    notes: 'Alternate stockier low-poly athletic body candidate if candidate A fails rigging or silhouette checks.',
    originAt: 'bottom',
    outputPath: `${PLAYER_GENERATED_DIR}/candidate-b.glb`,
    poseMode: 'a-pose',
    removeLighting: true,
    riggedFbxOutputPath: `${PLAYER_RIGGED_DIR}/candidate-b.fbx`,
    riggedGlbOutputPath: `${PLAYER_RIGGED_DIR}/candidate-b.glb`,
    shouldRemesh: true,
    shouldTexture: true,
    targetFormats: ['glb'],
    targetPolycount: 7000,
    texturePrompt: TEXTURE_DIRECTION,
    topology: 'triangle',
  },
] as const;

export function assertValidFootballPlayerGenerationPlan(): void {
  assertValidPlayerPlan(FOOTBALL_PLAYER_REFERENCE_PLAN, FOOTBALL_PLAYER_CANDIDATE_PLAN);
}

function createReferencePlan(): PlayerReferenceImagePlan[] {
  const plan: PlayerReferenceImagePlan[] = [];
  for (const candidateId of ['candidate-a', 'candidate-b'] as const) {
    for (const view of ['front', 'right', 'back', 'left'] as const) {
      plan.push({
        assetId: `${candidateId}-${view}`,
        candidateId,
        model: 'gpt-image-2',
        outputFormat: 'png',
        outputPath: `${PLAYER_REFERENCE_DIR}/${candidateId}-${view}.png`,
        prompt: [
          CHARACTER_DIRECTION,
          CANDIDATE_STYLE[candidateId],
          VIEW_PROMPTS[view],
          'Output one opaque square PNG image. No text, no logo, no numbers, no watermark.',
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
  const validationErrors = validatePlayerPlan(
    FOOTBALL_PLAYER_REFERENCE_PLAN,
    FOOTBALL_PLAYER_CANDIDATE_PLAN,
  );
  console.log(
    JSON.stringify(
      {
        candidateCount: FOOTBALL_PLAYER_CANDIDATE_PLAN.length,
        candidates: FOOTBALL_PLAYER_CANDIDATE_PLAN,
        referenceCount: FOOTBALL_PLAYER_REFERENCE_PLAN.length,
        references: FOOTBALL_PLAYER_REFERENCE_PLAN,
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
