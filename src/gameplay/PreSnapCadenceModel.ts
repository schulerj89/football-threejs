export type PreSnapCadencePhase =
  | 'waitingForPlaySelection'
  | 'settling'
  | 'readyPending'
  | 'readySpeaking'
  | 'awaitingSnap'
  | 'hutSpeaking'
  | 'snapRelease'
  | 'complete';

export type PreSnapCadenceCueKind = 'hut' | 'ready';

export interface PreSnapCadenceConfig {
  hutFallbackSeconds: number;
  hutReleaseSeconds: number;
  hutVariants: readonly string[];
  readyFallbackSeconds: number;
  readyVariants: readonly string[];
  selectionDebounceSeconds: number;
  settleDelaySeconds: number;
  waitForReadyFlashSeconds: number;
}

export interface PreSnapCadenceState {
  earlySnapWarningSeconds: number;
  hutAssetId: string | null;
  phase: PreSnapCadencePhase;
  phaseElapsedSeconds: number;
  playSelectedForSnap: boolean;
  playSelectionLocked: boolean;
  readyAssetId: string | null;
  selectedPlayId: string | null;
  sequence: number;
  snapReleaseEmitted: boolean;
}

export interface PreSnapCadenceUpdateInput {
  deltaSeconds: number;
  hutAudioCompleted?: boolean;
  readyAudioCompleted?: boolean;
}

export interface PreSnapCadenceEvents {
  hutCueRequested: string | null;
  readyCueRequested: string | null;
  snapAccepted: boolean;
  snapRejected: boolean;
  snapReleased: boolean;
}

export interface PreSnapCadenceSnapshot {
  earlySnapWarningVisible: boolean;
  hudText: string;
  hutAssetId: string | null;
  phase: PreSnapCadencePhase;
  playSelectedForSnap: boolean;
  playSelectionLocked: boolean;
  readyAssetId: string | null;
  selectedPlayId: string | null;
  sequence: number;
}

export const DEFAULT_PRE_SNAP_CADENCE_CONFIG: PreSnapCadenceConfig = {
  hutFallbackSeconds: 0.72,
  hutReleaseSeconds: 0.12,
  hutVariants: ['qb_hut_01', 'qb_hut_02', 'qb_hut_03'],
  readyFallbackSeconds: 0.68,
  readyVariants: ['qb_ready_01', 'qb_ready_02'],
  selectionDebounceSeconds: 0.22,
  settleDelaySeconds: 0.28,
  waitForReadyFlashSeconds: 0.55,
} as const;

export function createPreSnapCadenceState(
  selectedPlayId: string | null = null,
): PreSnapCadenceState {
  return {
    earlySnapWarningSeconds: 0,
    hutAssetId: null,
    phase: selectedPlayId ? 'readyPending' : 'waitingForPlaySelection',
    phaseElapsedSeconds: 0,
    playSelectedForSnap: selectedPlayId !== null,
    playSelectionLocked: false,
    readyAssetId: null,
    selectedPlayId,
    sequence: 0,
    snapReleaseEmitted: false,
  };
}

export function resetPreSnapCadenceForFormation(
  state: PreSnapCadenceState,
  selectedPlayId: string,
): PreSnapCadenceEvents {
  state.earlySnapWarningSeconds = 0;
  state.hutAssetId = null;
  state.phase = 'waitingForPlaySelection';
  state.phaseElapsedSeconds = 0;
  state.playSelectedForSnap = false;
  state.playSelectionLocked = false;
  state.readyAssetId = null;
  state.selectedPlayId = selectedPlayId;
  state.sequence += 1;
  state.snapReleaseEmitted = false;
  return createEmptyEvents();
}

export function notifyPreSnapPlaySelected(
  state: PreSnapCadenceState,
  selectedPlayId: string,
): PreSnapCadenceEvents {
  if (state.playSelectionLocked) {
    return createEmptyEvents();
  }

  state.earlySnapWarningSeconds = 0;
  state.hutAssetId = null;
  state.playSelectedForSnap = true;
  state.phase = 'readyPending';
  state.phaseElapsedSeconds = 0;
  state.readyAssetId = null;
  state.selectedPlayId = selectedPlayId;
  state.sequence += 1;
  state.snapReleaseEmitted = false;
  return createEmptyEvents();
}

export function clearPreSnapCadence(state: PreSnapCadenceState): void {
  state.earlySnapWarningSeconds = 0;
  state.hutAssetId = null;
  state.phase = 'complete';
  state.phaseElapsedSeconds = 0;
  state.playSelectedForSnap = false;
  state.playSelectionLocked = false;
  state.readyAssetId = null;
  state.selectedPlayId = null;
  state.snapReleaseEmitted = false;
}

export function requestPreSnapSnap(
  state: PreSnapCadenceState,
  config: PreSnapCadenceConfig = DEFAULT_PRE_SNAP_CADENCE_CONFIG,
): PreSnapCadenceEvents {
  const events = createEmptyEvents();
  if (!state.playSelectedForSnap || state.phase !== 'awaitingSnap') {
    state.earlySnapWarningSeconds = config.waitForReadyFlashSeconds;
    events.snapRejected = true;
    return events;
  }

  state.earlySnapWarningSeconds = 0;
  state.hutAssetId = selectCadenceVariant(
    config.hutVariants,
    `${state.selectedPlayId ?? 'play'}:${state.sequence}:hut`,
  );
  state.phase = 'hutSpeaking';
  state.phaseElapsedSeconds = 0;
  state.playSelectionLocked = true;
  state.snapReleaseEmitted = false;
  events.hutCueRequested = state.hutAssetId;
  events.snapAccepted = true;
  return events;
}

export function updatePreSnapCadence(
  state: PreSnapCadenceState,
  input: PreSnapCadenceUpdateInput,
  config: PreSnapCadenceConfig = DEFAULT_PRE_SNAP_CADENCE_CONFIG,
): PreSnapCadenceEvents {
  const events = createEmptyEvents();
  const delta = Math.max(0, input.deltaSeconds);
  state.phaseElapsedSeconds += delta;
  state.earlySnapWarningSeconds = Math.max(0, state.earlySnapWarningSeconds - delta);

  if (state.phase === 'waitingForPlaySelection' || !state.playSelectedForSnap) {
    return events;
  }

  if (state.phase === 'readyPending') {
    if (state.phaseElapsedSeconds >= config.selectionDebounceSeconds) {
      state.phase = 'settling';
      state.phaseElapsedSeconds = 0;
    }
    return events;
  }

  if (state.phase === 'settling') {
    if (state.phaseElapsedSeconds >= config.settleDelaySeconds) {
      state.readyAssetId = selectCadenceVariant(
        config.readyVariants,
        `${state.selectedPlayId ?? 'play'}:${state.sequence}:ready`,
      );
      state.phase = 'readySpeaking';
      state.phaseElapsedSeconds = 0;
      events.readyCueRequested = state.readyAssetId;
    }
    return events;
  }

  if (state.phase === 'readySpeaking') {
    if (input.readyAudioCompleted || state.phaseElapsedSeconds >= config.readyFallbackSeconds) {
      state.phase = 'awaitingSnap';
      state.phaseElapsedSeconds = 0;
    }
    return events;
  }

  if (state.phase === 'hutSpeaking') {
    if (!state.snapReleaseEmitted && state.phaseElapsedSeconds >= config.hutReleaseSeconds) {
      state.snapReleaseEmitted = true;
      state.phase = 'snapRelease';
      events.snapReleased = true;
    }
    return events;
  }

  if (state.phase === 'snapRelease') {
    state.phase = 'complete';
    state.phaseElapsedSeconds = 0;
  }

  return events;
}

export function snapshotPreSnapCadence(
  state: PreSnapCadenceState,
): PreSnapCadenceSnapshot {
  return {
    earlySnapWarningVisible: state.earlySnapWarningSeconds > 0,
    hudText: getPreSnapCadenceHudText(state),
    hutAssetId: state.hutAssetId,
    phase: state.phase,
    playSelectedForSnap: state.playSelectedForSnap,
    playSelectionLocked: state.playSelectionLocked,
    readyAssetId: state.readyAssetId,
    selectedPlayId: state.selectedPlayId,
    sequence: state.sequence,
  };
}

export function getPreSnapCadenceHudText(state: PreSnapCadenceState): string {
  if (!state.playSelectedForSnap && state.phase !== 'complete') {
    return 'CHOOSE A PLAY';
  }

  if (state.earlySnapWarningSeconds > 0) {
    return 'WAIT FOR READY';
  }

  switch (state.phase) {
    case 'waitingForPlaySelection':
      return 'CHOOSE A PLAY';
    case 'readyPending':
    case 'settling':
      return 'SETTING FORMATION';
    case 'readySpeaking':
      return 'READY';
    case 'awaitingSnap':
      return 'PRESS SPACE TO SNAP';
    case 'hutSpeaking':
    case 'snapRelease':
      return 'HUT';
    case 'complete':
    default:
      return '';
  }
}

export function isPreSnapPlaySelectionLocked(state: PreSnapCadenceState): boolean {
  return state.playSelectionLocked;
}

function createEmptyEvents(): PreSnapCadenceEvents {
  return {
    hutCueRequested: null,
    readyCueRequested: null,
    snapAccepted: false,
    snapRejected: false,
    snapReleased: false,
  };
}

function selectCadenceVariant(variants: readonly string[], seed: string): string {
  if (variants.length === 0) {
    return '';
  }

  return variants[stableHash(seed) % variants.length]!;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
