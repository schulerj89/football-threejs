import {
  assertValidAudioPlan,
  createAudioPlanReport,
  isDirectCli,
  type AudioAssetPlan,
} from './schemas';

export const FOOTBALL_TITLE_MUSIC_MODEL_ID = 'music_v2';
export const FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT = 'mp3_48000_192';
export const FOOTBALL_TITLE_MUSIC_DURATION_SECONDS = 75;
export const FOOTBALL_TITLE_MUSIC_DURATION_MS = FOOTBALL_TITLE_MUSIC_DURATION_SECONDS * 1000;

const BASE_DIRECTION = [
  'Create an original instrumental title theme for Football JS, a stylized low-poly American-football video game.',
  'Energetic American stadium-sports atmosphere, marching snare cadence, powerful bass drum, bold original brass fanfare, low brass and horns, cymbal swells, tom fills, restrained electric-guitar accents, cinematic low-end support, memorable original main motif, heroic, competitive, anticipatory, polished modern game-menu production.',
  'Structure: 0-7 seconds has a recognizable opening fanfare suitable for a game title reveal; 7-55 seconds is an energetic main title section with a strong repeatable motif; 55-75 seconds is a controlled reprise that can transition naturally back toward the beginning.',
  'Tempo approximately 108-120 BPM.',
  'No vocals, no spoken words, no chants, no announcers, no crowd audio, no real fight-song melodies, no real team melodies, no artist references, no song-title references, no copyrighted motifs, no comedy or novelty-band style, no excessive distortion, no trailer-style sound effects covering the music.',
].join(' ');

export const FOOTBALL_TITLE_MUSIC_PLAN: readonly AudioAssetPlan[] = [
  {
    assetId: 'football-js-title-a',
    category: 'music',
    generationStatus: 'planned',
    kind: 'music',
    loop: true,
    maxBytes: 2_500_000,
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Candidate A: brass and marching percussion dominant.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-title-a.mp3',
    prompt: [
      BASE_DIRECTION,
      'Candidate A variation: make brass fanfare and marching percussion the dominant identity. Snare cadence, bass drum, and low brass should carry the hook. Keep electric guitar minimal and supportive.',
    ].join(' '),
    requestedDurationSeconds: FOOTBALL_TITLE_MUSIC_DURATION_SECONDS,
    runtimeLoadingStrategy: 'stream',
  },
  {
    assetId: 'football-js-title-b',
    category: 'music',
    generationStatus: 'planned',
    kind: 'music',
    loop: true,
    maxBytes: 2_500_000,
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Candidate B: cinematic orchestra with marching percussion.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-title-b.mp3',
    prompt: [
      BASE_DIRECTION,
      'Candidate B variation: lean into cinematic orchestra, low strings, horns, and marching percussion. Keep the motif bold and game-menu ready without becoming a movie-trailer cue.',
    ].join(' '),
    requestedDurationSeconds: FOOTBALL_TITLE_MUSIC_DURATION_SECONDS,
    runtimeLoadingStrategy: 'stream',
  },
  {
    assetId: 'football-js-title-c',
    category: 'music',
    generationStatus: 'planned',
    kind: 'music',
    loop: true,
    maxBytes: 2_500_000,
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Candidate C: brass, marching percussion, and restrained modern electric-guitar energy.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-title-c.mp3',
    prompt: [
      BASE_DIRECTION,
      'Candidate C variation: combine bold brass and marching percussion with restrained modern electric-guitar accents. Keep the guitar rhythmic and supportive, not distorted or dominant.',
    ].join(' '),
    requestedDurationSeconds: FOOTBALL_TITLE_MUSIC_DURATION_SECONDS,
    runtimeLoadingStrategy: 'stream',
  },
] as const;

export function validateFootballTitleMusicPlan(): string[] {
  try {
    assertValidAudioPlan(FOOTBALL_TITLE_MUSIC_PLAN);
    return [];
  } catch (error) {
    return error instanceof Error ? error.message.split('\n').slice(1) : ['Unknown music plan error'];
  }
}

if (isDirectCli(import.meta.url)) {
  assertValidAudioPlan(FOOTBALL_TITLE_MUSIC_PLAN);
  console.log(JSON.stringify(createAudioPlanReport(FOOTBALL_TITLE_MUSIC_PLAN), null, 2));
}
