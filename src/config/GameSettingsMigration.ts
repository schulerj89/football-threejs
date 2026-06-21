export const GAME_SETTINGS_SCHEMA_VERSION = 6;

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
      officialsDebugLabels: value.officialsDebugLabels ?? false,
      officialsEnabled: true,
      quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
      selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
    };
  }

  if (preset === 'performance') {
    return {
      ...value,
      controlledPlayerLabelEnabled: value.controlledPlayerLabelEnabled ?? true,
      gameMode: value.gameMode ?? 'exhibition',
      matchDifficulty: value.matchDifficulty ?? 'pro',
      officialsDebugLabels: value.officialsDebugLabels ?? false,
      officialsEnabled: false,
      quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
      selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
    };
  }

  return {
    ...value,
    controlledPlayerLabelEnabled: value.controlledPlayerLabelEnabled ?? true,
    gameMode: value.gameMode ?? 'exhibition',
    matchDifficulty: value.matchDifficulty ?? 'pro',
    officialsDebugLabels: value.officialsDebugLabels ?? false,
    quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
    selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
  };
}
