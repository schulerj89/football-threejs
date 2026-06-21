import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { PresentationAudioEvent } from '../src/audio/PresentationEventBridge';
import {
  CROWD_DENSITY_PRESETS,
  CrowdPresentationController,
  applyCrowdPresentationQuerySettings,
  loadCrowdPresentationSettings,
  saveCrowdPresentationSettings,
} from '../src/presentation/CrowdPresentationController';
import type { GameplaySnapshot, PlayResult } from '../src/playState';

describe('crowd presentation controller', () => {
  it('maps normal-game density presets to measured benchmark counts', () => {
    expect(CROWD_DENSITY_PRESETS).toEqual({
      high: 5000,
      low: 500,
      medium: 2000,
    });
  });

  it('persists settings and applies query overrides', () => {
    const storage = createMemoryStorage();

    saveCrowdPresentationSettings({
      crowdDensity: 'medium',
      crowdReactionsEnabled: false,
      crowdVisualsEnabled: true,
    }, storage);

    expect(loadCrowdPresentationSettings(storage)).toEqual({
      crowdDensity: 'medium',
      crowdReactionsEnabled: false,
      crowdVisualsEnabled: true,
    });

    expect(
      applyCrowdPresentationQuerySettings(
        loadCrowdPresentationSettings(storage),
        new URLSearchParams('crowdDensity=high&crowdVisuals=0&crowdReactions=1'),
      ),
    ).toEqual({
      crowdDensity: 'high',
      crowdReactionsEnabled: true,
      crowdVisualsEnabled: false,
    });
  });

  it('uses bounded instanced resources without per-spectator Object3Ds', () => {
    const controller = createController();
    const snapshot = controller.getSnapshot();

    expect(snapshot.actualSpectatorCount).toBe(500);
    expect(snapshot.crowdDrawCalls).toBe(6);
    expect(snapshot.geometryCount).toBe(5);
    expect(snapshot.materialCount).toBe(4);
    expect(snapshot.noPerSpectatorObject3D).toBe(true);
    expect(snapshot.nearInstanceCount + snapshot.farInstanceCount).toBe(500);
    expect(countObjects(controller.group)).toBeLessThan(20);

    controller.dispose();
  });

  it('starts exactly one first-down reaction for a stable event ID', () => {
    const controller = createController();
    const snapshot = makeSnapshot('dead');
    const event = makeEvent('firstDown', 1);

    controller.update(snapshot, [event], 0.1);
    controller.update(snapshot, [event], 0.1);

    const controllerSnapshot = controller.getSnapshot();
    expect(controllerSnapshot.reactionState).toBe('firstDown');
    expect(controllerSnapshot.reactionHistory.filter((entry) => entry.status === 'started')).toHaveLength(1);
    expect(controllerSnapshot.reactionHistory.some((entry) => entry.reason === 'duplicateEvent')).toBe(true);

    controller.dispose();
  });

  it('lets touchdown reaction supersede first-down presentation when both arrive together', () => {
    const controller = createController();

    controller.update(makeSnapshot('dead'), [
      makeEvent('firstDown', 2),
      makeEvent('touchdown', 2, 'touchdown'),
    ], 0.1);

    expect(controller.getSnapshot().reactionState).toBe('touchdown');

    controller.dispose();
  });

  it('suppresses stale page-hidden reactions and does not replay them on resume', () => {
    const controller = createController();
    const event = makeEvent('touchdown', 3, 'touchdown');

    controller.setPageActive(false);
    controller.update(makeSnapshot('dead'), [event], 0.1);
    controller.setPageActive(true);
    controller.update(makeSnapshot('dead'), [event], 0.1);

    const snapshot = controller.getSnapshot();
    expect(snapshot.reactionState).toBe('idle');
    expect(snapshot.reactionHistory.some((entry) => entry.reason === 'pageHidden')).toBe(true);
    expect(snapshot.reactionHistory.filter((entry) => entry.status === 'started')).toHaveLength(0);

    controller.dispose();
  });

  it('updates anticipation transforms at a bounded low frequency', () => {
    const controller = createController();

    for (let frame = 0; frame < 60; frame += 1) {
      controller.update(makeSnapshot('live'), [], 1 / 60);
    }

    expect(controller.getSnapshot().reactionUpdateCount).toBeLessThanOrEqual(13);

    controller.dispose();
  });
});

function createController(): CrowdPresentationController {
  return new CrowdPresentationController({
    settings: {
      crowdDensity: 'low',
      crowdReactionsEnabled: true,
      crowdVisualsEnabled: true,
    },
  });
}

function makeEvent(
  type: PresentationAudioEvent['type'],
  id: number,
  resultType: PlayResult['type'] = 'tackle',
): PresentationAudioEvent {
  return {
    id: `${type}:${id}`,
    playResult: makeResult(id, resultType),
    playState: 'dead',
    score: resultType === 'touchdown' ? 6 : 0,
    type,
  };
}

function makeResult(id: number, type: PlayResult['type']): PlayResult {
  return {
    endingBallSpot: { x: 3, z: 10 },
    id,
    reason: type,
    scoringTeam: type === 'touchdown' ? 'offense' : null,
    startingBallSpot: { x: 0, z: -15 },
    type,
    yardsGained: 25,
  };
}

function makeSnapshot(playState: GameplaySnapshot['playState']): GameplaySnapshot {
  return {
    activePlayStartSpot: playState === 'live' || playState === 'dead' ? { x: 0, z: -15 } : null,
    ball: {
      possession: { kind: 'none' },
      position: { x: 0, y: 1, z: -15 },
      state: { kind: 'dead' },
    },
    blocking: { engagements: [] },
    currentBallSpot: { x: 0, z: -15 },
    drive: {
      currentDown: 1,
      firstDownMarker: { x: 0, z: -5 },
      lastDriveResult: null,
      lineOfScrimmage: { x: 0, z: -15 },
      snapLane: 'middle',
      state: 'active',
      yardsToFirstDown: 10,
    },
    exactDeadBallSpot: null,
    formationOrigin: { x: 0, z: -15 },
    forwardPassEligible: true,
    lastPlayResult: null,
    nextBallSpot: { x: 0, z: -15 },
    nextSnapSpot: { x: 0, z: -15 },
    passAttempted: false,
    passAudit: null,
    passFeedback: null,
    player: {
      collisionRadius: 1,
      currentState: 'idle',
      facingRadians: 0,
      id: 'offense-rb',
      position: { x: 0, z: -15 },
      role: 'runner',
      team: 'offense',
      velocity: { x: 0, z: 0 },
    },
    players: [],
    playbookId: '5v5',
    playState,
    receiverRouteStates: [],
    score: 0,
    scoreAttack: {
      durationSeconds: 120,
      finalScore: null,
      remainingSeconds: 100,
      state: playState === 'live' ? 'running' : 'ready',
    },
    selectedPlay: {
      displayName: 'Inside Run',
      id: 'inside-run',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'run',
    },
    selectedReceiver: null,
    snapLane: 'middle',
  };
}

function countObjects(root: THREE.Object3D): number {
  let count = 0;
  root.traverse(() => {
    count += 1;
  });
  return count;
}

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
