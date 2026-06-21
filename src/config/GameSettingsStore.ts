import type { StorageLike } from '../audio/AudioSettings';
import {
  GAME_SETTINGS_SCHEMA_VERSION,
  migrateGameSettingsPayload,
  type VersionedGameSettingsEnvelope,
} from './GameSettingsMigration';

export { GAME_SETTINGS_SCHEMA_VERSION };

export const GAME_SETTINGS_STORAGE_KEY = 'football-threejs.gameSettings.v2';
export const LEGACY_GAME_EXPERIENCE_SETTINGS_STORAGE_KEY =
  'football-threejs.gameExperienceSettings.v1';

export function loadStoredGameSettingsEnvelope(
  storage: StorageLike | null,
): VersionedGameSettingsEnvelope | null {
  if (!storage) {
    return null;
  }

  return readEnvelope(storage.getItem(GAME_SETTINGS_STORAGE_KEY)) ??
    readEnvelope(storage.getItem(LEGACY_GAME_EXPERIENCE_SETTINGS_STORAGE_KEY));
}

export function saveStoredGameSettingsEnvelope(
  storage: StorageLike | null,
  envelope: Omit<VersionedGameSettingsEnvelope, 'version'>,
): void {
  if (!storage) {
    return;
  }

  storage.setItem(
    GAME_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...envelope,
      version: GAME_SETTINGS_SCHEMA_VERSION,
    }),
  );
}

function readEnvelope(raw: string | null): VersionedGameSettingsEnvelope | null {
  if (!raw) {
    return null;
  }

  try {
    return migrateGameSettingsPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}
