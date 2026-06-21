import type { GameplaySnapshot, PlayResult } from '../playState';

export type GameAudioEventType =
  | 'gameOver'
  | 'playReset'
  | 'playResult'
  | 'playStarted';

export interface GameAudioEvent {
  playResult?: PlayResult;
  playState: GameplaySnapshot['playState'];
  score: number;
  type: GameAudioEventType;
}

interface GameAudioEventState {
  lastPlayResultId: number | null;
  playState: GameplaySnapshot['playState'];
  score: number;
}

export function deriveGameAudioEvents(
  previous: GameplaySnapshot | null,
  current: GameplaySnapshot,
): GameAudioEvent[] {
  if (!previous) {
    return [];
  }

  const previousState = snapshotEventState(previous);
  const currentState = snapshotEventState(current);
  const events: GameAudioEvent[] = [];

  if (previousState.playState === 'preSnap' && currentState.playState === 'live') {
    events.push(createEvent('playStarted', current));
  }

  if (previousState.playState === 'dead' && currentState.playState === 'preSnap') {
    events.push(createEvent('playReset', current));
  }

  if (previousState.playState !== 'gameOver' && currentState.playState === 'gameOver') {
    events.push(createEvent('gameOver', current));
  }

  if (
    current.lastPlayResult &&
    previousState.lastPlayResultId !== current.lastPlayResult.id
  ) {
    events.push({
      ...createEvent('playResult', current),
      playResult: current.lastPlayResult,
    });
  }

  return events;
}

function snapshotEventState(snapshot: GameplaySnapshot): GameAudioEventState {
  return {
    lastPlayResultId: snapshot.lastPlayResult?.id ?? null,
    playState: snapshot.playState,
    score: snapshot.score,
  };
}

function createEvent(type: GameAudioEventType, snapshot: GameplaySnapshot): GameAudioEvent {
  return {
    playState: snapshot.playState,
    score: snapshot.score,
    type,
  };
}
