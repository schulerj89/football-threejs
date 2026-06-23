import { describe, expect, it } from 'vitest';
import { createPlayerModel } from '../src/playerModel';
import {
  PLAYER_HEAD_ANCHOR_NAME,
  createPlaceholderPlayerVisual,
} from '../src/playerVisual';
import type { PreSnapCadenceSnapshot } from '../src/gameplay/PreSnapCadenceModel';
import { syncPreSnapQuarterbackHeadYaw } from '../src/presentation/PreSnapHeadSwivel';

describe('pre-snap quarterback head swivel', () => {
  it('applies cadence yaw to the quarterback head anchor only', () => {
    const quarterback = createPlaceholderPlayerVisual(createPlayerModel(undefined, {
      id: 'offense-qb',
      role: 'quarterback',
      team: 'offense',
    }));
    const runningBack = createPlaceholderPlayerVisual(createPlayerModel(undefined, {
      id: 'offense-rb',
      role: 'runner',
      team: 'offense',
    }));
    const visuals = new Map([
      ['offense-qb', quarterback],
      ['offense-rb', runningBack],
    ]);
    const cadence = createCadenceSnapshot({ headYawRadians: -0.42 });

    syncPreSnapQuarterbackHeadYaw(visuals, cadence);

    expect(quarterback.getObjectByName(PLAYER_HEAD_ANCHOR_NAME)?.rotation.y).toBeCloseTo(-0.42);
    expect(runningBack.getObjectByName(PLAYER_HEAD_ANCHOR_NAME)?.rotation.y).toBeCloseTo(0);

    syncPreSnapQuarterbackHeadYaw(visuals, null);

    expect(quarterback.getObjectByName(PLAYER_HEAD_ANCHOR_NAME)?.rotation.y).toBeCloseTo(0);
  });
});

function createCadenceSnapshot(
  overrides: Partial<PreSnapCadenceSnapshot> = {},
): PreSnapCadenceSnapshot {
  return {
    earlySnapWarningVisible: false,
    headYawRadians: 0,
    hudText: 'READY',
    hutAssetId: null,
    phase: 'headSwivel',
    playSelectedForSnap: true,
    playSelectionLocked: false,
    readyAssetId: 'qb_ready_01',
    selectedPlayId: 'inside-zone-11',
    sequence: 1,
    ...overrides,
  };
}
