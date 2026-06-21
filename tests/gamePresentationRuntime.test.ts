import { describe, expect, it, vi } from 'vitest';
import type { BroadcastCommentarySnapshot } from '../src/audio/BroadcastCommentaryDirector';
import type { GameAudioDirectorSnapshot } from '../src/audio/GameAudioDirector';
import type { PresentationAudioEvent } from '../src/audio/PresentationEventBridge';
import { createGameplayModel, snapshotGameplayModel, type PlayResult } from '../src/playState';
import {
  GamePresentationRuntime,
  selectPresentationEventsByPrecedence,
} from '../src/presentation/GamePresentationRuntime';
import type { PresentationHoldSnapshot } from '../src/presentation/PresentationHoldDirector';

describe('presentation event precedence', () => {
  it('suppresses lower-value result events for the same gameplay result', () => {
    const tackle = makeEvent('tackle', 7);
    const firstDown = makeEvent('firstDown', 7);
    const touchdown = makeEvent('touchdown', 8);
    const touchdownFirstDown = makeEvent('firstDown', 8);
    const turnover = makeEvent('turnoverOnDowns', 9);
    const turnoverTackle = makeEvent('tackle', 9);
    const snap = makeEvent('ballSnapped');

    expect(
      selectPresentationEventsByPrecedence([
        snap,
        tackle,
        firstDown,
        touchdownFirstDown,
        touchdown,
        turnoverTackle,
        turnover,
      ]).map((event) => event.type),
    ).toEqual(['ballSnapped', 'firstDown', 'touchdown', 'turnoverOnDowns']);
  });
});

describe('GamePresentationRuntime', () => {
  it('feeds one derived event stream to every presentation subsystem', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const audio = createAudioStub();
    const commentary = createCommentaryStub();
    const hold = createHoldStub();
    const crowd = createCrowdStub();
    const runtime = new GamePresentationRuntime({
      commentaryDirector: commentary as never,
      gameAudioDirector: audio as never,
      getCrowdController: () => crowd as never,
      getHoldDirector: () => hold as never,
    });

    const events = runtime.update(snapshot, 1 / 60, {
      active: true,
      commentaryActive: true,
    });

    expect(events.map((event) => event.type)).toEqual(['playPrepared']);
    expect(audio.processEvents).toHaveBeenCalledWith(snapshot, events, 1 / 60);
    expect(hold.update).toHaveBeenCalledWith(events, 1 / 60);
    expect(crowd.update).toHaveBeenCalledWith(snapshot, events, 1 / 60);
    expect(commentary.processEvents).toHaveBeenCalledWith(events, 1 / 60);

    runtime.recordCameraSnapshot({
      activeShotName: 'prePlayOrbit180',
      cameraPosition: { x: 0, y: 12, z: -20 },
      focusPosition: { x: 0, y: 0, z: -15 },
      mode: 'cinematicBroadcast',
      state: 'preSnapFormation',
      targetPosition: { x: 0, y: 0, z: -10 },
    });

    expect(runtime.getSnapshot().history[0]).toMatchObject({
      cameraShot: 'prePlayOrbit180',
      emittedEventTypes: ['playPrepared'],
      gameplayResultId: null,
      resetCompleted: false,
    });
  });

  it('does not derive or dispatch events while inactive', () => {
    const runtime = new GamePresentationRuntime({
      commentaryDirector: createCommentaryStub() as never,
      gameAudioDirector: createAudioStub() as never,
      getCrowdController: () => createCrowdStub() as never,
      getHoldDirector: () => createHoldStub() as never,
    });

    const events = runtime.update(snapshotGameplayModel(createGameplayModel({ playbookId: '5v5' })), 1, {
      active: false,
      commentaryActive: true,
    });

    expect(events).toEqual([]);
    expect(runtime.getSnapshot().history).toEqual([]);
  });
});

function makeEvent(type: PresentationAudioEvent['type'], resultId?: number): PresentationAudioEvent {
  return {
    id: `${type}:${resultId ?? 'none'}`,
    playResult: resultId === undefined ? undefined : makeResult(resultId, type),
    playState: 'dead',
    score: 0,
    type,
  };
}

function makeResult(id: number, type: PresentationAudioEvent['type']): PlayResult {
  return {
    endingBallSpot: { x: 0, z: 0 },
    id,
    reason: type === 'touchdown' ? 'touchdown' : type === 'sack' ? 'sack' : 'tackle',
    scoringTeam: type === 'touchdown' ? 'offense' : null,
    startingBallSpot: { x: 0, z: -10 },
    type: type === 'touchdown' || type === 'sack' || type === 'incomplete' || type === 'outOfBounds'
      ? type
      : 'tackle',
    yardsGained: 10,
  };
}

function createAudioStub() {
  return {
    getSnapshot: vi.fn(() => ({
      eventHistory: [],
      recentEvents: [],
    } as unknown as GameAudioDirectorSnapshot)),
    processEvents: vi.fn(),
    setPageActive: vi.fn(),
  };
}

function createCommentaryStub() {
  return {
    getSnapshot: vi.fn(() => ({
      captionsEnabled: false,
      crowdDuckState: { ducked: false, duckingGain: 1 },
      currentCaption: null,
      currentClip: null,
      enabled: true,
      eventHistory: [],
      lastEventSource: null,
      lastPriority: null,
      queue: [],
      remainingCooldowns: [],
    } satisfies BroadcastCommentarySnapshot)),
    processEvents: vi.fn(),
    setPageActive: vi.fn(),
  };
}

function createHoldStub() {
  return {
    getSnapshot: vi.fn(() => ({
      active: false,
      duplicateSuppressionCount: 0,
      history: [],
      reason: null,
      remainingSeconds: 0,
      skippedCount: 0,
    } satisfies PresentationHoldSnapshot)),
    skip: vi.fn(() => false),
    update: vi.fn(),
  };
}

function createCrowdStub() {
  return {
    getSnapshot: vi.fn(() => null),
    setPageActive: vi.fn(),
    skipReactionHold: vi.fn(() => false),
    update: vi.fn(),
  };
}
