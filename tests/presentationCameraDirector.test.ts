import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { PresentationAudioEvent } from '../src/audio/PresentationEventBridge';
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const director = new PresentationCameraDirector();
    const camera = new THREE.PerspectiveCamera();

    director.update(snapshotGameplayModel(gameplay), camera, 0);

    expect(startPlay(gameplay)).toBe(true);
    expect(gameplay.playState).toBe('live');
  });

  it('starts a pre-play orbit shot for a new pre-snap formation', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const director = new PresentationCameraDirector({ cinematics: 'full' });
    const debug = director.update(snapshotGameplayModel(gameplay), new THREE.PerspectiveCamera(), 0);

    expect(debug.activeShotName).toBe('prePlayOrbit180');
    expect(debug.phase).toBe('preSnapEstablish');
    expect(debug.orbitRadius).toBeGreaterThan(0);
    expect(debug.shotProgress).toBe(0);
  });

  it('skips the active orbit shot without mutating gameplay state', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const before = JSON.stringify(snapshot);
    const director = new PresentationCameraDirector({ cinematics: 'full' });
    const camera = new THREE.PerspectiveCamera();

    director.update(snapshot, camera, 0);
    expect(director.skipActiveShot()).toBe(true);
    const debug = director.update(snapshot, camera, 0.016);

    expect(debug.activeShotName).toBeNull();
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('does not mutate gameplay snapshots while calculating camera shots', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const before = JSON.stringify(snapshot);
    const director = new PresentationCameraDirector();

    director.update(snapshot, new THREE.PerspectiveCamera(), 0.016);

    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('limits camera discontinuity when control transfers after a catch', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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

  it('starts a touchdown orbit only after an authoritative touchdown result', () => {
    const tackleSnapshot = createDeadSnapshot('tackle', { x: 0, z: 12 });
    const touchdownSpot = { x: 3, z: 50 };
    const touchdownSnapshot = createDeadSnapshot('touchdown', touchdownSpot);
    const director = new PresentationCameraDirector({ cinematics: 'full' });
    const camera = new THREE.PerspectiveCamera();
    const tackleDebug = director.update(tackleSnapshot, camera, 0);
    const touchdownDebug = director.update(touchdownSnapshot, camera, 0.016);

    expect(tackleDebug.activeShotName).toBeNull();
    expect(touchdownDebug.activeShotName).toBe('touchdownOrbit360');
    expect(touchdownDebug.phase).toBe('touchdownResult');
    expect(touchdownDebug.focusTarget.x).toBeCloseTo(touchdownSpot.x);
    expect(touchdownDebug.focusTarget.z).toBeCloseTo(touchdownSpot.z);
  });

  it('skips a touchdown orbit without restarting it for the same result', () => {
    const snapshot = createDeadSnapshot('touchdown', { x: 1, z: 50 });
    const director = new PresentationCameraDirector({ cinematics: 'full' });
    const camera = new THREE.PerspectiveCamera();

    expect(director.update(snapshot, camera, 0).activeShotName).toBe('touchdownOrbit360');
    expect(director.skipActiveShot()).toBe(true);
    expect(director.update(snapshot, camera, 0.016).activeShotName).toBeNull();
  });

  it('uses a full-cinematics first-down fan cutaway when crowd cutaways are enabled', () => {
    const snapshot = createDeadSnapshot('tackle', { x: 6, z: 2 });
    const director = new PresentationCameraDirector({ cinematics: 'full' });
    const debug = director.update(snapshot, new THREE.PerspectiveCamera(), 0, {
      crowdCutawaysEnabled: true,
      presentationEvents: [makeEvent('firstDown', 11, snapshot)],
    });

    expect(debug.activeShotName).toBe('firstDownCrowdCutaway');
    expect(debug.phase).toBe('deadBallResult');
    expect(debug.orbitCenter?.x).toBeGreaterThan(20);
  });

  it('does not use a fan cutaway when crowd cutaways are disabled', () => {
    const snapshot = createDeadSnapshot('tackle', { x: 6, z: 2 });
    const director = new PresentationCameraDirector({ cinematics: 'full' });
    const debug = director.update(snapshot, new THREE.PerspectiveCamera(), 0, {
      crowdCutawaysEnabled: false,
      presentationEvents: [makeEvent('firstDown', 12, snapshot)],
    });

    expect(debug.activeShotName).toBeNull();
  });

  it('chains a full touchdown fan cutaway into the scorer orbit', () => {
    const snapshot = createDeadSnapshot('touchdown', { x: -4, z: 50 });
    const director = new PresentationCameraDirector({ cinematics: 'full' });
    const camera = new THREE.PerspectiveCamera();
    const cutaway = director.update(snapshot, camera, 0, {
      crowdCutawaysEnabled: true,
      presentationEvents: [makeEvent('touchdown', 13, snapshot)],
    });

    expect(cutaway.activeShotName).toBe('touchdownCrowdCutaway');

    let orbit = cutaway;

    for (let frame = 0; frame < 30; frame += 1) {
      orbit = director.update(snapshot, camera, 0.05, {
        crowdCutawaysEnabled: true,
        presentationEvents: [],
      });
    }

    expect(orbit.activeShotName).toBe('touchdownOrbit360');
    expect(orbit.focusTarget.x).toBeCloseTo(-4);
    expect(orbit.focusTarget.z).toBeCloseTo(50);
  });

  it('respects the off cinematics setting while preserving normal cinematic phases', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const director = new PresentationCameraDirector({ cinematics: 'off' });
    const debug = director.update(snapshotGameplayModel(gameplay), new THREE.PerspectiveCamera(), 0);

    expect(debug.activeShotName).toBeNull();
    expect(debug.phase).toBe('preSnapEstablish');
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
  const gameplay = createGameplayModel({ playbookId: '5v5' });
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

function makeEvent(
  type: PresentationAudioEvent['type'],
  id: number,
  snapshot: GameplaySnapshot,
): PresentationAudioEvent {
  return {
    id: `${type}:${id}`,
    playResult: snapshot.lastPlayResult ?? undefined,
    playState: snapshot.playState,
    score: snapshot.score,
    type,
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
