export type AudioBusName = 'announcer' | 'crowd' | 'gameplaySfx' | 'master' | 'ui';
export type AudioPlaybackCategory = 'announcer' | 'crowd' | 'gameplaySfx' | 'ui';
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

export const LOCAL_AUDIO_ASSET_MANIFEST: readonly LocalAudioAsset[] = [
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
] as const;

export function getAudioAsset(
  manifest: readonly LocalAudioAsset[],
  assetId: string,
): LocalAudioAsset | null {
  return manifest.find((asset) => asset.assetId === assetId) ?? null;
}
