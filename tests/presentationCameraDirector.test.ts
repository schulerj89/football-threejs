import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_CAMERA_CONFIG,
  PresentationCameraDirector,
  calculateFormationBounds,
} from '../src/camera/PresentationCameraDirector';
import { createFormationPreviewModel, snapshotFormationPreviewAsGameplay } from '../src/formationPreview';
import {
  attemptPass,
  createGameplayModel,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
  type GameplaySnapshot,
  type PlayResultType,
} from '../src/playState';
import type { PlayerSnapshot } from '../src/playerModel';

describe('presentation camera director', () => {
  it('calculates formation bounds that include every active player', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const snapshot = snapshotFormationPreviewAsGameplay(preview);
    const bounds = calculateFormationBounds(snapshot.players);

    expect(bounds.playerIds).toEqual(snapshot.players.map((player) => player.id).sort());
    for (const player of snapshot.players) {
      expect(player.position.x - player.collisionRadius).toBeGreaterThanOrEqual(bounds.min.x);
      expect(player.position.x + player.collisionRadius).toBeLessThanOrEqual(bounds.max.x);
      expect(player.position.z - player.collisionRadius).toBeGreaterThanOrEqual(bounds.min.z);
      expect(player.position.z + player.collisionRadius).toBeLessThanOrEqual(bounds.max.z);
    }
  });

  it('does not delay snap input during the establishing shot', () => {
    const gameplay = createGameplayModel();
    const director = new PresentationCameraDirector();
    const camera = new THREE.PerspectiveCamera();

    director.update(snapshotGameplayModel(gameplay), camera, 0);

    expect(startPlay(gameplay)).toBe(true);
    expect(gameplay.playState).toBe('live');
  });

  it('does not mutate gameplay snapshots while calculating camera shots', () => {
    const gameplay = createGameplayModel();
    const snapshot = snapshotGameplayModel(gameplay);
    const before = JSON.stringify(snapshot);
    const director = new PresentationCameraDirector();

    director.update(snapshot, new THREE.PerspectiveCamera(), 0.016);

    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('limits camera discontinuity when control transfers after a catch', () => {
    const gameplay = createGameplayModel();
    selectPlay(gameplay, 'slant-flat');
    startPlay(gameplay);
    attemptPass(gameplay);
    const inFlight = snapshotGameplayModel(gameplay);
    const receiver = getPlayer(inFlight, 'offense-wr');
    const afterCatch = cloneSnapshot(inFlight);
    const director = new PresentationCameraDirector();
    const camera = new THREE.PerspectiveCamera();

    director.update(inFlight, camera, 0);
    const beforePosition = camera.position.clone();
    afterCatch.ball = {
      possession: { kind: 'player', playerId: receiver.id },
      position: { x: receiver.position.x, y: 0.8, z: receiver.position.z },
      state: { kind: 'caught', playerId: receiver.id },
    };
    afterCatch.player = {
      ...receiver,
      currentState: 'userControlled',
    };
    afterCatch.players = afterCatch.players.map((player) =>
      player.id === receiver.id ? afterCatch.player : player,
    );

    director.update(afterCatch, camera, 0.016);

    expect(camera.position.distanceTo(beforePosition)).toBeLessThanOrEqual(
      PRESENTATION_CAMERA_CONFIG.maximumTransitionSpeed * 0.016 + 0.001,
    );
  });

  it('uses the dead-ball spot as the dead-ball result focus', () => {
    const deadBallSpot = { x: 4, z: -8 };
    const snapshot = createDeadSnapshot('tackle', deadBallSpot);
    const director = new PresentationCameraDirector();
    const debug = director.update(snapshot, new THREE.PerspectiveCamera(), 0);

    expect(debug.phase).toBe('deadBallResult');
    expect(debug.focusTarget.x).toBeCloseTo(deadBallSpot.x);
    expect(debug.focusTarget.z).toBeCloseTo(deadBallSpot.z);
  });

  it('uses the touchdown spot for the touchdown result focus', () => {
    const touchdownSpot = { x: -2, z: 50 };
    const snapshot = createDeadSnapshot('touchdown', touchdownSpot);
    const director = new PresentationCameraDirector();
    const debug = director.update(snapshot, new THREE.PerspectiveCamera(), 0);

    expect(debug.phase).toBe('touchdownResult');
    expect(debug.focusTarget.x).toBeCloseTo(touchdownSpot.x);
    expect(debug.focusTarget.z).toBeCloseTo(touchdownSpot.z);
  });

  it('returns focus to the newly resolved snap spot after reset', () => {
    const deadSnapshot = createDeadSnapshot('sack', { x: 5, z: -10 });
    const resetSnapshot = cloneSnapshot(deadSnapshot);
    const nextSnapSpot = { x: 6.166666666666667, z: -10 };
    const director = new PresentationCameraDirector();

    resetSnapshot.playState = 'preSnap';
    resetSnapshot.lastPlayResult = null;
    resetSnapshot.nextSnapSpot = nextSnapSpot;
    resetSnapshot.drive = {
      ...resetSnapshot.drive,
      lineOfScrimmage: nextSnapSpot,
      snapLane: 'rightHash',
    };
    director.update(deadSnapshot, new THREE.PerspectiveCamera(), 0);
    const debug = director.update(resetSnapshot, new THREE.PerspectiveCamera(), 0.016);

    expect(debug.phase).toBe('returnToPreSnap');
    expect(debug.focusTarget.x).toBeCloseTo(nextSnapSpot.x);
    expect(debug.focusTarget.z).toBeCloseTo(nextSnapSpot.z);
  });
});

function createDeadSnapshot(
  resultType: PlayResultType,
  endingBallSpot: { x: number; z: number },
): GameplaySnapshot {
  const gameplay = createGameplayModel();
  const snapshot = snapshotGameplayModel(gameplay);

  return {
    ...snapshot,
    exactDeadBallSpot: endingBallSpot,
    lastPlayResult: {
      endingBallSpot,
      id: 1,
      reason: resultType,
      scoringTeam: resultType === 'touchdown' ? 'offense' : null,
      startingBallSpot: snapshot.currentBallSpot,
      type: resultType,
      yardsGained: endingBallSpot.z - snapshot.currentBallSpot.z,
    },
    playState: 'dead',
  };
}

function getPlayer(snapshot: GameplaySnapshot, playerId: string): PlayerSnapshot {
  const player = snapshot.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}

function cloneSnapshot(snapshot: GameplaySnapshot): GameplaySnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as GameplaySnapshot;
}
