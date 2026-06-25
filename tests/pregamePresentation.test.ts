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
import type { VoicePackAssetResolver } from '../src/audio/voicePacks/VoicePackAssetResolver';
import type { VoicePackResolvedClip } from '../src/audio/voicePacks/VoicePackTypes';
import {
  createMatchModel,
  snapshotMatchModel,
} from '../src/match/MatchModel';
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
  resolveKeysToGame,
} from '../src/presentation/pregame/KeysToGameResolver';
import {
  createQuarterbackScoutingProfile,
} from '../src/roster/QuarterbackScoutingProfile';
import type {
  PregameCommentaryLineId,
  PregamePresentationContext,
  PregameShotId,
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
      currentShot: 'stadiumCenterOrbit',
      phase: 'running',
    });
    expect(audio.startedLines).toEqual(['welcome']);

    audio.completedLineIds.add('welcome');
    director.update(0, context);

    expect(director.getSnapshot()).toMatchObject({
      currentShot: 'stadiumCenterOrbit',
      introOverlay: 'matchup',
    });
    expect(audio.startedLines).toEqual(['welcome', 'matchup']);
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

  it('uses the calmer center-orbit sequence in brief and full modes but not off', () => {
    expect(createPregameSequence('brief').map((step) => step.shotId)).toEqual([
      'stadiumCenterOrbit',
      'quarterbackFrontSpotlight',
      'transitionToCoinToss',
    ]);
    expect(createPregameSequence('full').map((step) => step.shotId)).toEqual([
      'stadiumCenterOrbit360',
      'quarterbackFrontSpotlight',
      'transitionToCoinToss',
    ]);
    expect(createPregameSequence('off').some((step) => step.shotId === 'quarterbackFrontSpotlight')).toBe(false);
  });

  it('keeps the center orbit looking at field center with a stable elevated radius', () => {
    const context = createContext();
    const step = createPregameSequence('full')[0];
    const early = createPregameCameraShot(step, context, 0.1);
    const late = createPregameCameraShot(step, context, 0.85);
    const earlyRadius = Math.hypot(early.position.x, early.position.z);
    const lateRadius = Math.hypot(late.position.x, late.position.z);

    expect(early.lookTarget.x).toBeCloseTo(0, 6);
    expect(early.lookTarget.z).toBeCloseTo(0, 6);
    expect(late.lookTarget.x).toBeCloseTo(0, 6);
    expect(late.lookTarget.z).toBeCloseTo(0, 6);
    expect(early.position.y).toBeCloseTo(late.position.y, 6);
    expect(earlyRadius).toBeCloseTo(lateRadius, 6);
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
    advanceToQuarterbackFrontSpotlight(director, audio, context);
    director.update(0.1, context);

    expect(director.getSnapshot()).toMatchObject({
      currentShot: 'quarterbackFrontSpotlight',
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

  it('does not start the quarterback spotlight before the helmeted subject is ready', () => {
    const audio = createFakePregameAudioCoordinator();
    const lowerThird = createFakeLowerThird();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: lowerThird as unknown as PregameLowerThird,
      settings: { cinematics: 'brief' },
    });
    const context = createContextWithQuarterbackReadiness({
      fallbackReason: 'helmetLoading',
      helmetReady: false,
      subjectReady: false,
      subjectVisible: false,
    });

    director.start(context);
    advanceToQuarterbackFrontSpotlight(director, audio, context);
    const result = director.update(0.1, context);

    expect(result.shot).toBeNull();
    expect(audio.startedLines).not.toContain('quarterback');
    expect(lowerThird.getSnapshot().displayName).not.toBe('J. CARTER');
    expect(director.getSnapshot()).toMatchObject({
      currentShot: 'quarterbackFrontSpotlight',
      quarterbackAppearance: {
        fallbackReason: 'helmetLoading',
        helmetReady: false,
        subjectReady: false,
      },
      subjectReady: false,
    });

    advancePregameFrames(director, context, 25);
    expect(director.getSnapshot().currentShot).toBe('transitionToCoinToss');
    expect(audio.startedLines).not.toContain('quarterback');
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
    advanceToQuarterbackFrontSpotlight(director, audio, context);
    director.update(0.1, context);
    expect(director.getSnapshot().currentShot).toBe('quarterbackFrontSpotlight');

    director.start(context);

    expect(director.getSnapshot().sequence).toEqual([
      'stadiumCenterOrbit',
      'transitionToCoinToss',
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
    advanceToQuarterbackFrontSpotlight(director, audio, context);
    director.update(0.1, context);
    expect(director.getSnapshot().currentShot).toBe('quarterbackFrontSpotlight');

    director.resetPresentationIdentity();
    director.start(context);

    expect(director.getSnapshot().sequence).toContain('quarterbackFrontSpotlight');
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

  it('keeps matchup and weather commentary on one continuous center orbit', () => {
    const audio = createFakePregameAudioCoordinator();
    const director = new PregamePresentationDirector({
      audioCoordinator: audio as unknown as PregameAudioCoordinator,
      lowerThird: createFakeLowerThird() as unknown as PregameLowerThird,
      settings: { cinematics: 'full' },
    });
    const context = createContext();

    director.start(context);
    director.update(0.1, context);
    audio.completedLineIds.add('welcome');
    director.update(0, context);

    expect(director.getSnapshot()).toMatchObject({
      activeSubject: 'stadiumCenterOrbit360',
      activeTeam: null,
      currentShot: 'stadiumCenterOrbit360',
      introOverlay: 'matchup',
      nextShot: 'quarterbackFrontSpotlight',
      subjectReady: true,
    });
    expect(audio.startedLines).toEqual(['welcome', 'matchup']);

    audio.completedLineIds.add('matchup');
    director.update(0, context);

    expect(director.getSnapshot()).toMatchObject({
      currentShot: 'stadiumCenterOrbit360',
      introOverlay: 'keys',
    });
    expect(audio.startedLines).toEqual(['welcome', 'matchup', 'weather']);
  });

  it('keeps the center-field orbit stable when team zones are unavailable', () => {
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
    director.update(0.1, context);

    const snapshot = director.getSnapshot();
    expect(snapshot.currentShot).toBe('stadiumCenterOrbit');
    expect(snapshot.subjectBounds?.source).toBe('field');
    expect(snapshot.subjectReady).toBe(true);
  });

  it('derives exactly three keys to the game from roster and rating data', () => {
    const context = createContext();
    const keys = resolveKeysToGame({
      rosterBinding: context.rosterBinding,
      teamTheme: context.teamTheme,
    });

    expect(keys).toHaveLength(3);
    expect(keys.map((key) => key.source)).toEqual([
      'userStrength',
      'opponentThreat',
      'matchupPriority',
    ]);
    expect(keys.every((key) => key.text.length > 0 && !/\d/.test(key.text))).toBe(true);
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

  it('uses a neutral local pregame line when a team lacks generated local quarterback audio', () => {
    const coordinator = new PregameAudioCoordinator(
      new FakePregameMixer(),
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
    );
    const match = createMatchModel({
      opponentTeamId: 'bay-city-current',
      rules: { seed: 20260624 },
      userTeamId: 'ironwood-owls',
    });
    const selections = coordinator.createSelections({
      matchSnapshot: snapshotMatchModel(match),
      weatherCondition: 'clear',
    });

    expect(selections.quarterback.available).toBe(true);
    expect(selections.quarterback.assetId).toMatch(/^pregame_warmup_transition_0[12]$/);
    expect(selections.quarterback.clip?.category).toBe('warmupTransition');
  });

  it('falls back to neutral local quarterback-slot audio when voice-pack resolution misses', async () => {
    const mixer = new FakePregameMixer();
    const resolver = {
      resolveClip: async () => null,
    } as unknown as VoicePackAssetResolver;
    const coordinator = new PregameAudioCoordinator(
      mixer,
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
      { voicePackResolver: resolver },
    );
    const match = createMatchModel({
      opponentTeamId: 'bay-city-current',
      rules: { seed: 20260624 },
      userTeamId: 'ironwood-owls',
    });
    const selections = coordinator.createSelections({
      matchSnapshot: snapshotMatchModel(match),
      weatherCondition: 'clear',
    });

    expect(selections.quarterback.clip?.category).toBe('quarterback');
    expect(selections.quarterback.assetId).not.toMatch(/^pregame_warmup_transition_/);

    coordinator.startLine('quarterback', selections.quarterback);
    await coordinator.flushPendingAudioForTests();

    expect(mixer.playedAssetIds).toHaveLength(1);
    expect(mixer.playedAssetIds[0]).toMatch(/^pregame_warmup_transition_0[12]$/);
    expect(coordinator.getSnapshot().failedLineIds).toEqual([]);
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

  it('does not start a stale voice-pack clip after pregame is skipped', async () => {
    const mixer = new FakePregameMixer();
    let resolveClip!: (clip: VoicePackResolvedClip) => void;
    const resolver = {
      resolveClip: () => new Promise<VoicePackResolvedClip>((resolve) => {
        resolveClip = resolve;
      }),
    } as unknown as VoicePackAssetResolver;
    const coordinator = new PregameAudioCoordinator(
      mixer,
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
      { voicePackResolver: resolver },
    );

    coordinator.startLine('welcome', createSelection('pregame_welcome_test', 0.5));
    expect(coordinator.getSnapshot().playbackState).toBe('starting');

    coordinator.skip();
    resolveClip(createResolvedVoicePackClip('voice_pack_welcome_test', 0.5));
    await waitForMicrotasks();

    expect(mixer.playedAssetIds).toEqual([]);
    expect(coordinator.getSnapshot()).toMatchObject({
      activeLine: null,
      playbackState: 'idle',
      queuedLine: null,
    });
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
      coachCount: 0,
      coachesEnabled: false,
      coachStates: [],
      density: 'low',
      drawCalls: 0,
      enabled: true,
      geometryCount: 0,
      instanceBufferBytes: 0,
      lastReactionEventId: null,
      materialCount: 0,
      meshCount: 0,
      noGameplayAuthority: true,
      reactionState: 'idle',
      semanticTargets: {
        opponentCoach: null,
        opponentSidelineGroup: { x: 45, y: 0, z: 0 },
        userCoach: null,
        userSidelineGroup: { x: -45, y: 0, z: 0 },
      },
      fullFootballPlayerVisualCount: 0,
      sidelineRosterPlayerIds: [],
      sidelinePlayerCount: 0,
      sidelinePlayersEnabled: false,
      teamKey: 'test',
      textureCount: 0,
      triangleCount: 0,
      tunnelRosterPlayerIds: [],
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
          appearance: {
            bodyReady: true,
            faceguardMaterialName: 'football-helmet-kit-offense-faceguard',
            fallbackReason: null,
            headBounds: null,
            helmetAssetId: 'football-helmet-kit',
            helmetBounds: null,
            helmetReady: true,
            playerAssetStatus: 'idle',
            rosterPlayerId: profile.rosterPlayerId,
            shellMaterialName: 'football-helmet-kit-offense-shell',
            subjectReady: true,
            subjectVisible: true,
          },
          archetype: profile.archetype,
          bounds: warmupPlacementToBounds(quarterback),
          facingRadians: quarterback.facingRadians,
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

function createContextWithQuarterbackReadiness(
  readiness: Partial<NonNullable<PregameWarmupSnapshot['quarterback']>['appearance']>,
): PregamePresentationContext {
  const context = createContext();
  const quarterback = context.warmupSnapshot.quarterback;
  if (!quarterback) {
    return context;
  }

  return {
    ...context,
    warmupSnapshot: {
      ...context.warmupSnapshot,
      quarterback: {
        ...quarterback,
        appearance: {
          ...quarterback.appearance,
          ...readiness,
        },
      },
    },
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

function advanceToQuarterbackFrontSpotlight(
  director: PregamePresentationDirector,
  audio: ReturnType<typeof createFakePregameAudioCoordinator>,
  context: PregamePresentationContext,
): void {
  director.update(0.1, context);
  audio.completedLineIds.add('welcome');
  director.update(0, context);
  audio.completedLineIds.add('matchup');
  director.update(0, context);
  audio.completedLineIds.add('weather');
  director.update(0, context);
  advanceUntilCurrentShot(director, context, 'quarterbackFrontSpotlight');
}

function advanceUntilCurrentShot(
  director: PregamePresentationDirector,
  context: PregamePresentationContext,
  shotId: PregameShotId,
): void {
  for (let frame = 0; frame < 220; frame += 1) {
    if (director.getSnapshot().currentShot === shotId) {
      return;
    }
    director.update(0.1, context);
  }

  throw new Error(`Pregame shot ${shotId} was not reached`);
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

function createResolvedVoicePackClip(assetId: string, durationSeconds: number): VoicePackResolvedClip {
  return {
    asset: {
      assetId,
      category: 'announcer',
      defaultGain: 1,
      loadingStrategy: 'buffer',
      loop: false,
      maxSimultaneousInstances: 1,
      optional: true,
      url: `/audio/voice-packs/test/${assetId}.mp3`,
    },
    caption: assetId,
    clip: {
      assetId,
      caption: assetId,
      domain: 'pregame',
      durationSeconds,
      scriptId: assetId,
      url: `/audio/voice-packs/test/${assetId}.mp3`,
    },
    fallbackSource: 'selectedPack',
    packId: 'announcer-a',
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
      decodedBufferBudgetBytes: 8 * 1024 * 1024,
      enabled: true,
      lastEvictedAudioAssetId: null,
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
