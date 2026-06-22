import { isMenuPlaylistOrder, type MenuPlaylistOrder } from './MusicCatalog';

export interface AudioSettings {
  announcerEnabled: boolean;
  announcerVolume: number;
  captionsEnabled: boolean;
  cinematicsAudioEnabled: boolean;
  crowdVolume: number;
  effectsVolume: number;
  masterVolume: number;
  menuPlaylistOrder: MenuPlaylistOrder;
  musicEnabled: boolean;
  musicVolume: number;
  muted: boolean;
}

export interface AudioFeatureFlags {
  announcerEnabled: boolean;
  audioDebug: boolean;
  audioEnabled: boolean;
  crowdAudioEnabled: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const AUDIO_SETTINGS_STORAGE_KEY = 'football-threejs.audioSettings.v1';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  announcerEnabled: true,
  announcerVolume: 0.85,
  captionsEnabled: false,
  cinematicsAudioEnabled: true,
  crowdVolume: 0.45,
  effectsVolume: 0.85,
  masterVolume: 0.85,
  menuPlaylistOrder: 'sequential',
  musicEnabled: true,
  musicVolume: 0.72,
  muted: false,
};

export function resolveAudioFeatureFlags(searchParams: URLSearchParams): AudioFeatureFlags {
  return {
    announcerEnabled: searchParams.get('announcer') !== '0',
    audioDebug: searchParams.has('audioDebug'),
    audioEnabled: searchParams.get('audio') !== '0',
    crowdAudioEnabled: searchParams.get('crowdAudio') !== '0',
  };
}

export function loadAudioSettings(storage = getLocalStorage()): AudioSettings {
  if (!storage) {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  const stored = storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);

  if (!stored) {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  try {
    return normalizeAudioSettings(JSON.parse(stored) as Partial<AudioSettings>);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function applyAudioQuerySettings(
  settings: AudioSettings,
  searchParams: URLSearchParams,
): AudioSettings {
  return normalizeAudioSettings({
    ...settings,
    announcerEnabled: searchParams.get('announcer') === '0' ? false : settings.announcerEnabled,
    captionsEnabled: searchParams.has('captions')
      ? searchParams.get('captions') !== '0'
      : settings.captionsEnabled,
    menuPlaylistOrder: isMenuPlaylistOrder(searchParams.get('menuPlaylist'))
      ? searchParams.get('menuPlaylist') as MenuPlaylistOrder
      : settings.menuPlaylistOrder,
    musicEnabled: searchParams.has('music')
      ? searchParams.get('music') !== '0'
      : settings.musicEnabled,
    musicVolume: searchParams.has('musicVolume')
      ? clampVolume(Number(searchParams.get('musicVolume')))
      : settings.musicVolume,
  });
}

export function saveAudioSettings(
  settings: AudioSettings,
  storage = getLocalStorage(),
): void {
  if (!storage) {
    return;
  }

  storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAudioSettings(settings)));
}

export function updateAudioSettings(
  settings: AudioSettings,
  patch: Partial<AudioSettings>,
  storage = getLocalStorage(),
): AudioSettings {
  const updatedSettings = normalizeAudioSettings({ ...settings, ...patch });
  saveAudioSettings(updatedSettings, storage);
  return updatedSettings;
}

export function normalizeAudioSettings(settings: Partial<AudioSettings>): AudioSettings {
  return {
    announcerEnabled: settings.announcerEnabled ?? DEFAULT_AUDIO_SETTINGS.announcerEnabled,
    announcerVolume: clampVolume(settings.announcerVolume ?? DEFAULT_AUDIO_SETTINGS.announcerVolume),
    captionsEnabled: settings.captionsEnabled ?? DEFAULT_AUDIO_SETTINGS.captionsEnabled,
    cinematicsAudioEnabled:
      settings.cinematicsAudioEnabled ?? DEFAULT_AUDIO_SETTINGS.cinematicsAudioEnabled,
    crowdVolume: clampVolume(settings.crowdVolume ?? DEFAULT_AUDIO_SETTINGS.crowdVolume),
    effectsVolume: clampVolume(settings.effectsVolume ?? DEFAULT_AUDIO_SETTINGS.effectsVolume),
    masterVolume: clampVolume(settings.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume),
    menuPlaylistOrder: isMenuPlaylistOrder(settings.menuPlaylistOrder)
      ? settings.menuPlaylistOrder
      : DEFAULT_AUDIO_SETTINGS.menuPlaylistOrder,
    musicEnabled: settings.musicEnabled ?? DEFAULT_AUDIO_SETTINGS.musicEnabled,
    musicVolume: clampVolume(settings.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume),
    muted: settings.muted ?? DEFAULT_AUDIO_SETTINGS.muted,
  };
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function getLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
