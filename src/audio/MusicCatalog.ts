import type { LocalAudioAsset } from './AudioAssetManifest';

export type MusicCatalogCategory = 'chant' | 'menu' | 'stinger';
export type MenuPlaylistOrder = 'sequential' | 'shuffle';
export type TransitionStingerPurpose =
  | 'defeat'
  | 'halftime'
  | 'matchupReveal'
  | 'pregameToField'
  | 'quarterBreak'
  | 'victory';

export interface MusicCatalogEntry {
  assetId: string;
  category: MusicCatalogCategory;
  composerDisplay: string;
  displayTitle: string;
  durationSeconds: number;
  energyLevel: 'high' | 'medium' | 'peak';
  looping: boolean;
  runtimeAudioUrl: string;
  transitionPurpose: string;
}

export interface MenuMusicTrack extends MusicCatalogEntry {
  category: 'menu';
}

export interface TransitionStingerTrack extends MusicCatalogEntry {
  category: 'stinger';
  purpose: TransitionStingerPurpose;
}

export interface StadiumChantTrack extends MusicCatalogEntry {
  category: 'chant';
}

export const MUSIC_COMPOSER_DISPLAY = 'Football JS Original Soundtrack';

export const MENU_MUSIC_TRACKS: readonly MenuMusicTrack[] = [
  {
    assetId: 'football-js-title',
    category: 'menu',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Football JS Main Theme',
    durationSeconds: 75.024,
    energyLevel: 'high',
    looping: true,
    runtimeAudioUrl: '/audio/music/football-js-title.mp3',
    transitionPurpose: 'menu-playlist',
  },
  {
    assetId: 'football-js-saturday-lights',
    category: 'menu',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Saturday Lights',
    durationSeconds: 78.024,
    energyLevel: 'high',
    looping: true,
    runtimeAudioUrl: '/audio/music/football-js-saturday-lights.mp3',
    transitionPurpose: 'menu-playlist',
  },
  {
    assetId: 'football-js-stadium-horizon',
    category: 'menu',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Stadium Horizon',
    durationSeconds: 82.032,
    energyLevel: 'medium',
    looping: true,
    runtimeAudioUrl: '/audio/music/football-js-stadium-horizon.mp3',
    transitionPurpose: 'menu-playlist',
  },
  {
    assetId: 'football-js-drive-to-glory',
    category: 'menu',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Drive to Glory',
    durationSeconds: 86.04,
    energyLevel: 'peak',
    looping: true,
    runtimeAudioUrl: '/audio/music/football-js-drive-to-glory.mp3',
    transitionPurpose: 'menu-playlist',
  },
] as const;

export const TRANSITION_STINGER_TRACKS: readonly TransitionStingerTrack[] = [
  {
    assetId: 'football-js-stinger-matchup-reveal',
    category: 'stinger',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Matchup Reveal',
    durationSeconds: 7.032,
    energyLevel: 'high',
    looping: false,
    purpose: 'matchupReveal',
    runtimeAudioUrl: '/audio/music/football-js-stinger-matchup-reveal.mp3',
    transitionPurpose: 'matchup-reveal',
  },
  {
    assetId: 'football-js-stinger-pregame-to-field',
    category: 'stinger',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Pregame to Field',
    durationSeconds: 11.52,
    energyLevel: 'high',
    looping: false,
    purpose: 'pregameToField',
    runtimeAudioUrl: '/audio/music/football-js-stinger-pregame-to-field.mp3',
    transitionPurpose: 'pregame-to-field',
  },
  {
    assetId: 'football-js-stinger-quarter-break',
    category: 'stinger',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Quarter Break',
    durationSeconds: 6.024,
    energyLevel: 'medium',
    looping: false,
    purpose: 'quarterBreak',
    runtimeAudioUrl: '/audio/music/football-js-stinger-quarter-break.mp3',
    transitionPurpose: 'quarter-break',
  },
  {
    assetId: 'football-js-stinger-halftime',
    category: 'stinger',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Halftime',
    durationSeconds: 12.024,
    energyLevel: 'medium',
    looping: false,
    purpose: 'halftime',
    runtimeAudioUrl: '/audio/music/football-js-stinger-halftime.mp3',
    transitionPurpose: 'halftime',
  },
  {
    assetId: 'football-js-stinger-victory',
    category: 'stinger',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Victory',
    durationSeconds: 14.04,
    energyLevel: 'peak',
    looping: false,
    purpose: 'victory',
    runtimeAudioUrl: '/audio/music/football-js-stinger-victory.mp3',
    transitionPurpose: 'victory',
  },
  {
    assetId: 'football-js-stinger-defeat',
    category: 'stinger',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Defeat',
    durationSeconds: 9.024,
    energyLevel: 'medium',
    looping: false,
    purpose: 'defeat',
    runtimeAudioUrl: '/audio/music/football-js-stinger-defeat.mp3',
    transitionPurpose: 'defeat',
  },
] as const;

export const STADIUM_CHANT_TRACKS: readonly StadiumChantTrack[] = [
  {
    assetId: 'football-js-chant-defense',
    category: 'chant',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Rhythmic Defense Chant',
    durationSeconds: 8,
    energyLevel: 'high',
    looping: false,
    runtimeAudioUrl: '/audio/crowd/chants/football-js-chant-defense.mp3',
    transitionPurpose: 'stadium-layer',
  },
  {
    assetId: 'football-js-chant-lets-go',
    category: 'chant',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Lets Go Call and Response',
    durationSeconds: 9,
    energyLevel: 'high',
    looping: false,
    runtimeAudioUrl: '/audio/crowd/chants/football-js-chant-lets-go.mp3',
    transitionPurpose: 'stadium-layer',
  },
  {
    assetId: 'football-js-chant-stomp-clap',
    category: 'chant',
    composerDisplay: MUSIC_COMPOSER_DISPLAY,
    displayTitle: 'Stomp and Clap Rhythm',
    durationSeconds: 10,
    energyLevel: 'medium',
    looping: false,
    runtimeAudioUrl: '/audio/crowd/chants/football-js-chant-stomp-clap.mp3',
    transitionPurpose: 'stadium-layer',
  },
] as const;

export const MUSIC_CATALOG: readonly MusicCatalogEntry[] = [
  ...MENU_MUSIC_TRACKS,
  ...TRANSITION_STINGER_TRACKS,
  ...STADIUM_CHANT_TRACKS,
] as const;

export function createMusicLocalAudioAssets(): readonly LocalAudioAsset[] {
  return [
    ...MENU_MUSIC_TRACKS.map((track) => ({
      assetId: track.assetId,
      category: 'music' as const,
      defaultGain: 0.72,
      loadingStrategy: 'stream' as const,
      loop: track.looping,
      maxSimultaneousInstances: 1,
      optional: true,
      url: track.runtimeAudioUrl,
    })),
    ...TRANSITION_STINGER_TRACKS.map((track) => ({
      assetId: track.assetId,
      category: 'music' as const,
      defaultGain: 0.78,
      loadingStrategy: 'buffer' as const,
      loop: false,
      maxSimultaneousInstances: 1,
      optional: true,
      url: track.runtimeAudioUrl,
    })),
    ...STADIUM_CHANT_TRACKS.map((track) => ({
      assetId: track.assetId,
      category: 'crowd' as const,
      defaultGain: 0.54,
      loadingStrategy: 'buffer' as const,
      loop: false,
      maxSimultaneousInstances: 1,
      optional: true,
      url: track.runtimeAudioUrl,
    })),
  ] as const;
}

export function getMenuMusicTrack(assetId: string): MenuMusicTrack | null {
  return MENU_MUSIC_TRACKS.find((track) => track.assetId === assetId) ?? null;
}

export function getTransitionStinger(
  purpose: TransitionStingerPurpose,
): TransitionStingerTrack | null {
  return TRANSITION_STINGER_TRACKS.find((track) => track.purpose === purpose) ?? null;
}

export function isMenuPlaylistOrder(value: unknown): value is MenuPlaylistOrder {
  return value === 'sequential' || value === 'shuffle';
}
