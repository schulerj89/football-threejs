export interface AudioSettings {
  announcerVolume: number;
  cinematicsAudioEnabled: boolean;
  crowdVolume: number;
  effectsVolume: number;
  masterVolume: number;
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
  announcerVolume: 0.85,
  cinematicsAudioEnabled: true,
  crowdVolume: 0.45,
  effectsVolume: 0.85,
  masterVolume: 0.85,
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
    announcerVolume: clampVolume(settings.announcerVolume ?? DEFAULT_AUDIO_SETTINGS.announcerVolume),
    cinematicsAudioEnabled:
      settings.cinematicsAudioEnabled ?? DEFAULT_AUDIO_SETTINGS.cinematicsAudioEnabled,
    crowdVolume: clampVolume(settings.crowdVolume ?? DEFAULT_AUDIO_SETTINGS.crowdVolume),
    effectsVolume: clampVolume(settings.effectsVolume ?? DEFAULT_AUDIO_SETTINGS.effectsVolume),
    masterVolume: clampVolume(settings.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume),
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
