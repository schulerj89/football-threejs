import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createGameplayModel,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
} from '../../src/playState';
import { PLAYABLE_FIELD_BOUNDS } from '../../src/fieldSpec';
import { MatchFlowController } from '../../src/match/MatchFlowController';
import { BROADCAST_EXPERIENCE_SETTINGS } from '../../src/config/GameExperienceSettings';
import { createGameplayRosterBinding } from '../../src/roster/GameplayRosterBinding';
import { resolveTeamPresentationTheme } from '../../src/teams/TeamThemeApplier';
import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
} from '../../src/teams/TeamRegistry';
import {
  confirmPlaceKickMeter,
  createPlaceKickMeterState,
  updatePlaceKickMeterState,
} from '../../src/specialTeams/PlaceKickMeterModel';
import {
  createExtraPointPlaceKickState,
  createPlaceKickSimulationInput,
  samplePlaceKickBallPosition,
  simulatePlaceKick,
} from '../../src/specialTeams/PlaceKickSimulation';
import {
  createPlaceKickFormation,
  validatePlaceKickFormation,
} from '../../src/specialTeams/PlaceKickFormation';
import { PlaceKickPresentationDirector } from '../../src/specialTeams/PlaceKickPresentationDirector';
import {
  PLACE_KICK_GOOD_ANNOUNCER_ASSET_ID,
  PLACE_KICK_GOOD_MESSAGE,
  PLACE_KICK_GOOD_WHISTLE_ASSET_ID,
} from '../../src/specialTeams/PlaceKickPresentationDirector';
import { PlaceKickMeter } from '../../src/ui/PlaceKickMeter';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
} from '../../src/presentation/players/FootballPlayerVisualFactory';
import { getPlayerVisualHeadAnchor } from '../../src/playerVisual';
import type { PlayerModel } from '../../src/playerModel';
import type { PlayerTeamUniforms } from '../../src/playerVisual';

describe('place-kick meter model', () => {
  it('advances by delta time and confirms one timing input', () => {
    const start = createPlaceKickMeterState({
      difficulty: 'pro',
      ratings: { kickAccuracy: 82, kickPower: 90 },
    });
    let sixtyHz = start;
    for (let index = 0; index < 60; index += 1) {
      sixtyHz = updatePlaceKickMeterState(sixtyHz, 1 / 60);
    }
    let thirtyHz = start;
    for (let index = 0; index < 30; index += 1) {
      thirtyHz = updatePlaceKickMeterState(thirtyHz, 1 / 30);
    }
    const confirmed = confirmPlaceKickMeter(sixtyHz);
    const afterConfirmed = updatePlaceKickMeterState(confirmed.state, 1);

    expect(sixtyHz.normalizedValue).toBeCloseTo(thirtyHz.normalizedValue, 5);
    expect(confirmed.timingInput.normalizedValue).toBeCloseTo(sixtyHz.normalizedValue, 5);
    expect(afterConfirmed.normalizedValue).toBeCloseTo(confirmed.state.normalizedValue, 5);
  });
});

describe('place-kick meter UI input', () => {
  it('accepts Space and panel pointer input while active', () => {
    const restoreDom = installPlaceKickMeterDom();
    const keyboardTarget = new FakeEventTarget();
    const placeKick = createExtraPointPlaceKickState({
      defendingTeam: 'opponent',
      holderRosterId: 'holder',
      kickerRatings: { kickAccuracy: 82, kickPower: 90 },
      kickerRosterId: 'kicker',
      kickingTeam: 'user',
      sequenceIndex: 2,
    });

    try {
      const spaceMeter = new PlaceKickMeter(keyboardTarget as unknown as Window);
      spaceMeter.sync(placeKick, 'pro', true);
      keyboardTarget.dispatch('keydown', createFakeKeyboardEvent('Space', ' '));
      expect(spaceMeter.consumeTimingInput()).toMatchObject({
        confirmedAtSeconds: expect.any(Number),
        normalizedValue: expect.any(Number),
      });
      spaceMeter.dispose();

      const pointerMeter = new PlaceKickMeter(keyboardTarget as unknown as Window);
      pointerMeter.sync({
        ...placeKick,
        sequenceIndex: 3,
      }, 'pro', true);
      (pointerMeter.root as unknown as FakeElement).dispatch('pointerdown', createFakePointerEvent());
      expect(pointerMeter.consumeTimingInput()).toMatchObject({
        confirmedAtSeconds: expect.any(Number),
        normalizedValue: expect.any(Number),
      });
      pointerMeter.dispose();
    } finally {
      restoreDom();
    }
  });

  it('shows the made-kick message for a completed result', () => {
    const restoreDom = installPlaceKickMeterDom();
    const keyboardTarget = new FakeEventTarget();
    const placeKick = createExtraPointPlaceKickState({
      defendingTeam: 'opponent',
      holderRosterId: 'holder',
      kickerRatings: { kickAccuracy: 82, kickPower: 90 },
      kickerRosterId: 'kicker',
      kickingTeam: 'user',
      sequenceIndex: 4,
    });
    const result = simulatePlaceKick(createPlaceKickSimulationInput({
      difficulty: 'pro',
      direction: placeKick.direction,
      kickerRatings: placeKick.kickerRatings!,
      kickerRosterId: 'kicker',
      matchSeed: 12,
      sequenceIndex: 4,
      timingInput: { confirmedAtSeconds: 0.5, normalizedValue: 0 },
    }));

    try {
      const meter = new PlaceKickMeter(keyboardTarget as unknown as Window);
      meter.syncResult({
        ...placeKick,
        result,
      }, true);

      expect((meter.root as unknown as FakeElement).dataset.result).toBe('good');
      expect((meter.root as unknown as FakeElement).children[2]?.textContent).toBe(PLACE_KICK_GOOD_MESSAGE);
      meter.dispose();
    } finally {
      restoreDom();
    }
  });
});

describe('extra-point place-kick simulation', () => {
  it('uses trajectory crossing the goal plane for good and no-good results', () => {
    const base = {
      difficulty: 'pro' as const,
      direction: 1 as const,
      kickerRatings: { kickAccuracy: 88, kickPower: 82 },
      kickerRosterId: 'test-kicker',
      matchSeed: 77,
      sequenceIndex: 0,
    };
    const good = simulatePlaceKick(createPlaceKickSimulationInput({
      ...base,
      timingInput: { confirmedAtSeconds: 0.5, normalizedValue: 0 },
    }));
    const missed = simulatePlaceKick(createPlaceKickSimulationInput({
      ...base,
      timingInput: { confirmedAtSeconds: 0.5, normalizedValue: 1 },
    }));
    const end = samplePlaceKickBallPosition(good, good.flightSeconds);

    expect(good.good).toBe(true);
    expect(good.reason).toBe('good');
    expect(good.goalPlanePosition.y).toBeGreaterThan(10 / 3);
    expect(missed.good).toBe(false);
    expect(['wideLeft', 'wideRight', 'short']).toContain(missed.reason);
    expect(end.x).toBeCloseTo(good.target.x, 5);
    expect(end.z).toBeCloseTo(good.target.z, 5);
  });

  it('resolves a roster-backed extra-point formation with eleven players per team', () => {
    const binding = createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
    const placeKick = createExtraPointPlaceKickState({
      defendingTeam: 'opponent',
      holderRosterId: binding.userRoster.punterId,
      kickerRatings: { kickAccuracy: 82, kickPower: 90 },
      kickerRosterId: binding.userRoster.kickerId,
      kickingTeam: 'user',
      sequenceIndex: 0,
    });
    const layout = createPlaceKickFormation(placeKick, binding);
    const jerseyNumbersByRosterId = new Map(
      [...binding.userRoster.players, ...binding.opponentRoster.players]
        .map((player) => [player.id, player.jerseyNumber]),
    );

    expect(layout.family).toBe('placeKick');
    expect(layout.participants).toHaveLength(22);
    expect(layout.participants.filter((participant) => participant.phase === 'protection')).toHaveLength(11);
    expect(layout.participants.filter((participant) => participant.phase === 'defense')).toHaveLength(11);
    expect(new Set(layout.participants.map((participant) => `${participant.team}:${participant.rosterPlayerId}`)).size)
      .toBe(22);
    for (const participant of layout.participants) {
      expect(participant.jerseyNumber).toBe(jerseyNumbersByRosterId.get(participant.rosterPlayerId));
    }
    expect(validatePlaceKickFormation(layout)).toEqual([]);
  });
});

describe('extra-point match flow', () => {
  it('awards six on touchdown, then finalizes one drive summary after a made PAT', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController(20260620);
    controller.start(gameplay);

    expect(startPlay(gameplay)).toBe(true);
    gameplay.player.position.z = PLAYABLE_FIELD_BOUNDS.maxZ + 1;
    updateGameplayModel(gameplay, 1 / 60, { suppressDeadPlayReset: true });
    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));

    const pending = controller.getSnapshot();
    expect(pending.phase).toBe('userPossession');
    expect(pending.userScore).toBe(6);
    expect(pending.driveSummaries).toHaveLength(0);
    expect(pending.pendingScoringDriveSummary?.scoringEvents).toEqual([
      { points: 6, team: 'user', type: 'touchdown' },
    ]);
    expect(controller.beginPreparedExtraPoint()).toBe(true);

    const result = controller.resolveExtraPointKick({
      confirmedAtSeconds: 0.6,
      normalizedValue: 0,
    });
    expect(result?.good).toBe(true);

    const summary = controller.completeExtraPointAndScheduleKickoff(gameplay);
    const final = controller.getSnapshot();

    expect(summary?.points).toBe(7);
    expect(final.userScore).toBe(7);
    expect(final.driveSummaries).toHaveLength(1);
    expect(final.driveSummaries[0]?.scoringEvents).toEqual([
      { points: 6, team: 'user', type: 'touchdown' },
      { points: 1, team: 'user', type: 'extraPoint' },
    ]);
    expect(final.phase).toBe('kickoff');
    expect(final.kickoff.receivingTeam).toBe('opponent');
  });

  it('keeps a touchdown at six after a missed PAT', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController(20260620);
    controller.start(gameplay);

    expect(startPlay(gameplay)).toBe(true);
    gameplay.player.position.z = PLAYABLE_FIELD_BOUNDS.maxZ + 1;
    updateGameplayModel(gameplay, 1 / 60, { suppressDeadPlayReset: true });
    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));
    expect(controller.beginPreparedExtraPoint()).toBe(true);
    const result = controller.resolveExtraPointKick({
      confirmedAtSeconds: 0.6,
      normalizedValue: 1,
    });
    controller.completeExtraPointAndScheduleKickoff(gameplay);
    const final = controller.getSnapshot();

    expect(result?.good).toBe(false);
    expect(final.userScore).toBe(6);
    expect(final.driveSummaries[0]?.points).toBe(6);
    expect(final.driveSummaries[0]?.scoringEvents).toEqual([
      { points: 6, team: 'user', type: 'touchdown' },
    ]);
  });
});

describe('extra-point presentation stage', () => {
  it('uses shared helmeted football-player visuals and releases them after finish', async () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController(20260620);
    controller.start(gameplay);
    expect(startPlay(gameplay)).toBe(true);
    gameplay.player.position.z = PLAYABLE_FIELD_BOUNDS.maxZ + 1;
    updateGameplayModel(gameplay, 1 / 60, { suppressDeadPlayReset: true });
    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));
    expect(controller.beginPreparedExtraPoint()).toBe(true);
    const director = new PlaceKickPresentationDirector({
      audio: createFakePlaceKickAudio(),
      ballVisualStyle: 'football',
      footballPlayerVisual: {
        attachHelmet: attachMockHelmet,
      },
      rosterBinding: createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
      teamTheme: resolveTeamPresentationTheme(BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
    });

    director.start(controller.getSnapshot());
    await Promise.resolve();
    await Promise.resolve();

    expect(director.getSnapshot()).toMatchObject({
      formationFamily: 'placeKick',
      formationValidation: [],
      helmetReadyCount: 22,
      participantCount: 22,
      stageVisibility: {
        officialsVisible: false,
        placeKickParticipantsVisible: true,
        scrimmagePlayersVisible: false,
      },
      visualProfile: {
        fullFootballPlayerVisualCount: 22,
        presentationOnlyCount: 22,
        profileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
        profileMatchCount: 22,
      },
    });

    director.finish();
    expect(director.getSnapshot().participantCount).toBe(0);
    expect(director.getSnapshot().stageVisibility.placeKickParticipantsVisible).toBe(false);
    director.dispose();
  });

  it('runs the kicker toward the holder and plays made-kick feedback once', async () => {
    const binding = createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
    const placeKick = createExtraPointPlaceKickState({
      defendingTeam: 'opponent',
      holderRosterId: binding.userRoster.punterId,
      kickerRatings: { kickAccuracy: 82, kickPower: 90 },
      kickerRosterId: binding.userRoster.kickerId,
      kickingTeam: 'user',
      sequenceIndex: 5,
    });
    let activePlaceKick = placeKick;
    const audio = createFakePlaceKickAudio();
    const director = new PlaceKickPresentationDirector({
      audio,
      ballVisualStyle: 'football',
      footballPlayerVisual: {
        attachHelmet: attachMockHelmet,
      },
      rosterBinding: binding,
      teamTheme: resolveTeamPresentationTheme(BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
    });
    const gameplaySnapshot = snapshotGameplayModel(createGameplayModel({ playbookId: '11v11' }));

    director.start({ extraPoint: activePlaceKick });
    await Promise.resolve();
    await Promise.resolve();
    const initial = director.getSnapshot().kickerVisualPosition;
    expect(initial).not.toBeNull();
    const result = simulatePlaceKick(createPlaceKickSimulationInput({
      difficulty: 'pro',
      direction: activePlaceKick.direction,
      kickerRatings: activePlaceKick.kickerRatings!,
      kickerRosterId: activePlaceKick.kickerRosterId!,
      matchSeed: 20260622,
      sequenceIndex: activePlaceKick.sequenceIndex,
      timingInput: { confirmedAtSeconds: 0.5, normalizedValue: 0 },
    }));
    activePlaceKick = {
      ...activePlaceKick,
      result,
    };

    let runUpSnapshot = director.getSnapshot();
    for (let frame = 0; frame < 90 && runUpSnapshot.phase !== 'runUp'; frame += 1) {
      director.update({
        deltaSeconds: 1 / 60,
        gameplaySnapshot,
        matchSnapshot: {
          deterministicSeed: 20260622,
          extraPoint: activePlaceKick,
        },
      });
      runUpSnapshot = director.getSnapshot();
    }

    expect(runUpSnapshot.phase).toBe('runUp');
    for (let frame = 0; frame < 8; frame += 1) {
      director.update({
        deltaSeconds: 1 / 60,
        gameplaySnapshot,
        matchSnapshot: {
          deterministicSeed: 20260622,
          extraPoint: activePlaceKick,
        },
      });
    }
    runUpSnapshot = director.getSnapshot();
    const runUpPosition = runUpSnapshot.kickerVisualPosition;
    expect(runUpPosition).not.toBeNull();
    expect(distance2d(runUpPosition!, activePlaceKick.holderSpot))
      .toBeLessThan(distance2d(initial!, activePlaceKick.holderSpot));
    const kickerRoot = director.group.children.find((child) =>
      child.userData.placeKickSlotId === 'kicker');
    const rightLegPivot = kickerRoot?.getObjectByName('rightLegPivot');
    const backswing = rightLegPivot?.rotation.x ?? 0;

    let finalSnapshot = runUpSnapshot;
    for (let frame = 0; frame < 180 && finalSnapshot.phase !== 'result'; frame += 1) {
      director.update({
        deltaSeconds: 1 / 60,
        gameplaySnapshot,
        matchSnapshot: {
          deterministicSeed: 20260622,
          extraPoint: activePlaceKick,
        },
      });
      finalSnapshot = director.getSnapshot();
    }

    const followThrough = rightLegPivot?.rotation.x ?? 0;

    expect(finalSnapshot.phase).toBe('result');
    expect(kickerRoot?.userData.kickAnimationInitialized).toBe(true);
    expect(rightLegPivot).toBeInstanceOf(THREE.Group);
    expect(backswing).toBeLessThan(-0.05);
    expect(followThrough).toBeGreaterThan(0.25);
    expect(finalSnapshot.resultMessage).toBe(PLACE_KICK_GOOD_MESSAGE);
    expect(finalSnapshot.playedResultWhistle).toBe(true);
    expect(finalSnapshot.playedResultAnnouncer).toBe(true);
    expect(finalSnapshot.ballPosition?.x).toBeCloseTo(result.goalPlanePosition.x, 5);
    expect(finalSnapshot.ballPosition?.y).toBeCloseTo(result.goalPlanePosition.y, 5);
    expect(finalSnapshot.ballPosition?.z).toBeCloseTo(result.goalPlanePosition.z, 5);
    expect(audio.played.filter((assetId) => assetId === PLACE_KICK_GOOD_WHISTLE_ASSET_ID)).toHaveLength(1);
    expect(audio.played.filter((assetId) => assetId === PLACE_KICK_GOOD_ANNOUNCER_ASSET_ID)).toHaveLength(1);
    director.dispose();
  });
});

function createController(seed: number): MatchFlowController {
  return new MatchFlowController({
    opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
    seed,
    userTeamId: DEFAULT_USER_TEAM_ID,
  });
}

async function attachMockHelmet(
  playerVisual: THREE.Object3D,
  _player: PlayerModel,
  _teamUniforms?: PlayerTeamUniforms,
): Promise<boolean> {
  const headAnchor = getPlayerVisualHeadAnchor(playerVisual);
  if (!headAnchor) {
    return false;
  }
  const helmet = new THREE.Group();
  helmet.name = 'low-poly-helmet';
  headAnchor.add(helmet);
  return true;
}

function createFakePlaceKickAudio() {
  const played: string[] = [];
  return {
    played,
    playOneShot: async (assetId: string) => {
      played.push(assetId);
      return true;
    },
  };
}

function installPlaceKickMeterDom(): () => void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const hadDocument = Object.prototype.hasOwnProperty.call(globals, 'document');
  const previousDocument = globals.document;
  const body = new FakeElement('body');

  globals.document = {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
  } as unknown as Document;

  return () => {
    if (hadDocument) {
      globals.document = previousDocument;
    } else {
      delete globals.document;
    }
  };
}

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === 'function'
      ? listener
      : (event: Event) => listener.handleEvent(event);
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(callback as (event: unknown) => void);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === 'function'
      ? listener
      : (event: Event) => listener.handleEvent(event);
    this.listeners.get(type)?.delete(callback as (event: unknown) => void);
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeElement extends FakeEventTarget {
  readonly children: FakeElement[] = [];
  className = '';
  dataset: Record<string, string> = {};
  hidden = false;
  textContent = '';
  type = '';
  readonly style = {
    left: '',
    setProperty: (_name: string, _value: string) => undefined,
  };

  constructor(readonly tagName: string) {
    super();
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  remove(): void {
    return undefined;
  }

  setAttribute(): void {
    return undefined;
  }
}

function createFakeKeyboardEvent(code: string, key: string): KeyboardEvent {
  return {
    altKey: false,
    code,
    ctrlKey: false,
    key,
    metaKey: false,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as unknown as KeyboardEvent;
}

function createFakePointerEvent(): PointerEvent {
  return {
    preventDefault: () => undefined,
  } as unknown as PointerEvent;
}

function distance2d(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
