import { describe, expect, it } from 'vitest';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import { BROADCAST_EXPERIENCE_SETTINGS } from '../src/config/GameExperienceSettings';
import { resolveTeamPresentationTheme } from '../src/teams/TeamThemeApplier';
import { createGameplayRosterBinding } from '../src/roster/GameplayRosterBinding';
import {
  PregameAudioCoordinator,
  type PregameAudioPort,
} from '../src/presentation/pregame/PregameAudioCoordinator';
import type {
  AudioMixerSnapshot,
  AudioPlaybackCompletion,
  AudioPlaybackHandle,
} from '../src/audio/AudioMixer';
import type { TitleMusicController } from '../src/audio/TitleMusicController';
import type { GameAudioDirector } from '../src/audio/GameAudioDirector';
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
  createPregameWarmupLayout,
} from '../src/presentation/pregame/PregameWarmupLayout';
import type {
  PregameWarmupPlacement,
  PregameWarmupSnapshot,
} from '../src/presentation/pregame/PregameWarmupTypes';
import {
  resolveQuarterbackSpotlightSubject,
} from '../src/presentation/pregame/SpotlightSubjectResolver';
import {
  createQuarterbackScoutingProfile,
} from '../src/roster/QuarterbackScoutingProfile';
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

    expect(director.getSnapshot().currentShot).toBe('matchupWide');
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
      'matchupWide',
      'weatherAndField',
      'quarterbackSpotlight',
      'transitionToGameplay',
    ]);
    expect(createPregameSequence('full').map((step) => step.shotId)).toEqual([
      'stadiumEstablish',
      'matchupWide',
      'userWarmupPan',
      'opponentWarmupPan',
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
    expect(subject.playerPosition.x).toBeCloseTo(context.warmupSnapshot.quarterback!.bounds.center.x, 6);
    expect(subject.playerPosition.z).toBeCloseTo(context.warmupSnapshot.quarterback!.bounds.center.z, 6);
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
    advancePregameFrames(director, context, 43);
    audio.completedLineIds.add('matchup');
    director.update(0, context);
    advancePregameFrames(director, context, 36);
    audio.completedLineIds.add('weather');
    director.update(0, context);
    director.update(0.1, context);

    expect(director.getSnapshot()).toMatchObject({
      currentShot: 'quarterbackSpotlight',
      spotlight: {
        cloneStatus: 'usingWarmupClone',
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
    advancePregameFrames(director, context, 43);
    audio.completedLineIds.add('matchup');
    director.update(0, context);
    advancePregameFrames(director, context, 36);
    audio.completedLineIds.add('weather');
    director.update(0, context);
    director.update(0.1, context);
    expect(director.getSnapshot().currentShot).toBe('quarterbackSpotlight');

    director.start(context);

    expect(director.getSnapshot().sequence).toEqual([
      'stadiumEstablish',
      'matchupWide',
      'weatherAndField',
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
    advancePregameFrames(director, context, 43);
    audio.completedLineIds.add('matchup');
    director.update(0, context);
    advancePregameFrames(director, context, 36);
    audio.completedLineIds.add('weather');
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

  it('keeps matchup commentary on one continuous wide shot', () => {
    const audio = createFakePregameAudioCoordinator();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: createFakeLowerThird() as unknown as PregameLowerThird,
      settings: { cinematics: 'full' },
    });
    const context = createContext();

    director.start(context);
    advancePregameFrames(director, context, 30);
    audio.completedLineIds.add('welcome');
    director.update(0, context);

    expect(director.getSnapshot()).toMatchObject({
      activeSubject: 'matchupWide',
      activeTeam: null,
      currentShot: 'matchupWide',
      nextShot: 'userWarmupPan',
      subjectReady: true,
    });

    advancePregameFrames(director, context, 60);

    expect(director.getSnapshot().currentShot).toBe('matchupWide');
  });

  it('uses a stable field shot instead of an empty team pan when team zones are unavailable', () => {
    const audio = createFakePregameAudioCoordinator();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: createFakeLowerThird() as unknown as PregameLowerThird,
      settings: { cinematics: 'brief' },
    });
    const context: PregamePresentationContext = {
      ...createContext(),
      sidelineSnapshot: {
        ...createContext().sidelineSnapshot,
        zones: [],
      },
      warmupSnapshot: createEmptyWarmupSnapshot(),
    };

    director.start(context);
    advancePregameFrames(director, context, 30);
    audio.completedLineIds.add('welcome');
    director.update(0, context);

    const snapshot = director.getSnapshot();
    expect(snapshot.currentShot).toBe('matchupWide');
    expect(snapshot.subjectBounds?.source).toBe('field');
    expect(snapshot.subjectReady).toBe(false);
  });
});

describe('pregame audio coordinator', () => {
  it('queues a second pregame line until the active clip actually ends plus the quiet gap', async () => {
    const mixer = new FakePregameMixer();
    const titleMusic = createFakeTitleMusicController();
    const coordinator = new PregameAudioCoordinator(
      mixer,
      titleMusic as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
      {
        quietGapSeconds: 0.32,
        safetyTimeoutPaddingSeconds: 3,
      },
    );

    coordinator.startLine('welcome', createSelection('pregame_welcome_test', 0.1));
    await waitForMicrotasks();
    coordinator.startLine('matchup', createSelection('pregame_matchup_test', 0.1));

    expect(mixer.playedAssetIds).toEqual(['pregame_welcome_test']);
    expect(coordinator.getSnapshot()).toMatchObject({
      activeLine: { lineId: 'welcome', playbackState: 'playing' },
      playbackState: 'playing',
      queuedLine: { lineId: 'matchup', playbackState: 'queued' },
    });

    mixer.finish('pregame_welcome_test');
    await waitForMicrotasks();
    mixer.advance(0.31);
    coordinator.getSnapshot();

    expect(mixer.playedAssetIds).toEqual(['pregame_welcome_test']);
    expect(coordinator.isLineComplete('welcome')).toBe(false);

    mixer.advance(0.02);
    coordinator.getSnapshot();
    await waitForMicrotasks();

    expect(coordinator.isLineComplete('welcome')).toBe(true);
    expect(mixer.playedAssetIds).toEqual([
      'pregame_welcome_test',
      'pregame_matchup_test',
    ]);
    expect(coordinator.getSnapshot()).toMatchObject({
      activeLine: { lineId: 'matchup' },
      queuedLine: null,
    });
  });

  it('does not complete a pregame line from catalog duration alone', async () => {
    const mixer = new FakePregameMixer();
    const coordinator = new PregameAudioCoordinator(
      mixer,
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
      {
        quietGapSeconds: 0.2,
        safetyTimeoutPaddingSeconds: 5,
      },
    );

    coordinator.startLine('welcome', createSelection('pregame_welcome_test', 0.1));
    await waitForMicrotasks();
    mixer.advance(1);
    coordinator.getSnapshot();

    expect(coordinator.isLineComplete('welcome')).toBe(false);

    mixer.finish('pregame_welcome_test');
    await waitForMicrotasks();
    mixer.advance(0.2);
    coordinator.getSnapshot();

    expect(coordinator.isLineComplete('welcome')).toBe(true);
  });

  it('uses decoded playback duration for safety timing when generated audio exceeds catalog duration', async () => {
    const mixer = new FakePregameMixer({
      handleDurations: new Map([['pregame_welcome_test', 0.72]]),
    });
    const coordinator = new PregameAudioCoordinator(
      mixer,
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
      {
        quietGapSeconds: 0.2,
        safetyTimeoutPaddingSeconds: 0.1,
      },
    );

    coordinator.startLine('welcome', createSelection('pregame_welcome_test', 0.1));
    await waitForMicrotasks();
    mixer.advance(0.25);
    coordinator.getSnapshot();

    expect(coordinator.isLineComplete('welcome')).toBe(false);
    expect(mixer.stoppedAssetIds).toEqual([]);

    mixer.advance(0.47);
    mixer.finish('pregame_welcome_test');
    await waitForMicrotasks();
    mixer.advance(0.19);
    coordinator.getSnapshot();

    expect(coordinator.isLineComplete('welcome')).toBe(false);

    mixer.advance(0.02);
    coordinator.getSnapshot();

    expect(coordinator.isLineComplete('welcome')).toBe(true);
  });

  it('uses a wider default quiet gap before starting the next pregame line', async () => {
    const mixer = new FakePregameMixer();
    const coordinator = new PregameAudioCoordinator(
      mixer,
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
    );

    coordinator.startLine('welcome', createSelection('pregame_welcome_test', 0.1));
    await waitForMicrotasks();
    coordinator.startLine('matchup', createSelection('pregame_matchup_test', 0.1));

    mixer.finish('pregame_welcome_test');
    await waitForMicrotasks();
    mixer.advance(0.84);
    coordinator.getSnapshot();

    expect(coordinator.isLineComplete('welcome')).toBe(false);
    expect(mixer.playedAssetIds).toEqual(['pregame_welcome_test']);

    mixer.advance(0.02);
    coordinator.getSnapshot();
    await waitForMicrotasks();

    expect(coordinator.isLineComplete('welcome')).toBe(true);
    expect(mixer.playedAssetIds).toEqual([
      'pregame_welcome_test',
      'pregame_matchup_test',
    ]);
  });

  it('releases a failed pregame clip without hanging the sequence', async () => {
    const mixer = new FakePregameMixer({ failAssets: new Set(['pregame_welcome_test']) });
    const coordinator = new PregameAudioCoordinator(
      mixer,
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
    );

    coordinator.startLine('welcome', createSelection('pregame_welcome_test', 0.1));
    await coordinator.flushPendingAudioForTests();

    expect(coordinator.isLineComplete('welcome')).toBe(true);
    expect(coordinator.getSnapshot().failedLineIds).toEqual(['welcome']);
  });

  it('skip clears active and queued pregame lines', async () => {
    const mixer = new FakePregameMixer();
    const coordinator = new PregameAudioCoordinator(
      mixer,
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
    );

    coordinator.startLine('welcome', createSelection('pregame_welcome_test', 0.5));
    await waitForMicrotasks();
    coordinator.startLine('matchup', createSelection('pregame_matchup_test', 0.5));

    expect(coordinator.getSnapshot().queuedLine?.lineId).toBe('matchup');

    coordinator.skip();

    expect(coordinator.getSnapshot()).toMatchObject({
      activeLine: null,
      completedLineIds: [],
      failedLineIds: [],
      playbackState: 'idle',
      queuedLine: null,
    });
    expect(mixer.stoppedCategories).toEqual(['announcer']);
  });
});

function createContext(): PregamePresentationContext {
  const gameplay = createGameplayModel({
    challengeMode: 'exhibition',
    playbookId: '11v11',
  });
  const teamProfiles = BROADCAST_EXPERIENCE_SETTINGS.teamProfiles;
  const rosterBinding = createGameplayRosterBinding('11v11', teamProfiles);
  const teamTheme = resolveTeamPresentationTheme(teamProfiles);

  return {
    aspectRatio: 16 / 9,
    gameplaySnapshot: snapshotGameplayModel(gameplay),
    matchSnapshot: null,
    rosterBinding,
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
    teamTheme,
    warmupSnapshot: createWarmupSnapshot(rosterBinding, teamTheme.teamKey),
    weatherCondition: 'clear',
  };
}

function createWarmupSnapshot(
  rosterBinding: ReturnType<typeof createGameplayRosterBinding>,
  teamKey: string,
): PregameWarmupSnapshot {
  const layout = createPregameWarmupLayout(rosterBinding);
  const quarterback = layout.userQuarterback;
  const profile = createQuarterbackScoutingProfile(quarterback?.player ?? null);

  return {
    cloneCount: layout.placements.length,
    drawCalls: 0,
    enabled: true,
    geometryCount: 0,
    groupCount: layout.groups.length,
    groups: layout.groups,
    instanceBufferBytes: 0,
    materialCount: 0,
    meshCount: 0,
    noGameplayAuthority: true,
    opponentReady: Boolean(layout.opponentQuarterback),
    playerCount: layout.placements.length,
    propCount: layout.props.length,
    quarterback: quarterback
      ? {
          archetype: profile.archetype,
          bounds: warmupPlacementToBounds(quarterback),
          formattedName: profile.formattedName,
          jerseyNumber: profile.jerseyNumber,
          ratings: profile.ratings,
          rosterPlayerId: profile.rosterPlayerId,
          strengths: profile.strengths,
        }
      : null,
    ready: Boolean(layout.userQuarterback && layout.opponentQuarterback),
    teamKey,
    textureCount: 0,
    triangleCount: 0,
    updateFrequencyHz: 10,
    userReady: Boolean(layout.userQuarterback),
    zones: layout.zones,
  };
}

function createEmptyWarmupSnapshot(): PregameWarmupSnapshot {
  return {
    cloneCount: 0,
    drawCalls: 0,
    enabled: false,
    geometryCount: 0,
    groupCount: 0,
    groups: [],
    instanceBufferBytes: 0,
    materialCount: 0,
    meshCount: 0,
    noGameplayAuthority: true,
    opponentReady: false,
    playerCount: 0,
    propCount: 0,
    quarterback: null,
    ready: false,
    teamKey: 'empty',
    textureCount: 0,
    triangleCount: 0,
    updateFrequencyHz: 0,
    userReady: false,
    zones: [],
  };
}

function warmupPlacementToBounds(placement: PregameWarmupPlacement) {
  return {
    center: {
      x: placement.position.x,
      y: 1.28,
      z: placement.position.z,
    },
    max: {
      x: placement.position.x + 1.05,
      z: placement.position.z + 1.25,
    },
    min: {
      x: placement.position.x - 1.05,
      z: placement.position.z - 1.25,
    },
    size: {
      x: 2.1,
      z: 2.5,
    },
    source: 'user-quarterback-warmup',
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
      playbackState: 'idle',
      queuedLine: null,
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

function createSelection(scriptId: string, durationSeconds = 4) {
  return {
    assetId: scriptId,
    available: true,
    caption: scriptId,
    clip: {
      assetId: scriptId,
      caption: scriptId,
      category: 'welcome' as const,
      durationSeconds,
      script: scriptId,
      scriptId,
      variant: 1,
    },
    fallbackReason: null,
    script: scriptId,
    scriptId,
  };
}

function createFakeTitleMusicController() {
  return {
    fadeOutForGameplay: () => undefined,
    getSnapshot: () => ({
      assetId: 'title',
      attempted: false,
      handoffRequested: false,
      loopActive: false,
      loopGain: 0.72,
      state: 'idle',
    }),
    setPregameDucking: () => undefined,
  };
}

function createFakeGameAudioDirector() {
  return {
    processEvents: () => undefined,
  };
}

async function waitForMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

class FakePregameMixer implements PregameAudioPort {
  readonly playedAssetIds: string[] = [];
  readonly stoppedAssetIds: string[] = [];
  readonly stoppedCategories: string[] = [];
  private readonly failAssets: ReadonlySet<string>;
  private readonly handleDurations: ReadonlyMap<string, number>;
  private readonly handles = new Map<string, FakePlaybackHandle>();
  private timeSeconds = 0;

  constructor(options: {
    failAssets?: ReadonlySet<string>;
    handleDurations?: ReadonlyMap<string, number>;
  } = {}) {
    this.failAssets = options.failAssets ?? new Set();
    this.handleDurations = options.handleDurations ?? new Map();
  }

  advance(seconds: number): void {
    this.timeSeconds += seconds;
  }

  finish(assetId: string, endedAt = this.timeSeconds): void {
    const handle = this.handles.get(assetId);
    if (!handle) {
      throw new Error(`No fake handle for ${assetId}`);
    }
    handle.finish(endedAt);
  }

  getCurrentTime(): number {
    return this.timeSeconds;
  }

  getSnapshot(): AudioMixerSnapshot {
    return {
      activeAudioNodeCount: this.handles.size,
      activeBuses: ['master', 'announcer'],
      activeLoops: [],
      activeOneShots: this.handles.size,
      activeSourceCount: this.handles.size,
      announcerEnabled: true,
      busGains: {
        announcer: 1,
        crowd: 1,
        gameplaySfx: 1,
        master: 1,
        music: 1,
        ui: 1,
      },
      captionsEnabled: false,
      contextState: 'running',
      crowdDuckingGain: 1,
      decodedAssetIds: [],
      decodedBufferBytes: 0,
      enabled: true,
      lastUnlockError: null,
      loadedAssetIds: [],
      loadedCompressedBytes: 0,
      longestLoadedClipSeconds: null,
      missingOptionalAssetIds: [],
      muted: false,
      preparedMediaElementSourceCount: 0,
      streamedAssetIds: [],
      userGestureUnlocked: true,
    };
  }

  playOneShot(assetId: string): Promise<boolean> {
    return this.playOneShotTracked(assetId).then((handle) => handle !== null);
  }

  playOneShotTracked(assetId: string): Promise<AudioPlaybackHandle | null> {
    if (this.failAssets.has(assetId)) {
      return Promise.resolve(null);
    }
    this.playedAssetIds.push(assetId);
    const handle = new FakePlaybackHandle(
      assetId,
      this.timeSeconds,
      this.handleDurations.get(assetId),
      (stoppedAssetId) => this.stoppedAssetIds.push(stoppedAssetId),
    );
    this.handles.set(assetId, handle);
    handle.ended.then(() => {
      this.handles.delete(assetId);
    });
    return Promise.resolve(handle);
  }

  setCrowdDuckingGain(): void {
    return undefined;
  }

  setSettings() {
    return {} as never;
  }

  stopOneShotsByCategory(category: 'announcer' | 'crowd' | 'gameplaySfx' | 'music' | 'ui'): number {
    this.stoppedCategories.push(category);
    const handles = [...this.handles.values()].filter((handle) => handle.category === category);
    for (const handle of handles) {
      handle.stop();
    }
    return handles.length;
  }
}

class FakePlaybackHandle implements AudioPlaybackHandle {
  readonly category = 'announcer' as const;
  readonly ended: Promise<AudioPlaybackCompletion>;
  private resolveEnded: (completion: AudioPlaybackCompletion) => void = () => undefined;
  private settled = false;

  constructor(
    readonly assetId: string,
    readonly startedAt: number,
    readonly durationSeconds: number | undefined,
    private readonly onStop: (assetId: string) => void = () => undefined,
  ) {
    this.ended = new Promise((resolve) => {
      this.resolveEnded = resolve;
    });
  }

  finish(endedAt: number): void {
    this.resolve('ended', endedAt);
  }

  stop(): void {
    this.onStop(this.assetId);
    this.resolve('stopped', this.startedAt);
  }

  private resolve(reason: AudioPlaybackCompletion['reason'], endedAt: number): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.resolveEnded({
      assetId: this.assetId,
      category: this.category,
      endedAt,
      reason,
      startedAt: this.startedAt,
      stopped: reason === 'stopped',
    });
  }
}
