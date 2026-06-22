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
export const FOOTBALL_SOUND_EFFECTS_MODEL_ID = 'eleven_text_to_sound_v2';
export const FOOTBALL_CHANT_OUTPUT_FORMAT = 'mp3_44100_128';
export const FOOTBALL_MUSIC_COMPOSER_DISPLAY = 'Football JS Original Soundtrack';

export type MusicCatalogCategory = 'chant' | 'menu' | 'stinger';
export type MusicEnergyLevel = 'medium' | 'high' | 'peak';

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

const MENU_TRACK_DIRECTION = [
  'Create original instrumental menu music for Football JS, a stylized low-poly American-football video game.',
  'The track should share a cohesive stadium-sports identity with the main Football JS title theme while being a distinct composition.',
  'Use marching percussion, snare cadence, bass drum, brass or cinematic orchestra, bold low brass, cymbal swells, tom fills, heroic competitive energy, and polished modern game-menu production.',
  'Design the ending so it can loop or transition cleanly back to the opening.',
  'No vocals, no spoken words, no crowd chants, no announcers, no real fight-song melodies, no real team references, no artist references, no song-title references, no copyrighted motifs.',
].join(' ');

export const FOOTBALL_MENU_PLAYLIST_PLAN: readonly AudioAssetPlan[] = [
  {
    assetId: 'football-js-saturday-lights',
    category: 'music',
    generationStatus: 'planned',
    kind: 'music',
    loop: true,
    maxBytes: 2_400_000,
    metadata: {
      catalogCategory: 'menu',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Saturday Lights',
      energyLevel: 'high',
      transitionPurpose: 'menu-playlist',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Menu playlist track: brass-forward stadium energy with marching percussion.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-saturday-lights.mp3',
    prompt: [
      MENU_TRACK_DIRECTION,
      'Track identity: Saturday Lights. Brass-forward stadium sports theme, crisp marching snare, strong bass drum, bright horn calls, confident game-night lift, memorable original motif, approximately 78 seconds.',
    ].join(' '),
    requestedDurationSeconds: 78,
    runtimeLoadingStrategy: 'stream',
  },
  {
    assetId: 'football-js-stadium-horizon',
    category: 'music',
    generationStatus: 'planned',
    kind: 'music',
    loop: true,
    maxBytes: 2_500_000,
    metadata: {
      catalogCategory: 'menu',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Stadium Horizon',
      energyLevel: 'medium',
      transitionPurpose: 'menu-playlist',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Menu playlist track: cinematic orchestra and marching percussion.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-stadium-horizon.mp3',
    prompt: [
      MENU_TRACK_DIRECTION,
      'Track identity: Stadium Horizon. Cinematic orchestra, warm horns, low strings, measured marching percussion, broad anticipatory sports-broadcast tone, uplifting but controlled, approximately 82 seconds.',
    ].join(' '),
    requestedDurationSeconds: 82,
    runtimeLoadingStrategy: 'stream',
  },
  {
    assetId: 'football-js-drive-to-glory',
    category: 'music',
    generationStatus: 'planned',
    kind: 'music',
    loop: true,
    maxBytes: 2_600_000,
    metadata: {
      catalogCategory: 'menu',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Drive to Glory',
      energyLevel: 'peak',
      transitionPurpose: 'menu-playlist',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Menu playlist track: brass, marching percussion, and restrained modern guitar.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-drive-to-glory.mp3',
    prompt: [
      MENU_TRACK_DIRECTION,
      'Track identity: Drive to Glory. Brass fanfare, marching percussion, tom fills, restrained modern electric-guitar pulse, heroic competitive lift, no heavy distortion, approximately 86 seconds.',
    ].join(' '),
    requestedDurationSeconds: 86,
    runtimeLoadingStrategy: 'stream',
  },
] as const;

const STINGER_DIRECTION = [
  'Create an original short instrumental Football JS transition stinger.',
  'Use the same fictional stadium-sports musical identity as the title theme: brass, marching percussion, cinematic low-end support, cymbal lift, and a clear musical ending.',
  'No vocals, no spoken words, no crowd chant, no announcer, no real fight-song melody, no real team reference, no artist reference, no copyrighted motif.',
].join(' ');

export const FOOTBALL_TRANSITION_STINGER_PLAN: readonly AudioAssetPlan[] = [
  {
    assetId: 'football-js-stinger-matchup-reveal',
    category: 'music',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 260_000,
    metadata: {
      catalogCategory: 'stinger',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Matchup Reveal',
      energyLevel: 'high',
      transitionPurpose: 'matchup-reveal',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Short reveal stinger for matchup presentation.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-stinger-matchup-reveal.mp3',
    prompt: [
      STINGER_DIRECTION,
      'Purpose: matchup reveal. Seven seconds, confident brass hit, snare pickup, clean final chord.',
    ].join(' '),
    requestedDurationSeconds: 7,
    runtimeLoadingStrategy: 'buffer',
  },
  {
    assetId: 'football-js-stinger-pregame-to-field',
    category: 'music',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 320_000,
    metadata: {
      catalogCategory: 'stinger',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Pregame to Field',
      energyLevel: 'high',
      transitionPurpose: 'pregame-to-field',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Transition stinger for moving from pregame presentation to field action.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-stinger-pregame-to-field.mp3',
    prompt: [
      STINGER_DIRECTION,
      'Purpose: pregame to field. Ten seconds, building drums into a bright brass cadence, decisive ending.',
    ].join(' '),
    requestedDurationSeconds: 10,
    runtimeLoadingStrategy: 'buffer',
  },
  {
    assetId: 'football-js-stinger-quarter-break',
    category: 'music',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 260_000,
    metadata: {
      catalogCategory: 'stinger',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Quarter Break',
      energyLevel: 'medium',
      transitionPurpose: 'quarter-break',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Concise quarter-break musical bumper.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-stinger-quarter-break.mp3',
    prompt: [
      STINGER_DIRECTION,
      'Purpose: quarter break. Six seconds, balanced percussion and brass punctuation, clean broadcast bumper ending.',
    ].join(' '),
    requestedDurationSeconds: 6,
    runtimeLoadingStrategy: 'buffer',
  },
  {
    assetId: 'football-js-stinger-halftime',
    category: 'music',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 370_000,
    metadata: {
      catalogCategory: 'stinger',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Halftime',
      energyLevel: 'medium',
      transitionPurpose: 'halftime',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Halftime transition stinger with a complete musical phrase.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-stinger-halftime.mp3',
    prompt: [
      STINGER_DIRECTION,
      'Purpose: halftime. Twelve seconds, confident but less urgent, broad horns, cadence drums, clear resolved ending.',
    ].join(' '),
    requestedDurationSeconds: 12,
    runtimeLoadingStrategy: 'buffer',
  },
  {
    assetId: 'football-js-stinger-victory',
    category: 'music',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 420_000,
    metadata: {
      catalogCategory: 'stinger',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Victory',
      energyLevel: 'peak',
      transitionPurpose: 'victory',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Victory result stinger.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-stinger-victory.mp3',
    prompt: [
      STINGER_DIRECTION,
      'Purpose: victory. Fourteen seconds, triumphant original brass fanfare, rolling snare and bass drum, cymbal lift, heroic final chord.',
    ].join(' '),
    requestedDurationSeconds: 14,
    runtimeLoadingStrategy: 'buffer',
  },
  {
    assetId: 'football-js-stinger-defeat',
    category: 'music',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 340_000,
    metadata: {
      catalogCategory: 'stinger',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Defeat',
      energyLevel: 'medium',
      transitionPurpose: 'defeat',
    },
    modelId: FOOTBALL_TITLE_MUSIC_MODEL_ID,
    notes: 'Defeat result stinger with controlled emotional weight.',
    outputFormat: FOOTBALL_TITLE_MUSIC_OUTPUT_FORMAT,
    outputPath: 'public/audio/music/football-js-stinger-defeat.mp3',
    prompt: [
      STINGER_DIRECTION,
      'Purpose: defeat. Nine seconds, restrained low brass, slow cadence drum, resolved but subdued ending, not comic or melodramatic.',
    ].join(' '),
    requestedDurationSeconds: 9,
    runtimeLoadingStrategy: 'buffer',
  },
] as const;

const CHANT_DIRECTION =
  'Generate a generic American-football stadium crowd chant asset suitable for layering over crowd ambience. Natural stadium perspective, no team name, no announcer, no band melody copied from existing sports programs, no copyrighted recording, no real stadium imitation.';

export const FOOTBALL_STADIUM_CHANT_PLAN: readonly AudioAssetPlan[] = [
  {
    assetId: 'football-js-chant-defense',
    category: 'crowd',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 180_000,
    metadata: {
      catalogCategory: 'chant',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Rhythmic Defense Chant',
      energyLevel: 'high',
      transitionPurpose: 'stadium-layer',
    },
    modelId: FOOTBALL_SOUND_EFFECTS_MODEL_ID,
    notes: 'Generic DEFENSE chant for defensive pressure ambience.',
    outputFormat: FOOTBALL_CHANT_OUTPUT_FORMAT,
    outputPath: 'public/audio/crowd/chants/football-js-chant-defense.mp3',
    prompt: [
      CHANT_DIRECTION,
      'Rhythmic crowd chanting the word defense with claps and stomps, six to eight seconds, no music bed, no team name.',
    ].join(' '),
    requestedDurationSeconds: 8,
    runtimeLoadingStrategy: 'buffer',
  },
  {
    assetId: 'football-js-chant-lets-go',
    category: 'crowd',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 180_000,
    metadata: {
      catalogCategory: 'chant',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Lets Go Call and Response',
      energyLevel: 'high',
      transitionPurpose: 'stadium-layer',
    },
    modelId: FOOTBALL_SOUND_EFFECTS_MODEL_ID,
    notes: 'Generic LETS GO call-and-response chant without a team name.',
    outputFormat: FOOTBALL_CHANT_OUTPUT_FORMAT,
    outputPath: 'public/audio/crowd/chants/football-js-chant-lets-go.mp3',
    prompt: [
      CHANT_DIRECTION,
      'Short crowd call-and-response saying lets go with natural claps, six to ten seconds, no team name, no melody copied from real sports chants.',
    ].join(' '),
    requestedDurationSeconds: 9,
    runtimeLoadingStrategy: 'buffer',
  },
  {
    assetId: 'football-js-chant-stomp-clap',
    category: 'crowd',
    generationStatus: 'planned',
    kind: 'oneShot',
    loop: false,
    maxBytes: 190_000,
    metadata: {
      catalogCategory: 'chant',
      composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
      displayTitle: 'Stomp and Clap Rhythm',
      energyLevel: 'medium',
      transitionPurpose: 'stadium-layer',
    },
    modelId: FOOTBALL_SOUND_EFFECTS_MODEL_ID,
    notes: 'Nonverbal stomp-and-clap stadium rhythm for crowd layering.',
    outputFormat: FOOTBALL_CHANT_OUTPUT_FORMAT,
    outputPath: 'public/audio/crowd/chants/football-js-chant-stomp-clap.mp3',
    prompt: [
      CHANT_DIRECTION,
      'Nonverbal stomp-and-clap stadium rhythm with crowd energy, eight to twelve seconds, no lyrics, no identifiable song pattern, no band.',
    ].join(' '),
    requestedDurationSeconds: 10,
    runtimeLoadingStrategy: 'buffer',
  },
] as const;

export const FOOTBALL_EXPANDED_MUSIC_PLAN: readonly AudioAssetPlan[] = [
  ...FOOTBALL_TITLE_MUSIC_PLAN,
  ...FOOTBALL_MENU_PLAYLIST_PLAN,
  ...FOOTBALL_TRANSITION_STINGER_PLAN,
  ...FOOTBALL_STADIUM_CHANT_PLAN,
] as const;

export function validateFootballTitleMusicPlan(): string[] {
  try {
    assertValidAudioPlan(FOOTBALL_TITLE_MUSIC_PLAN);
    return [];
  } catch (error) {
    return error instanceof Error ? error.message.split('\n').slice(1) : ['Unknown music plan error'];
  }
}

export function validateFootballExpandedMusicPlan(): string[] {
  try {
    assertValidAudioPlan(FOOTBALL_EXPANDED_MUSIC_PLAN);
    return [];
  } catch (error) {
    return error instanceof Error ? error.message.split('\n').slice(1) : ['Unknown music plan error'];
  }
}

if (isDirectCli(import.meta.url)) {
  assertValidAudioPlan(FOOTBALL_EXPANDED_MUSIC_PLAN);
  console.log(JSON.stringify(createAudioPlanReport(FOOTBALL_EXPANDED_MUSIC_PLAN), null, 2));
}
