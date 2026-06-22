import { describe, expect, it } from 'vitest';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import { BROADCAST_EXPERIENCE_SETTINGS } from '../src/config/GameExperienceSettings';
import { resolveTeamPresentationTheme } from '../src/teams/TeamThemeApplier';
import type { PregameAudioCoordinator } from '../src/presentation/pregame/PregameAudioCoordinator';
import {
  PregamePresentationDirector,
} from '../src/presentation/pregame/PregamePresentationDirector';
import {
  createHiddenLowerThirdState,
  type PregameLowerThird,
} from '../src/presentation/pregame/PregameLowerThird';
import {
  createPregameCameraShot,
  createPregameSequence,
} from '../src/presentation/pregame/PregameShotDefinitions';
import type {
  PregameCommentaryLineId,
  PregamePresentationContext,
} from '../src/presentation/pregame/PregamePresentationTypes';

describe('pregame presentation sequence', () => {
  it('skips the intro when cinematics are off', () => {
    const audio = createFakePregameAudioCoordinator();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: createFakeLowerThird() as unknown as PregameLowerThird,
      settings: { cinematics: 'off' },
    });

    expect(director.start(createContext())).toBe(false);
    expect(director.getSnapshot()).toMatchObject({
      completed: true,
      phase: 'completed',
      sequence: [],
    });
  });

  it('does not complete a commentary-gated shot before the line completes', () => {
    const audio = createFakePregameAudioCoordinator();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: createFakeLowerThird() as unknown as PregameLowerThird,
      settings: { cinematics: 'brief' },
    });
    const context = createContext();

    expect(director.start(context)).toBe(true);
    for (let frame = 0; frame < 30; frame += 1) {
      director.update(0.1, context);
    }

    expect(director.getSnapshot()).toMatchObject({
      currentShot: 'stadiumEstablish',
      phase: 'running',
    });
    expect(audio.startedLines).toEqual(['welcome']);

    audio.completedLineIds.add('welcome');
    director.update(0, context);

    expect(director.getSnapshot().currentShot).toBe('matchupCombined');
  });

  it('clears commentary and marks the sequence skipped', () => {
    const audio = createFakePregameAudioCoordinator();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: createFakeLowerThird() as unknown as PregameLowerThird,
      settings: { cinematics: 'full' },
    });

    director.start(createContext());
    const snapshot = director.skip();

    expect(snapshot).toMatchObject({
      completed: true,
      phase: 'skipped',
      skipState: 'skipped',
    });
    expect(audio.skipped).toBe(true);
  });

  it('creates camera shots that restore the selected gameplay camera', () => {
    const context = createContext();
    const step = createPregameSequence('full')[0];
    const shot = createPregameCameraShot(step, context, 0.5);

    expect(shot.restoreCamera).toBe('offensePerspective');
    expect(shot.phase).toBe('preSnapEstablish');
    expect(shot.position.y).toBeGreaterThan(4);
  });
});

function createContext(): PregamePresentationContext {
  const gameplay = createGameplayModel({
    challengeMode: 'exhibition',
    playbookId: '11v11',
  });

  return {
    aspectRatio: 16 / 9,
    gameplaySnapshot: snapshotGameplayModel(gameplay),
    matchSnapshot: null,
    sidelineSnapshot: {
      density: 'low',
      drawCalls: 0,
      enabled: true,
      geometryCount: 0,
      instanceBufferBytes: 0,
      materialCount: 0,
      meshCount: 0,
      noGameplayAuthority: true,
      sidelinePlayerCount: 0,
      teamKey: 'test',
      textureCount: 0,
      triangleCount: 0,
      tunnelPlayerCount: 0,
      tunnelTableauEnabled: false,
      updateFrequencyHz: 0,
      zones: [
        {
          bounds: { maxX: -38, maxZ: 18, minX: -52, minZ: -18 },
          center: { x: -45, y: 0, z: 0 },
          id: 'user-sideline',
          teamSide: 'user',
        },
        {
          bounds: { maxX: 52, maxZ: 18, minX: 38, minZ: -18 },
          center: { x: 45, y: 0, z: 0 },
          id: 'opponent-sideline',
          teamSide: 'opponent',
        },
      ],
    },
    stadiumSnapshot: {
      drawCalls: 0,
      enabled: true,
      geometryCount: 0,
      imageMaterialsEnabled: false,
      materialCount: 0,
      lowerTierRows: 0,
      seatCount: 0,
      textureCount: 0,
      triangles: 0,
      upperTierEnabled: false,
    },
    targetGameplayCamera: 'offensePerspective',
    teamTheme: resolveTeamPresentationTheme(BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
    weatherCondition: 'clear',
  };
}

function createFakeLowerThird() {
  let state = createHiddenLowerThirdState();
  return {
    getSnapshot: () => ({ ...state }),
    hide: () => {
      state = createHiddenLowerThirdState();
    },
    sync: (nextState: typeof state) => {
      state = { ...nextState };
    },
  };
}

function createFakePregameAudioCoordinator() {
  const completedLineIds = new Set<PregameCommentaryLineId>();
  const startedLines: PregameCommentaryLineId[] = [];
  return {
    completedLineIds,
    skipped: false,
    startedLines,
    createSelections: () => ({
      matchup: createSelection('pregame_matchup_test'),
      weather: createSelection('pregame_weather_test'),
      welcome: createSelection('pregame_welcome_test'),
    }),
    fadeTitleMusicToGameplay: () => undefined,
    getSnapshot: () => ({
      activeLine: null,
      completedLineIds: [...completedLineIds],
      crowdGain: 1,
      failedLineIds: [],
      history: [],
      musicGain: 0.72,
    }),
    isLineComplete: (lineId: PregameCommentaryLineId) => completedLineIds.has(lineId),
    reset: () => {
      completedLineIds.clear();
      startedLines.length = 0;
    },
    skip() {
      this.skipped = true;
    },
    startLine: (lineId: PregameCommentaryLineId) => {
      startedLines.push(lineId);
    },
    updateAmbience: () => undefined,
  };
}

function createSelection(scriptId: string) {
  return {
    assetId: scriptId,
    available: true,
    caption: scriptId,
    clip: {
      assetId: scriptId,
      caption: scriptId,
      category: 'welcome' as const,
      durationSeconds: 4,
      script: scriptId,
      scriptId,
      variant: 1,
    },
    fallbackReason: null,
    script: scriptId,
    scriptId,
  };
}
