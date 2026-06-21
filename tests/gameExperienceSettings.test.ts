import { describe, expect, it } from 'vitest';
import {
  BROADCAST_EXPERIENCE_SETTINGS,
  GAME_EXPERIENCE_SETTINGS_STORAGE_KEY,
  PERFORMANCE_EXPERIENCE_SETTINGS,
  resolveDevelopmentModeFlags,
  resolveGameExperienceSettings,
  saveGameExperienceSettings,
  toGameplayCameraMode,
} from '../src/config/GameExperienceSettings';
import type { StorageLike } from '../src/audio/AudioSettings';

describe('game experience settings', () => {
  it('resolves a plain URL to the broadcast preset', () => {
    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams(),
      storage: createMemoryStorage(),
    });

    expect(resolved.settings).toEqual(BROADCAST_EXPERIENCE_SETTINGS);
    expect(resolved.audioFeatureFlags).toMatchObject({
      announcerEnabled: true,
      audioEnabled: true,
      crowdAudioEnabled: true,
    });
    expect(resolved.crowdPresentationSettings).toMatchObject({
      crowdDensity: 'low',
      crowdReactionsEnabled: true,
      crowdVisualsEnabled: true,
    });
    expect(resolved.settings.playbookId).toBe('11v11');
    expect(toGameplayCameraMode(resolved.settings.gameplayCamera)).toBe('offensePerspective');
  });

  it('resolves the performance preset with expensive visual presentation disabled', () => {
    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams('experience=performance'),
      storage: createMemoryStorage(),
    });

    expect(resolved.settings).toEqual(PERFORMANCE_EXPERIENCE_SETTINGS);
    expect(resolved.settings).toMatchObject({
      audioEnabled: true,
      cinematics: 'off',
      crowdReactionsEnabled: false,
      crowdVisualsEnabled: false,
      gameplayCamera: 'offense',
      playerMotionEnabled: true,
      playbookId: '11v11',
    });
  });

  it('persists custom settings', () => {
    const storage = createMemoryStorage();

    saveGameExperienceSettings({
      ...BROADCAST_EXPERIENCE_SETTINGS,
      captionsEnabled: true,
      crowdDensity: 'medium',
      crowdVisualsEnabled: false,
      gameplayCamera: 'cinematic',
      preset: 'custom',
    }, storage);

    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams(),
      storage,
    });

    expect(resolved.persistedSettings.preset).toBe('custom');
    expect(resolved.settings).toMatchObject({
      captionsEnabled: true,
      crowdDensity: 'medium',
      crowdVisualsEnabled: false,
      gameplayCamera: 'cinematic',
      preset: 'custom',
    });
  });

  it('persists non-custom game mode selections', () => {
    const storage = createMemoryStorage();

    saveGameExperienceSettings({
      ...BROADCAST_EXPERIENCE_SETTINGS,
      playbookId: '5v5',
    }, storage);

    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams(),
      storage,
    });

    expect(resolved.persistedSettings).toMatchObject({
      preset: 'broadcast',
      settings: {
        playbookId: '5v5',
        preset: 'broadcast',
      },
    });
    expect(resolved.settings).toMatchObject({
      playbookId: '5v5',
      preset: 'broadcast',
    });
  });

  it('lets query overrides win without modifying persisted settings', () => {
    const storage = createMemoryStorage();
    saveGameExperienceSettings(PERFORMANCE_EXPERIENCE_SETTINGS, storage);
    const storedBefore = storage.getItem(GAME_EXPERIENCE_SETTINGS_STORAGE_KEY);

    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams('camera=cinematic&cinematics=full&crowdVisuals=1&crowdDensity=high&announcer=0&captions=1&playbook=5v5'),
      storage,
    });

    expect(resolved.settings).toMatchObject({
      announcerEnabled: false,
      captionsEnabled: true,
      cinematics: 'full',
      crowdDensity: 'high',
      crowdVisualsEnabled: true,
      gameplayCamera: 'cinematic',
      playbookId: '5v5',
      preset: 'performance',
    });
    expect(resolved.hasQueryOverrides).toBe(true);
    expect(resolved.queryOverrides).toMatchObject({
      announcerEnabled: false,
      captionsEnabled: true,
      crowdDensity: 'high',
      crowdVisualsEnabled: true,
      gameplayCamera: 'cinematic',
      playbookId: '5v5',
    });
    expect(storage.getItem(GAME_EXPERIENCE_SETTINGS_STORAGE_KEY)).toBe(storedBefore);
  });

  it('keeps 11v11 as the normal broadcast playbook without requiring a query override', () => {
    const storage = createMemoryStorage();

    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams(),
      storage,
    });

    expect(resolved.settings).toMatchObject({
      playbookId: '11v11',
      qualityMode: 'adaptive60',
      preset: 'broadcast',
    });
    expect(resolved.queryOverrides).toEqual({});
    expect(storage.getItem(GAME_EXPERIENCE_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('keeps 7v7 available as an explicit query override', () => {
    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams('playbook=7v7'),
      storage: createMemoryStorage(),
    });

    expect(resolved.settings).toMatchObject({
      playbookId: '7v7',
      preset: 'broadcast',
    });
    expect(resolved.queryOverrides).toEqual({
      playbookId: '7v7',
    });
  });

  it('supports explicit quality-mode query overrides', () => {
    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams('quality=locked-performance'),
      storage: createMemoryStorage(),
    });

    expect(resolved.settings.qualityMode).toBe('lockedPerformance');
    expect(resolved.queryOverrides).toEqual({
      qualityMode: 'lockedPerformance',
    });
  });

  it('locks benchmark profile quality when performance profiling is active', () => {
    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams('perfProfile=1'),
      storage: createMemoryStorage(),
    });

    expect(resolved.settings.qualityMode).toBe('lockedBroadcast');
    expect(resolved.queryOverrides).toEqual({
      qualityMode: 'lockedBroadcast',
    });
  });

  it('keeps preview and audit modes opt-in development flags', () => {
    expect(resolveDevelopmentModeFlags(new URLSearchParams())).toEqual({
      appearanceAudit: false,
      crowdPreview: false,
      formationPreview: false,
      passAudit: false,
      presentationAudit: false,
      routeAudit: false,
      shotPreview: false,
    });
    expect(
      resolveDevelopmentModeFlags(
        new URLSearchParams('formationPreview=7v7&crowdPreview=1&routeAudit=1&passAudit=1&presentationAudit=1&shotPreview=prePlayOrbit180&appearanceAudit=1'),
      ),
    ).toEqual({
      appearanceAudit: true,
      crowdPreview: true,
      formationPreview: true,
      passAudit: true,
      presentationAudit: true,
      routeAudit: true,
      shotPreview: true,
    });
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
