import { COMMENTARY_CATALOG } from './CommentaryCatalog';
import { PREGAME_COMMENTARY_CATALOG } from './PregameCommentaryCatalog';

export type AudioBusName = 'announcer' | 'crowd' | 'gameplaySfx' | 'master' | 'music' | 'ui';
export type AudioPlaybackCategory = 'announcer' | 'crowd' | 'gameplaySfx' | 'music' | 'ui';
export type AudioLoadingStrategy = 'buffer' | 'stream';

export interface LocalAudioAsset {
  assetId: string;
  category: AudioPlaybackCategory;
  defaultGain: number;
  loadingStrategy: AudioLoadingStrategy;
  loop: boolean;
  maxSimultaneousInstances: number;
  optional: boolean;
  url: string;
}

const ANNOUNCER_AUDIO_ASSETS: readonly LocalAudioAsset[] = COMMENTARY_CATALOG.map((clip) => ({
  assetId: clip.assetId,
  category: 'announcer',
  defaultGain: 1,
  loadingStrategy: 'buffer',
  loop: false,
  maxSimultaneousInstances: 1,
  optional: true,
  url: `/audio/announcer/${clip.assetId}.mp3`,
}));

const PREGAME_ANNOUNCER_AUDIO_ASSETS: readonly LocalAudioAsset[] = PREGAME_COMMENTARY_CATALOG.map((clip) => ({
  assetId: clip.assetId,
  category: 'announcer',
  defaultGain: 1,
  loadingStrategy: 'buffer',
  loop: false,
  maxSimultaneousInstances: 1,
  optional: true,
  url: `/audio/announcer/pregame/${clip.assetId}.mp3`,
}));

export const LOCAL_AUDIO_ASSET_MANIFEST: readonly LocalAudioAsset[] = [
  {
    assetId: 'football-js-title',
    category: 'music',
    defaultGain: 0.72,
    loadingStrategy: 'stream',
    loop: true,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/music/football-js-title.mp3',
  },
  {
    assetId: 'crowd_idle_loop_01',
    category: 'crowd',
    defaultGain: 0.32,
    loadingStrategy: 'stream',
    loop: true,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/crowd_idle_loop_01.mp3',
  },
  {
    assetId: 'crowd_pressure_loop_01',
    category: 'crowd',
    defaultGain: 0.34,
    loadingStrategy: 'stream',
    loop: true,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/crowd_pressure_loop_01.mp3',
  },
  {
    assetId: 'crowd_first_down_01',
    category: 'crowd',
    defaultGain: 0.72,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/crowd_first_down_01.mp3',
  },
  {
    assetId: 'crowd_first_down_02',
    category: 'crowd',
    defaultGain: 0.72,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/crowd_first_down_02.mp3',
  },
  {
    assetId: 'crowd_touchdown_01',
    category: 'crowd',
    defaultGain: 0.8,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/crowd_touchdown_01.mp3',
  },
  {
    assetId: 'crowd_touchdown_02',
    category: 'crowd',
    defaultGain: 0.8,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/crowd_touchdown_02.mp3',
  },
  {
    assetId: 'crowd_incomplete_01',
    category: 'crowd',
    defaultGain: 0.68,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/crowd_incomplete_01.mp3',
  },
  {
    assetId: 'crowd_turnover_01',
    category: 'crowd',
    defaultGain: 0.72,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/crowd_turnover_01.mp3',
  },
  {
    assetId: 'pads_hit_01',
    category: 'gameplaySfx',
    defaultGain: 0.72,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 2,
    optional: true,
    url: '/audio/sfx/pads_hit_01.mp3',
  },
  {
    assetId: 'pads_hit_02',
    category: 'gameplaySfx',
    defaultGain: 0.72,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 2,
    optional: true,
    url: '/audio/sfx/pads_hit_02.mp3',
  },
  {
    assetId: 'pads_hit_03',
    category: 'gameplaySfx',
    defaultGain: 0.72,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 2,
    optional: true,
    url: '/audio/sfx/pads_hit_03.mp3',
  },
  {
    assetId: 'ball_catch_01',
    category: 'gameplaySfx',
    defaultGain: 0.62,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 2,
    optional: true,
    url: '/audio/sfx/ball_catch_01.mp3',
  },
  {
    assetId: 'ball_catch_02',
    category: 'gameplaySfx',
    defaultGain: 0.62,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 2,
    optional: true,
    url: '/audio/sfx/ball_catch_02.mp3',
  },
  {
    assetId: 'referee_whistle_01',
    category: 'gameplaySfx',
    defaultGain: 0.58,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/sfx/referee_whistle_01.mp3',
  },
  {
    assetId: 'snap_01',
    category: 'gameplaySfx',
    defaultGain: 0.6,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/sfx/snap_01.mp3',
  },
  {
    assetId: 'runtime-test-click',
    category: 'ui',
    defaultGain: 0.55,
    loadingStrategy: 'buffer',
    loop: false,
    maxSimultaneousInstances: 2,
    optional: true,
    url: '/audio/sfx/runtime-test-click.wav',
  },
  {
    assetId: 'runtime-test-crowd-loop',
    category: 'crowd',
    defaultGain: 0.35,
    loadingStrategy: 'stream',
    loop: true,
    maxSimultaneousInstances: 1,
    optional: true,
    url: '/audio/crowd/runtime-test-crowd-loop.wav',
  },
  ...ANNOUNCER_AUDIO_ASSETS,
  ...PREGAME_ANNOUNCER_AUDIO_ASSETS,
] as const;

export function getAudioAsset(
  manifest: readonly LocalAudioAsset[],
  assetId: string,
): LocalAudioAsset | null {
  return manifest.find((asset) => asset.assetId === assetId) ?? null;
}
