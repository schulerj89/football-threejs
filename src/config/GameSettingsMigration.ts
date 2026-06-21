export const GAME_SETTINGS_SCHEMA_VERSION = 2;

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
    customSettings: payload.customSettings,
    preset: payload.preset,
    settings: payload.settings,
    version: GAME_SETTINGS_SCHEMA_VERSION,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
