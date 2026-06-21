import {
  assertValidAudioPlan,
  createAudioPlanReport,
  isDirectCli,
  type AudioAssetPlan,
} from './schemas';

const SOUND_EFFECT_MODEL = 'eleven_text_to_sound_v2';
const SPEECH_MODEL = 'eleven_multilingual_v2';
const BROADCAST_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9';
const WEB_OUTPUT_FORMAT = 'mp3_44100_128';

export const FOOTBALL_AUDIO_PLAN: readonly AudioAssetPlan[] = [
  {
    assetId: 'sfx-player-footstep-turf-light',
    category: 'sfx',
    kind: 'oneShot',
    prompt: 'Short dry cleat step on synthetic football turf, close microphone, no crowd, no whistle.',
    modelId: SOUND_EFFECT_MODEL,
    requestedDurationSeconds: 0.8,
    loop: false,
    outputFormat: WEB_OUTPUT_FORMAT,
    outputPath: 'public/audio/sfx/player-footstep-turf-light.mp3',
    generationStatus: 'planned',
    maxBytes: 180_000,
    notes: 'Future locomotion one-shot variation. Not wired to runtime yet.',
  },
  {
    assetId: 'sfx-pad-contact-tight',
    category: 'sfx',
    kind: 'oneShot',
    prompt: 'Tight low-poly arcade football shoulder-pad contact pop, padded hit, short body thump, no voices.',
    modelId: SOUND_EFFECT_MODEL,
    requestedDurationSeconds: 1.1,
    loop: false,
    outputFormat: WEB_OUTPUT_FORMAT,
    outputPath: 'public/audio/sfx/pad-contact-tight.mp3',
    generationStatus: 'planned',
    maxBytes: 220_000,
    notes: 'Future tackle and block contact one-shot.',
  },
  {
    assetId: 'sfx-ball-catch-soft',
    category: 'sfx',
    kind: 'oneShot',
    prompt: 'Small leather football caught against gloves and jersey, soft snap, no crowd, no whistle.',
    modelId: SOUND_EFFECT_MODEL,
    requestedDurationSeconds: 0.9,
    loop: false,
    outputFormat: WEB_OUTPUT_FORMAT,
    outputPath: 'public/audio/sfx/ball-catch-soft.mp3',
    generationStatus: 'planned',
    maxBytes: 180_000,
    notes: 'Future pass completion one-shot.',
  },
  {
    assetId: 'crowd-loop-low-energy',
    category: 'crowd',
    kind: 'loop',
    prompt: 'Loopable low-energy outdoor football crowd bed, distant stadium murmur, no announcer, no music.',
    modelId: SOUND_EFFECT_MODEL,
    requestedDurationSeconds: 12,
    loop: true,
    outputFormat: WEB_OUTPUT_FORMAT,
    outputPath: 'public/audio/crowd/low-energy-loop.mp3',
    generationStatus: 'planned',
    maxBytes: 550_000,
    notes: 'Future ambient bed. Must be reviewed for seamless looping before approval.',
  },
  {
    assetId: 'crowd-loop-touchdown-swell',
    category: 'crowd',
    kind: 'loop',
    prompt: 'Loopable football crowd touchdown swell with excited cheers, no specific team chant, no announcer.',
    modelId: SOUND_EFFECT_MODEL,
    requestedDurationSeconds: 8,
    loop: true,
    outputFormat: WEB_OUTPUT_FORMAT,
    outputPath: 'public/audio/crowd/touchdown-swell-loop.mp3',
    generationStatus: 'planned',
    maxBytes: 420_000,
    notes: 'Future scoring ambience layer.',
  },
  {
    assetId: 'announcer-touchdown-clean',
    category: 'announcer',
    kind: 'speech',
    script: 'Touchdown. He found the crease and finished the drive.',
    modelId: SPEECH_MODEL,
    voiceId: BROADCAST_VOICE_ID,
    requestedDurationSeconds: 3,
    loop: false,
    outputFormat: WEB_OUTPUT_FORMAT,
    outputPath: 'public/audio/announcer/touchdown-clean.mp3',
    generationStatus: 'planned',
    maxBytes: 260_000,
    notes: 'Original generic line. Caption must match this exact script.',
  },
  {
    assetId: 'announcer-sack-clean',
    category: 'announcer',
    kind: 'speech',
    script: 'Pressure gets home. The quarterback is down behind the line.',
    modelId: SPEECH_MODEL,
    voiceId: BROADCAST_VOICE_ID,
    requestedDurationSeconds: 3.5,
    loop: false,
    outputFormat: WEB_OUTPUT_FORMAT,
    outputPath: 'public/audio/announcer/sack-clean.mp3',
    generationStatus: 'planned',
    maxBytes: 280_000,
    notes: 'Original generic line for sack result. No named teams or players.',
  },
] as const;

export function getFootballAudioPlan(): readonly AudioAssetPlan[] {
  return FOOTBALL_AUDIO_PLAN;
}

export function validateFootballAudioPlan(): string[] {
  try {
    assertValidAudioPlan(FOOTBALL_AUDIO_PLAN);
    return [];
  } catch (error) {
    return error instanceof Error ? error.message.split('\n').slice(1) : ['Unknown audio plan error'];
  }
}

if (isDirectCli(import.meta.url)) {
  assertValidAudioPlan(FOOTBALL_AUDIO_PLAN);
  console.log(JSON.stringify(createAudioPlanReport(FOOTBALL_AUDIO_PLAN), null, 2));
}
