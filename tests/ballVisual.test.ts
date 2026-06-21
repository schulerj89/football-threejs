import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  FOOTBALL_VISUAL_CONFIG,
  createBallVisual,
  getBallVisualSnapshot,
  resolveBallVisualStyle,
  syncBallVisual,
} from '../src/ballVisual';
import { createBallModel, throwBallToward, updateInFlightBall } from '../src/ballModel';

describe('ball visual', () => {
  it('creates a shared low-poly football silhouette by default', () => {
    const first = createBallVisual();
    const second = createBallVisual();
    const firstSnapshot = getBallVisualSnapshot(first);
    const secondSnapshot = getBallVisualSnapshot(second);
    const firstShell = getMesh(first, 'football-shell');
    const secondShell = getMesh(second, 'football-shell');

    expect(firstSnapshot.style).toBe('football');
    expect(firstSnapshot.length).toBe(FOOTBALL_VISUAL_CONFIG.length);
    expect(firstSnapshot.diameter).toBe(FOOTBALL_VISUAL_CONFIG.diameter);
    expect(firstSnapshot.bounds.size.z).toBeGreaterThan(firstSnapshot.bounds.size.x);
    expect(firstSnapshot.bounds.size.z).toBeGreaterThan(firstSnapshot.bounds.size.y);
    expect(firstSnapshot.meshCount).toBe(2 + FOOTBALL_VISUAL_CONFIG.laceCount);
    expect(firstSnapshot.triangleCount).toBe(secondSnapshot.triangleCount);
    expect(firstShell.geometry).toBe(secondShell.geometry);
    expect(firstShell.material).toBe(secondShell.material);
  });

  it('supports the old sphere comparison option', () => {
    const sphere = createBallVisual({ style: resolveBallVisualStyle('sphere') });
    const snapshot = getBallVisualSnapshot(sphere);

    expect(resolveBallVisualStyle('football')).toBe('football');
    expect(resolveBallVisualStyle('unexpected')).toBe('football');
    expect(snapshot.style).toBe('sphere');
    expect(sphere.getObjectByName('football-ball-sphere')).toBeInstanceOf(THREE.Mesh);
  });

  it('preserves gameplay-owned position and visibility rules', () => {
    const visual = createBallVisual();
    const ball = createBallModel({ x: 2, z: -3 });

    syncBallVisual(visual, ball);
    expect(visual.visible).toBe(false);
    expect(visual.position.x).toBe(2);
    expect(visual.position.z).toBe(-3);

    ball.state = { kind: 'possessed', playerId: 'offense-qb' };
    ball.position.x = 4;
    ball.position.z = -2;
    syncBallVisual(visual, ball);

    expect(visual.visible).toBe(true);
    expect(visual.position.x).toBe(4);
    expect(visual.position.z).toBe(-2);
  });

  it('points its long axis along in-flight horizontal travel and spirals visually', () => {
    const visual = createBallVisual();
    const ball = createBallModel({ x: 0, z: 0 });

    syncBallVisual(visual, ball);
    ball.possession = { kind: 'player', playerId: 'offense-qb' };
    ball.state = { kind: 'possessed', playerId: 'offense-qb' };
    expect(throwBallToward(ball, { x: 10, y: 1.35, z: 0 })).toBe(true);
    updateInFlightBall(ball, 0.1);
    syncBallVisual(visual, ball);

    const snapshot = getBallVisualSnapshot(visual);
    const spiralRoot = visual.getObjectByName('football-spiral-root');

    expect(snapshot.longAxisWorld.x).toBeGreaterThan(0.98);
    expect(Math.abs(snapshot.longAxisWorld.z)).toBeLessThan(0.05);
    expect(spiralRoot?.rotation.z).toBeGreaterThan(0);
  });
});

function getMesh(root: THREE.Object3D, name: string): THREE.Mesh {
  const mesh = root.getObjectByName(name);

  if (!(mesh instanceof THREE.Mesh)) {
    throw new Error(`Missing mesh ${name}`);
  }

  return mesh;
}
