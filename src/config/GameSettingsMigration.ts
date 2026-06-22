export const GAME_SETTINGS_SCHEMA_VERSION = 8;

export interface VersionedGameSettingsEnvelope {
  customSettings?: unknown;
  preset?: unknown;
  settings?: unknown;
  version: number;
}

export function migrateGameSettingsPayload(payload: unknown): VersionedGameSettingsEnvelope | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (payload.version === GAME_SETTINGS_SCHEMA_VERSION) {
    return {
      customSettings: payload.customSettings,
      preset: payload.preset,
      settings: payload.settings,
      version: GAME_SETTINGS_SCHEMA_VERSION,
    };
  }

  return {
    customSettings: migrateOfficialSettings(payload.customSettings),
    preset: payload.preset,
    settings: migrateOfficialSettings(payload.settings),
    version: GAME_SETTINGS_SCHEMA_VERSION,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function migrateOfficialSettings(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const preset = value.preset;
  if (preset === 'broadcast') {
    return {
      ...value,
      controlledPlayerLabelEnabled: value.controlledPlayerLabelEnabled ?? true,
      gameMode: value.gameMode ?? 'exhibition',
      matchDifficulty: value.matchDifficulty ?? 'pro',
      musicVolume: value.musicVolume ?? 0.72,
      officialsDebugLabels: value.officialsDebugLabels ?? false,
      officialsEnabled: true,
      quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
      selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
      sidelineDensity: value.sidelineDensity ?? 'medium',
      sidelinePlayersEnabled: value.sidelinePlayersEnabled ?? true,
      tunnelTableauEnabled: value.tunnelTableauEnabled ?? true,
    };
  }

  if (preset === 'performance') {
    return {
      ...value,
      controlledPlayerLabelEnabled: value.controlledPlayerLabelEnabled ?? true,
      gameMode: value.gameMode ?? 'exhibition',
      matchDifficulty: value.matchDifficulty ?? 'pro',
      musicVolume: value.musicVolume ?? 0.72,
      officialsDebugLabels: value.officialsDebugLabels ?? false,
      officialsEnabled: false,
      quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
      selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
      sidelineDensity: value.sidelineDensity ?? 'low',
      sidelinePlayersEnabled: value.sidelinePlayersEnabled ?? false,
      tunnelTableauEnabled: value.tunnelTableauEnabled ?? false,
    };
  }

  return {
    ...value,
    controlledPlayerLabelEnabled: value.controlledPlayerLabelEnabled ?? true,
    gameMode: value.gameMode ?? 'exhibition',
    matchDifficulty: value.matchDifficulty ?? 'pro',
    musicVolume: value.musicVolume ?? 0.72,
    officialsDebugLabels: value.officialsDebugLabels ?? false,
    quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
    selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
    sidelineDensity: value.sidelineDensity ?? 'medium',
    sidelinePlayersEnabled: value.sidelinePlayersEnabled ?? true,
    tunnelTableauEnabled: value.tunnelTableauEnabled ?? true,
  };
}
