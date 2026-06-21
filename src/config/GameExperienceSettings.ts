import {
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  normalizeAudioSettings,
  type AudioFeatureFlags,
  type AudioSettings,
  type StorageLike,
} from '../audio/AudioSettings';
import type {
  CinematicsSetting,
} from '../camera/PresentationCameraDirector';
import type { GameplayCameraMode } from '../camera/GameplayCameraController';
import {
  loadCrowdPresentationSettings,
  normalizeCrowdPresentationSettings,
  type CrowdDensity,
  type CrowdPresentationSettings,
} from '../presentation/CrowdPresentationController';
import type { PlaybookId } from '../roster';
import {
  DEFAULT_QUALITY_MODE,
  normalizeQualityMode,
  type QualityMode,
} from '../performance/QualityProfile';
import {
  GAME_SETTINGS_SCHEMA_VERSION,
  GAME_SETTINGS_STORAGE_KEY,
  loadStoredGameSettingsEnvelope,
  saveStoredGameSettingsEnvelope,
} from './GameSettingsStore';

export type ExperiencePreset =
  | 'broadcast'
  | 'custom'
  | 'performance';

export type ExperienceCameraMode = 'cinematic' | 'offense' | 'tactical';

export interface GameExperienceSettings {
  announcerEnabled: boolean;
  announcerVolume: number;
  audioEnabled: boolean;
  captionsEnabled: boolean;
  cinematics: CinematicsSetting;
  crowdAudioEnabled: boolean;
  crowdDensity: CrowdDensity;
  crowdReactionsEnabled: boolean;
  crowdVolume: number;
  crowdVisualsEnabled: boolean;
  debugToolsEnabled: boolean;
  gameplayCamera: ExperienceCameraMode;
  masterVolume: number;
  muted: boolean;
  officialsEnabled: boolean;
  playerMotionEnabled: boolean;
  playbookId: PlaybookId;
  preset: ExperiencePreset;
  qualityMode: QualityMode;
  routeArtEnabled: boolean;
  stadiumEnabled: boolean;
}

export interface PersistedGameExperienceSettings {
  customSettings: GameExperienceSettings | null;
  preset: ExperiencePreset;
  settings: GameExperienceSettings | null;
  version: number;
}

export interface GameExperienceQueryOverrides {
  announcerEnabled?: boolean;
  announcerVolume?: number;
  audioEnabled?: boolean;
  captionsEnabled?: boolean;
  cinematics?: CinematicsSetting;
  crowdAudioEnabled?: boolean;
  crowdDensity?: CrowdDensity;
  crowdReactionsEnabled?: boolean;
  crowdVolume?: number;
  crowdVisualsEnabled?: boolean;
  debugToolsEnabled?: boolean;
  gameplayCamera?: ExperienceCameraMode;
  masterVolume?: number;
  muted?: boolean;
  officialsEnabled?: boolean;
  playerMotionEnabled?: boolean;
  playbookId?: PlaybookId;
  preset?: ExperiencePreset;
  qualityMode?: QualityMode;
  routeArtEnabled?: boolean;
  stadiumEnabled?: boolean;
}

export interface DevelopmentModeFlags {
  appearanceAudit: boolean;
  crowdPreview: boolean;
  formationPreview: boolean;
  passAudit: boolean;
  presentationAudit: boolean;
  routeAudit: boolean;
  shotPreview: boolean;
}

export interface GameExperienceAssetReadinessSummary {
  audioEnabled: boolean;
  crowdSpectatorCount: number;
  crowdVisualsAllocated: boolean;
  decodedAudioBytes: number;
  loadedAudioAssetIds: string[];
  loadedCompressedAudioBytes: number;
  missingOptionalAudioAssetIds: string[];
  streamedAudioAssetIds: string[];
}

export interface GameExperienceDebugSnapshot {
  assetReadiness: GameExperienceAssetReadinessSummary;
  developmentModes: DevelopmentModeFlags;
  effectivePreset: ExperiencePreset;
  finalSettings: GameExperienceSettings;
  persistedSettings: PersistedGameExperienceSettings;
  queryOverrides: GameExperienceQueryOverrides;
}

export interface ResolvedGameExperienceSettings {
  audioFeatureFlags: AudioFeatureFlags;
  audioSettings: AudioSettings;
  crowdPresentationSettings: CrowdPresentationSettings;
  developmentModes: DevelopmentModeFlags;
  hasQueryOverrides: boolean;
  persistedSettings: PersistedGameExperienceSettings;
  queryOverrides: GameExperienceQueryOverrides;
  settings: GameExperienceSettings;
}

interface ResolveGameExperienceSettingsOptions {
  audioSettings?: AudioSettings;
  crowdPresentationSettings?: CrowdPresentationSettings;
  searchParams: URLSearchParams;
  storage?: StorageLike | null;
}

export const GAME_EXPERIENCE_SETTINGS_STORAGE_KEY = GAME_SETTINGS_STORAGE_KEY;

export const BROADCAST_EXPERIENCE_SETTINGS: GameExperienceSettings = {
  announcerEnabled: true,
  announcerVolume: DEFAULT_AUDIO_SETTINGS.announcerVolume,
  audioEnabled: true,
  captionsEnabled: false,
  cinematics: 'brief',
  crowdAudioEnabled: true,
  crowdDensity: 'low',
  crowdReactionsEnabled: true,
  crowdVolume: DEFAULT_AUDIO_SETTINGS.crowdVolume,
  crowdVisualsEnabled: true,
  debugToolsEnabled: false,
  gameplayCamera: 'offense',
  masterVolume: DEFAULT_AUDIO_SETTINGS.masterVolume,
  muted: DEFAULT_AUDIO_SETTINGS.muted,
  officialsEnabled: false,
  playerMotionEnabled: true,
  playbookId: '11v11',
  preset: 'broadcast',
  qualityMode: DEFAULT_QUALITY_MODE,
  routeArtEnabled: true,
  stadiumEnabled: true,
} as const;

export const PERFORMANCE_EXPERIENCE_SETTINGS: GameExperienceSettings = {
  ...BROADCAST_EXPERIENCE_SETTINGS,
  cinematics: 'off',
  crowdReactionsEnabled: false,
  crowdVisualsEnabled: false,
  preset: 'performance',
  qualityMode: DEFAULT_QUALITY_MODE,
  stadiumEnabled: true,
} as const;

export function resolveGameExperienceSettings({
  audioSettings,
  crowdPresentationSettings,
  searchParams,
  storage = getLocalStorage(),
}: ResolveGameExperienceSettingsOptions): ResolvedGameExperienceSettings {
  const persistedSettings = loadPersistedGameExperienceSettings(storage);
  const existingAudioSettings = audioSettings ?? loadAudioSettings(storage);
  const existingCrowdSettings =
    crowdPresentationSettings ?? loadCrowdPresentationSettings(storage);
  const queryOverrides = resolveGameExperienceQueryOverrides(searchParams);
  const baseSettings = resolveBaseSettings(
    queryOverrides.preset ?? persistedSettings.preset,
    persistedSettings,
    existingAudioSettings,
    existingCrowdSettings,
  );
  const settings = normalizeGameExperienceSettings({
    ...baseSettings,
    ...queryOverrides,
    preset: queryOverrides.preset ?? baseSettings.preset,
  });
  const resolvedAudioSettings = normalizeAudioSettings({
    ...existingAudioSettings,
    announcerEnabled: settings.announcerEnabled,
    announcerVolume: settings.announcerVolume,
    captionsEnabled: settings.captionsEnabled,
    crowdVolume: settings.crowdVolume,
    masterVolume: settings.masterVolume,
    muted: settings.muted,
  });
  const resolvedCrowdSettings = normalizeCrowdPresentationSettings({
    ...existingCrowdSettings,
    crowdDensity: settings.crowdDensity,
    crowdReactionsEnabled: settings.crowdReactionsEnabled,
    crowdVisualsEnabled: settings.crowdVisualsEnabled,
  });

  return {
    audioFeatureFlags: {
      announcerEnabled: settings.announcerEnabled,
      audioDebug: searchParams.has('audioDebug'),
      audioEnabled: settings.audioEnabled,
      crowdAudioEnabled: settings.crowdAudioEnabled,
    },
    audioSettings: resolvedAudioSettings,
    crowdPresentationSettings: resolvedCrowdSettings,
    developmentModes: resolveDevelopmentModeFlags(searchParams),
    hasQueryOverrides: Object.keys(queryOverrides).length > 0,
    persistedSettings,
    queryOverrides,
    settings,
  };
}

export function loadPersistedGameExperienceSettings(
  storage = getLocalStorage(),
): PersistedGameExperienceSettings {
  if (!storage) {
    return createDefaultPersistedSettings();
  }

  const stored = loadStoredGameSettingsEnvelope(storage);

  if (!stored) {
    return createDefaultPersistedSettings();
  }

  return normalizePersistedGameExperienceSettings(
    stored as Partial<PersistedGameExperienceSettings>,
  );
}

export function saveGameExperienceSettings(
  settings: GameExperienceSettings,
  storage = getLocalStorage(),
): void {
  if (!storage) {
    return;
  }

  const normalizedSettings = normalizeGameExperienceSettings(settings);
  const persistedSettings: PersistedGameExperienceSettings = {
    customSettings: normalizedSettings.preset === 'custom'
      ? normalizedSettings
      : null,
    preset: normalizedSettings.preset,
    settings: normalizedSettings,
    version: GAME_SETTINGS_SCHEMA_VERSION,
  };

  saveStoredGameSettingsEnvelope(storage, persistedSettings);
}

export function normalizeGameExperienceSettings(
  settings: Partial<GameExperienceSettings>,
): GameExperienceSettings {
  const preset = isExperiencePreset(settings.preset) ? settings.preset : 'broadcast';
  const presetDefaults = preset === 'performance'
    ? PERFORMANCE_EXPERIENCE_SETTINGS
    : BROADCAST_EXPERIENCE_SETTINGS;

  return {
    announcerEnabled: settings.announcerEnabled ?? presetDefaults.announcerEnabled,
    announcerVolume: clampVolume(settings.announcerVolume ?? presetDefaults.announcerVolume),
    audioEnabled: settings.audioEnabled ?? presetDefaults.audioEnabled,
    captionsEnabled: settings.captionsEnabled ?? presetDefaults.captionsEnabled,
    cinematics: isCinematicsSetting(settings.cinematics)
      ? settings.cinematics
      : presetDefaults.cinematics,
    crowdAudioEnabled: settings.crowdAudioEnabled ?? presetDefaults.crowdAudioEnabled,
    crowdDensity: isCrowdDensity(settings.crowdDensity)
      ? settings.crowdDensity
      : presetDefaults.crowdDensity,
    crowdReactionsEnabled:
      settings.crowdReactionsEnabled ?? presetDefaults.crowdReactionsEnabled,
    crowdVolume: clampVolume(settings.crowdVolume ?? presetDefaults.crowdVolume),
    crowdVisualsEnabled:
      settings.crowdVisualsEnabled ?? presetDefaults.crowdVisualsEnabled,
    debugToolsEnabled: settings.debugToolsEnabled ?? presetDefaults.debugToolsEnabled,
    gameplayCamera: isExperienceCameraMode(settings.gameplayCamera)
      ? settings.gameplayCamera
      : presetDefaults.gameplayCamera,
    masterVolume: clampVolume(settings.masterVolume ?? presetDefaults.masterVolume),
    muted: settings.muted ?? presetDefaults.muted,
    officialsEnabled: settings.officialsEnabled ?? presetDefaults.officialsEnabled,
    playerMotionEnabled: settings.playerMotionEnabled ?? presetDefaults.playerMotionEnabled,
    playbookId: isPlaybookId(settings.playbookId)
      ? settings.playbookId
      : presetDefaults.playbookId,
    preset,
    qualityMode: settings.qualityMode
      ? normalizeQualityMode(settings.qualityMode)
      : presetDefaults.qualityMode,
    routeArtEnabled: settings.routeArtEnabled ?? presetDefaults.routeArtEnabled,
    stadiumEnabled: settings.stadiumEnabled ?? presetDefaults.stadiumEnabled,
  };
}

export function resolveGameExperienceQueryOverrides(
  searchParams: URLSearchParams,
): GameExperienceQueryOverrides {
  const overrides: GameExperienceQueryOverrides = {};
  const presetValue = searchParams.get('experience') ?? searchParams.get('preset');
  const playbookValue = searchParams.get('playbook') ?? searchParams.get('roster');
  const cameraValue = searchParams.get('camera');
  const cinematicsValue = searchParams.get('cinematics');
  const crowdDensityValue = searchParams.get('crowdDensity');
  const qualityValue = searchParams.get('quality') ?? searchParams.get('qualityMode');

  if (isExperiencePreset(presetValue)) {
    overrides.preset = presetValue;
  }

  if (playbookValue === '5v5' || playbookValue === '7v7' || playbookValue === '11v11') {
    overrides.playbookId = playbookValue;
  }

  if (cameraValue === 'tactical' || cameraValue === 'tacticalOrthographic') {
    overrides.gameplayCamera = 'tactical';
  } else if (cameraValue === 'offense' || cameraValue === 'offensePerspective') {
    overrides.gameplayCamera = 'offense';
  } else if (cameraValue === 'cinematic' || cameraValue === 'cinematicBroadcast') {
    overrides.gameplayCamera = 'cinematic';
  }

  if (isCinematicsSetting(cinematicsValue)) {
    overrides.cinematics = cinematicsValue;
  }

  if (isCrowdDensity(crowdDensityValue)) {
    overrides.crowdDensity = crowdDensityValue;
  }

  if (qualityValue !== null) {
    overrides.qualityMode = normalizeQualityMode(qualityValue);
  } else if (searchParams.get('perfProfile') === '1') {
    overrides.qualityMode = 'lockedBroadcast';
  }

  applyBooleanOverride(overrides, 'crowdVisualsEnabled', searchParams, 'crowdVisuals');
  applyBooleanOverride(overrides, 'crowdReactionsEnabled', searchParams, 'crowdReactions');
  applyBooleanOverride(overrides, 'audioEnabled', searchParams, 'audio');
  applyBooleanOverride(overrides, 'crowdAudioEnabled', searchParams, 'crowdAudio');
  applyBooleanOverride(overrides, 'announcerEnabled', searchParams, 'announcer');
  applyBooleanOverride(overrides, 'captionsEnabled', searchParams, 'captions');
  applyBooleanOverride(overrides, 'debugToolsEnabled', searchParams, 'debugTools');
  applyBooleanOverride(overrides, 'muted', searchParams, 'muted');
  applyBooleanOverride(overrides, 'officialsEnabled', searchParams, 'officials');
  applyBooleanOverride(overrides, 'routeArtEnabled', searchParams, 'routeArt');
  applyBooleanOverride(overrides, 'playerMotionEnabled', searchParams, 'playerMotion');
  applyBooleanOverride(overrides, 'stadiumEnabled', searchParams, 'stadium');
  applyVolumeOverride(overrides, 'announcerVolume', searchParams, 'announcerVolume');
  applyVolumeOverride(overrides, 'crowdVolume', searchParams, 'crowdVolume');
  applyVolumeOverride(overrides, 'masterVolume', searchParams, 'masterVolume');

  return overrides;
}

export function resolveDevelopmentModeFlags(searchParams: URLSearchParams): DevelopmentModeFlags {
  return {
    appearanceAudit: searchParams.has('appearanceAudit'),
    crowdPreview: searchParams.get('crowdPreview') === '1',
    formationPreview: searchParams.has('formationPreview'),
    passAudit: searchParams.has('passAudit'),
    presentationAudit: searchParams.has('presentationAudit'),
    routeAudit: searchParams.has('routeAudit'),
    shotPreview: searchParams.has('shotPreview'),
  };
}

export function toGameplayCameraMode(mode: ExperienceCameraMode): GameplayCameraMode {
  if (mode === 'cinematic') {
    return 'cinematicBroadcast';
  }

  if (mode === 'offense') {
    return 'offensePerspective';
  }

  return 'tacticalOrthographic';
}

export function createGameExperienceDebugSnapshot(
  resolvedSettings: ResolvedGameExperienceSettings,
  assetReadiness: GameExperienceAssetReadinessSummary,
): GameExperienceDebugSnapshot {
  return {
    assetReadiness: {
      ...assetReadiness,
      loadedAudioAssetIds: [...assetReadiness.loadedAudioAssetIds],
      missingOptionalAudioAssetIds: [...assetReadiness.missingOptionalAudioAssetIds],
      streamedAudioAssetIds: [...assetReadiness.streamedAudioAssetIds],
    },
    developmentModes: { ...resolvedSettings.developmentModes },
    effectivePreset: resolvedSettings.settings.preset,
    finalSettings: { ...resolvedSettings.settings },
    persistedSettings: {
      customSettings: resolvedSettings.persistedSettings.customSettings
        ? { ...resolvedSettings.persistedSettings.customSettings }
        : null,
      preset: resolvedSettings.persistedSettings.preset,
      settings: resolvedSettings.persistedSettings.settings
        ? { ...resolvedSettings.persistedSettings.settings }
        : null,
      version: resolvedSettings.persistedSettings.version,
    },
    queryOverrides: { ...resolvedSettings.queryOverrides },
  };
}

function resolveBaseSettings(
  preset: ExperiencePreset,
  persistedSettings: PersistedGameExperienceSettings,
  audioSettings: AudioSettings,
  crowdPresentationSettings: CrowdPresentationSettings,
): GameExperienceSettings {
  if (persistedSettings.settings?.preset === preset) {
    return persistedSettings.settings;
  }

  if (preset === 'performance') {
    return PERFORMANCE_EXPERIENCE_SETTINGS;
  }

  if (preset === 'custom') {
    return persistedSettings.customSettings ??
      createCustomSettingsFromExisting(audioSettings, crowdPresentationSettings);
  }

  return BROADCAST_EXPERIENCE_SETTINGS;
}

function createCustomSettingsFromExisting(
  audioSettings: AudioSettings,
  crowdPresentationSettings: CrowdPresentationSettings,
): GameExperienceSettings {
  return normalizeGameExperienceSettings({
    ...BROADCAST_EXPERIENCE_SETTINGS,
    announcerEnabled: audioSettings.announcerEnabled,
    announcerVolume: audioSettings.announcerVolume,
    captionsEnabled: audioSettings.captionsEnabled,
    crowdDensity: crowdPresentationSettings.crowdDensity,
    crowdReactionsEnabled: crowdPresentationSettings.crowdReactionsEnabled,
    crowdVisualsEnabled: crowdPresentationSettings.crowdVisualsEnabled,
    crowdVolume: audioSettings.crowdVolume,
    masterVolume: audioSettings.masterVolume,
    muted: audioSettings.muted,
    preset: 'custom',
  });
}

function normalizePersistedGameExperienceSettings(
  persisted: Partial<PersistedGameExperienceSettings>,
): PersistedGameExperienceSettings {
  const preset = isExperiencePreset(persisted.preset) ? persisted.preset : 'broadcast';
  const settings = persisted.settings
    ? normalizeGameExperienceSettings(persisted.settings)
    : null;
  const customSettings = persisted.customSettings
    ? normalizeGameExperienceSettings({ ...persisted.customSettings, preset: 'custom' })
    : settings?.preset === 'custom'
      ? settings
    : null;

  return {
    customSettings,
    preset,
    settings,
    version: GAME_SETTINGS_SCHEMA_VERSION,
  };
}

function createDefaultPersistedSettings(): PersistedGameExperienceSettings {
  return {
    customSettings: null,
    preset: 'broadcast',
    settings: null,
    version: GAME_SETTINGS_SCHEMA_VERSION,
  };
}

function applyBooleanOverride(
  overrides: GameExperienceQueryOverrides,
  key: keyof Pick<
    GameExperienceQueryOverrides,
    | 'announcerEnabled'
    | 'audioEnabled'
    | 'captionsEnabled'
    | 'crowdAudioEnabled'
    | 'crowdReactionsEnabled'
    | 'crowdVisualsEnabled'
    | 'debugToolsEnabled'
    | 'muted'
    | 'officialsEnabled'
    | 'playerMotionEnabled'
    | 'routeArtEnabled'
    | 'stadiumEnabled'
  >,
  searchParams: URLSearchParams,
  queryKey: string,
): void {
  if (!searchParams.has(queryKey)) {
    return;
  }

  const value = searchParams.get(queryKey);
  overrides[key] = value !== '0';
}

function applyVolumeOverride(
  overrides: GameExperienceQueryOverrides,
  key: keyof Pick<
    GameExperienceQueryOverrides,
    'announcerVolume' | 'crowdVolume' | 'masterVolume'
  >,
  searchParams: URLSearchParams,
  queryKey: string,
): void {
  if (!searchParams.has(queryKey)) {
    return;
  }

  overrides[key] = clampVolume(Number(searchParams.get(queryKey)));
}

function isExperiencePreset(value: unknown): value is ExperiencePreset {
  return value === 'broadcast' || value === 'custom' || value === 'performance';
}

function isExperienceCameraMode(value: unknown): value is ExperienceCameraMode {
  return value === 'cinematic' || value === 'offense' || value === 'tactical';
}

function isCinematicsSetting(value: unknown): value is CinematicsSetting {
  return value === 'brief' || value === 'full' || value === 'off';
}

function isCrowdDensity(value: unknown): value is CrowdDensity {
  return value === 'high' || value === 'low' || value === 'medium';
}

function isPlaybookId(value: unknown): value is PlaybookId {
  return value === '5v5' || value === '7v7' || value === '11v11';
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
