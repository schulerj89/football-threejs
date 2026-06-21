import type { MatchClockSnapshot } from './MatchTypes';

export interface MatchClock extends MatchClockSnapshot {}

export function createMatchClock(quarterDurationSeconds: number): MatchClock {
  const duration = normalizeQuarterDuration(quarterDurationSeconds);

  return {
    quarterDurationSeconds: duration,
    remainingSeconds: duration,
    running: false,
  };
}

export function resetMatchClock(clock: MatchClock, quarterDurationSeconds = clock.quarterDurationSeconds): void {
  const duration = normalizeQuarterDuration(quarterDurationSeconds);
  clock.quarterDurationSeconds = duration;
  clock.remainingSeconds = duration;
  clock.running = false;
}

export function startMatchClock(clock: MatchClock): void {
  if (clock.remainingSeconds > 0) {
    clock.running = true;
  }
}

export function stopMatchClock(clock: MatchClock): void {
  clock.running = false;
}

export function updateMatchClock(clock: MatchClock, deltaSeconds: number): boolean {
  if (!clock.running || clock.remainingSeconds <= 0) {
    return clock.remainingSeconds <= 0;
  }

  clock.remainingSeconds = Math.max(0, clock.remainingSeconds - Math.max(0, deltaSeconds));
  if (clock.remainingSeconds === 0) {
    clock.running = false;
    return true;
  }

  return false;
}

export function snapshotMatchClock(clock: MatchClock): MatchClockSnapshot {
  return { ...clock };
}

function normalizeQuarterDuration(value: number): number {
  if (!Number.isFinite(value)) {
    return 180;
  }

  return Math.max(30, Math.min(900, Math.round(value)));
}
