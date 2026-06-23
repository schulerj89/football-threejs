import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRE_SNAP_CADENCE_CONFIG,
  createPreSnapCadenceState,
  notifyPreSnapPlaySelected,
  requestPreSnapSnap,
  resetPreSnapCadenceForFormation,
  snapshotPreSnapCadence,
  updatePreSnapCadence,
} from '../src/gameplay/PreSnapCadenceModel';

describe('pre-snap cadence model', () => {
  it('plays Ready after formation settlement and waits for Space', () => {
    const state = createPreSnapCadenceState('inside-zone-11');
    resetPreSnapCadenceForFormation(state, 'inside-zone-11');

    expect(snapshotPreSnapCadence(state)).toMatchObject({
      hudText: 'SETTING FORMATION',
      phase: 'settling',
    });

    const ready = updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.settleDelaySeconds,
    });

    expect(ready.readyCueRequested).toMatch(/^qb_ready_/);
    expect(snapshotPreSnapCadence(state)).toMatchObject({
      hudText: 'READY',
      phase: 'readySpeaking',
    });

    updatePreSnapCadence(state, {
      deltaSeconds: 0,
      readyAudioCompleted: true,
    });

    expect(snapshotPreSnapCadence(state)).toMatchObject({
      hudText: 'PRESS SPACE TO SNAP',
      phase: 'awaitingSnap',
    });
  });

  it('rejects Space before awaitingSnap without queueing a snap', () => {
    const state = createPreSnapCadenceState('inside-zone-11');
    resetPreSnapCadenceForFormation(state, 'inside-zone-11');

    const early = requestPreSnapSnap(state);

    expect(early).toMatchObject({
      hutCueRequested: null,
      snapAccepted: false,
      snapRejected: true,
      snapReleased: false,
    });
    expect(snapshotPreSnapCadence(state)).toMatchObject({
      hudText: 'WAIT FOR READY',
      phase: 'settling',
      playSelectionLocked: false,
    });
  });

  it('plays Hut and releases the snap at the configured marker', () => {
    const state = createPreSnapCadenceState('spread-quick-11');
    resetPreSnapCadenceForFormation(state, 'spread-quick-11');
    updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.settleDelaySeconds,
    });
    updatePreSnapCadence(state, {
      deltaSeconds: 0,
      readyAudioCompleted: true,
    });

    const accepted = requestPreSnapSnap(state);

    expect(accepted.hutCueRequested).toMatch(/^qb_hut_/);
    expect(accepted.snapAccepted).toBe(true);
    expect(snapshotPreSnapCadence(state)).toMatchObject({
      hudText: 'HUT',
      phase: 'hutSpeaking',
      playSelectionLocked: true,
    });

    const beforeRelease = updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.hutReleaseSeconds - 0.01,
    });
    expect(beforeRelease.snapReleased).toBe(false);

    const release = updatePreSnapCadence(state, { deltaSeconds: 0.02 });
    expect(release.snapReleased).toBe(true);
    expect(snapshotPreSnapCadence(state).phase).toBe('snapRelease');
  });

  it('falls back to timing when audio is missing', () => {
    const state = createPreSnapCadenceState('curl-flat-11');
    resetPreSnapCadenceForFormation(state, 'curl-flat-11');
    updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.settleDelaySeconds,
    });

    updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.readyFallbackSeconds,
    });

    expect(snapshotPreSnapCadence(state)).toMatchObject({
      hudText: 'PRESS SPACE TO SNAP',
      phase: 'awaitingSnap',
    });
  });

  it('debounces rapid play changes into one final Ready cue', () => {
    const state = createPreSnapCadenceState('inside-zone-11');
    resetPreSnapCadenceForFormation(state, 'inside-zone-11');

    notifyPreSnapPlaySelected(state, 'outside-zone-11');
    updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.selectionDebounceSeconds / 2,
    });
    notifyPreSnapPlaySelected(state, 'curl-flat-11');
    const noReadyYet = updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.selectionDebounceSeconds / 2,
    });

    expect(noReadyYet.readyCueRequested).toBeNull();
    expect(snapshotPreSnapCadence(state)).toMatchObject({
      phase: 'readyPending',
      selectedPlayId: 'curl-flat-11',
    });

    updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.selectionDebounceSeconds,
    });
    const ready = updatePreSnapCadence(state, {
      deltaSeconds: DEFAULT_PRE_SNAP_CADENCE_CONFIG.settleDelaySeconds,
    });

    expect(ready.readyCueRequested).toMatch(/^qb_ready_/);
    expect(snapshotPreSnapCadence(state).selectedPlayId).toBe('curl-flat-11');
  });
});
