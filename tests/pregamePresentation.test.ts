import { describe, expect, it } from 'vitest';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import { BROADCAST_EXPERIENCE_SETTINGS } from '../src/config/GameExperienceSettings';
import { resolveTeamPresentationTheme } from '../src/teams/TeamThemeApplier';
import { createGameplayRosterBinding } from '../src/roster/GameplayRosterBinding';
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
import {
  resolveQuarterbackSpotlightSubject,
} from '../src/presentation/pregame/SpotlightSubjectResolver';
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

  it('includes the quarterback spotlight in brief and full sequences but not off', () => {
    expect(createPregameSequence('brief').map((step) => step.shotId)).toEqual([
      'stadiumEstablish',
      'matchupCombined',
      'quarterbackSpotlight',
      'transitionToGameplay',
    ]);
    expect(createPregameSequence('full').map((step) => step.shotId)).toEqual([
      'stadiumEstablish',
      'userTeamTunnelOrSideline',
      'opponentTeamPan',
      'weatherAndField',
      'quarterbackSpotlight',
      'transitionToGameplay',
    ]);
    expect(createPregameSequence('off').some((step) => step.shotId === 'quarterbackSpotlight')).toBe(false);
  });

  it('resolves the user-team starting quarterback through the active lineup', () => {
    const context = createContext();
    const subject = resolveQuarterbackSpotlightSubject(context);

    expect(subject.gameplayPlayerId).toBe('offense-qb');
    expect(subject.rosterPlayerId).toBe('metro-meteors-qb-12');
    expect(subject.formattedName).toBe('J. CARTER');
    expect(subject.jerseyNumber).toBe(12);
    expect(subject.fallbackReason).toBeNull();
  });

  it('plays the quarterback line and lower third from resolved roster data', () => {
    const audio = createFakePregameAudioCoordinator();
    const lowerThird = createFakeLowerThird();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: lowerThird as unknown as PregameLowerThird,
      settings: { cinematics: 'brief' },
    });
    const context = createContext();

    director.start(context);
    advancePregameFrames(director, context, 30);
    audio.completedLineIds.add('welcome');
    director.update(0, context);
    advancePregameFrames(director, context, 34);
    audio.completedLineIds.add('matchup');
    director.update(0, context);
    director.update(0.1, context);

    expect(director.getSnapshot()).toMatchObject({
      currentShot: 'quarterbackSpotlight',
      spotlight: {
        cloneStatus: 'usingFormationPlayer',
        gameplayPlayerId: 'offense-qb',
        rosterPlayerId: 'metro-meteors-qb-12',
        selectedCommentaryId: 'pregame_qb_test',
      },
    });
    expect(audio.startedLines).toContain('quarterback');
    expect(lowerThird.getSnapshot()).toMatchObject({
      abbreviation: '12',
      detail: 'QB - MET',
      displayName: 'J. CARTER',
      visible: true,
    });
  });

  it('does not replay the quarterback spotlight later in the same match', () => {
    const audio = createFakePregameAudioCoordinator();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: createFakeLowerThird() as unknown as PregameLowerThird,
      settings: { cinematics: 'brief' },
    });
    const context = createContext();

    director.start(context);
    advancePregameFrames(director, context, 30);
    audio.completedLineIds.add('welcome');
    director.update(0, context);
    advancePregameFrames(director, context, 34);
    audio.completedLineIds.add('matchup');
    director.update(0, context);
    director.update(0.1, context);
    expect(director.getSnapshot().currentShot).toBe('quarterbackSpotlight');

    director.start(context);

    expect(director.getSnapshot().sequence).toEqual([
      'stadiumEstablish',
      'matchupCombined',
      'transitionToGameplay',
    ]);
  });

  it('allows the quarterback spotlight again after presentation identity reset', () => {
    const audio = createFakePregameAudioCoordinator();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: createFakeLowerThird() as unknown as PregameLowerThird,
      settings: { cinematics: 'brief' },
    });
    const context = createContext();

    director.start(context);
    advancePregameFrames(director, context, 30);
    audio.completedLineIds.add('welcome');
    director.update(0, context);
    advancePregameFrames(director, context, 34);
    audio.completedLineIds.add('matchup');
    director.update(0, context);
    director.update(0.1, context);
    expect(director.getSnapshot().currentShot).toBe('quarterbackSpotlight');

    director.resetPresentationIdentity();
    director.start(context);

    expect(director.getSnapshot().sequence).toContain('quarterbackSpotlight');
  });

  it('falls back safely when quarterback roster data is unavailable', () => {
    const context = createContext();
    const brokenContext: PregamePresentationContext = {
      ...context,
      rosterBinding: {
        ...context.rosterBinding,
        activeLineup: {
          ...context.rosterBinding.activeLineup,
          bindings: context.rosterBinding.activeLineup.bindings.filter(
            (binding) => binding.footballPosition !== 'QB',
          ),
        },
      },
    };
    const subject = resolveQuarterbackSpotlightSubject(brokenContext);

    expect(subject.formattedName).toBe('J. CARTER');
    expect(subject.gameplayPlayerId).toBe('offense-qb');
    expect(subject.fallbackReason).toBe('missingLineup');
  });
});

function createContext(): PregamePresentationContext {
  const gameplay = createGameplayModel({
    challengeMode: 'exhibition',
    playbookId: '11v11',
  });
  const teamProfiles = BROADCAST_EXPERIENCE_SETTINGS.teamProfiles;

  return {
    aspectRatio: 16 / 9,
    gameplaySnapshot: snapshotGameplayModel(gameplay),
    matchSnapshot: null,
    rosterBinding: createGameplayRosterBinding('11v11', teamProfiles),
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
    teamTheme: resolveTeamPresentationTheme(teamProfiles),
    weatherCondition: 'clear',
  };
}

function advancePregameFrames(
  director: PregamePresentationDirector,
  context: PregamePresentationContext,
  frames: number,
): void {
  for (let frame = 0; frame < frames; frame += 1) {
    director.update(0.1, context);
  }
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
      quarterback: createSelection('pregame_qb_test'),
      weather: createSelection('pregame_weather_test'),
      welcome: createSelection('pregame_welcome_test'),
    }),
    fadeTitleMusicToGameplay: () => undefined,
    getSnapshot: () => ({
      activeLine: null,
      completedLineIds: [...completedLineIds],
      crowdActiveLoopIds: [],
      crowdDuckingGain: 1,
      crowdGain: 1,
      failedLineIds: [],
      history: [],
      musicGain: 0.72,
      musicLoopActive: false,
      musicState: 'idle',
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
