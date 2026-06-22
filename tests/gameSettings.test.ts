import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../src/audio/AudioSettings';
import {
  BROADCAST_GAME_SETTINGS,
  GAME_SETTINGS_COMPAT_STORAGE_KEY,
  loadPersistedGameSettings,
  resolveGameSettings,
  saveGameSettings,
} from '../src/config/GameSettings';
import {
  GAME_SETTINGS_SCHEMA_VERSION,
  LEGACY_GAME_EXPERIENCE_SETTINGS_STORAGE_KEY,
} from '../src/config/GameSettingsStore';

describe('game settings facade', () => {
  it('resolves plain launch to the broadcast player-facing profile', () => {
    const resolved = resolveGameSettings({
      searchParams: new URLSearchParams(),
      storage: createMemoryStorage(),
    });

    expect(resolved.settings).toMatchObject({
      audioEnabled: true,
      cinematics: 'brief',
      crowdDensity: 'low',
      crowdFullness: 'full',
      crowdVisualsEnabled: true,
      debugToolsEnabled: false,
      officialsDebugLabels: false,
      officialsEnabled: true,
      playerMotionEnabled: true,
      playbookId: '11v11',
      preset: 'broadcast',
      routeArtEnabled: true,
      sidelineDensity: 'medium',
      sidelinePlayersEnabled: true,
      stadiumEnabled: true,
      tunnelTableauEnabled: true,
    });
  });

  it('persists a versioned schema including volumes and debug preferences', () => {
    const storage = createMemoryStorage();

    saveGameSettings({
      ...BROADCAST_GAME_SETTINGS,
      crowdVolume: 0.31,
      debugToolsEnabled: true,
      masterVolume: 0.62,
      musicVolume: 0.4,
      muted: true,
      officialsDebugLabels: true,
      officialsEnabled: true,
      stadiumEnabled: false,
      preset: 'custom',
    }, storage);

    const raw = storage.getItem(GAME_SETTINGS_COMPAT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '{}')).toMatchObject({
      version: GAME_SETTINGS_SCHEMA_VERSION,
      settings: {
        crowdVolume: 0.31,
        debugToolsEnabled: true,
        masterVolume: 0.62,
        musicVolume: 0.4,
        muted: true,
        officialsDebugLabels: true,
        officialsEnabled: true,
        stadiumEnabled: false,
      },
    });

    const persisted = loadPersistedGameSettings(storage);
    expect(persisted).toMatchObject({
      version: GAME_SETTINGS_SCHEMA_VERSION,
      settings: {
        debugToolsEnabled: true,
        officialsDebugLabels: true,
        officialsEnabled: true,
        stadiumEnabled: false,
      },
    });
  });

  it('migrates the legacy experience-settings payload', () => {
    const storage = createMemoryStorage();
    storage.setItem(LEGACY_GAME_EXPERIENCE_SETTINGS_STORAGE_KEY, JSON.stringify({
      preset: 'custom',
      settings: {
        ...BROADCAST_GAME_SETTINGS,
        captionsEnabled: true,
        debugToolsEnabled: true,
        officialsDebugLabels: true,
        preset: 'custom',
      },
    }));

    const resolved = resolveGameSettings({
      searchParams: new URLSearchParams(),
      storage,
    });

    expect(resolved.persistedSettings.version).toBe(GAME_SETTINGS_SCHEMA_VERSION);
    expect(resolved.settings).toMatchObject({
      captionsEnabled: true,
      debugToolsEnabled: false,
      officialsDebugLabels: false,
      preset: 'custom',
    });
  });

  it('migrates previous-schema debug settings to off while preserving normal settings', () => {
    const storage = createMemoryStorage();
    storage.setItem(GAME_SETTINGS_COMPAT_STORAGE_KEY, JSON.stringify({
      preset: 'custom',
      settings: {
        ...BROADCAST_GAME_SETTINGS,
        audioEnabled: false,
        crowdDensity: 'high',
        debugToolsEnabled: true,
        gameplayCamera: 'cinematic',
        masterVolume: 0.37,
        officialsDebugLabels: true,
        officialsEnabled: true,
        preset: 'custom',
        stadiumEnabled: false,
      },
      version: GAME_SETTINGS_SCHEMA_VERSION - 1,
    }));

    const resolved = resolveGameSettings({
      searchParams: new URLSearchParams(),
      storage,
    });

    expect(resolved.persistedSettings.version).toBe(GAME_SETTINGS_SCHEMA_VERSION);
    expect(resolved.settings).toMatchObject({
      audioEnabled: false,
      crowdDensity: 'high',
      crowdFullness: 'full',
      debugToolsEnabled: false,
      gameplayCamera: 'cinematic',
      masterVolume: 0.37,
      officialsDebugLabels: false,
      officialsEnabled: true,
      preset: 'custom',
      stadiumEnabled: false,
    });
  });

  it('keeps query overrides out of persisted settings', () => {
    const storage = createMemoryStorage();
    saveGameSettings(BROADCAST_GAME_SETTINGS, storage);
    const storedBefore = storage.getItem(GAME_SETTINGS_COMPAT_STORAGE_KEY);

    const resolved = resolveGameSettings({
      searchParams: new URLSearchParams('debugTools=1&officials=1&officialsDebug=1&masterVolume=0.2'),
      storage,
    });

    expect(resolved.settings).toMatchObject({
      debugToolsEnabled: true,
      masterVolume: 0.2,
      officialsDebugLabels: true,
      officialsEnabled: true,
    });
    expect(storage.getItem(GAME_SETTINGS_COMPAT_STORAGE_KEY)).toBe(storedBefore);
  });
});

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
