import type { GameplaySnapshot, PlayResult } from '../playState';

export type PresentationAudioEventType =
  | 'ballSnapped'
  | 'challengeEnding'
  | 'firstDown'
  | 'incomplete'
  | 'outOfBounds'
  | 'passCaught'
  | 'playPrepared'
  | 'playReset'
  | 'playStarted'
  | 'sack'
  | 'safety'
  | 'tackle'
  | 'touchdown'
  | 'turnoverOnDowns';

export interface PresentationAudioEvent {
  readonly id: string;
  readonly playResult?: Readonly<PlayResult>;
  readonly playState: GameplaySnapshot['playState'];
  readonly score: number;
  readonly type: PresentationAudioEventType;
}

const FIRST_DOWN_EPSILON_YARDS = 0.0001;

export function derivePresentationAudioEvents(
  previous: GameplaySnapshot | null,
  current: GameplaySnapshot,
): readonly PresentationAudioEvent[] {
  const events: PresentationAudioEvent[] = [];

  if (!previous) {
    if (current.playState === 'preSnap') {
      events.push(createEvent('playPrepared', createPlayPreparedId(current, 'initial'), current));
    }
    return freezeEvents(events);
  }

  if (previous.playState !== 'preSnap' && current.playState === 'preSnap') {
    const resetSourceId = previous.lastPlayResult?.id ?? 'manual';
    events.push(createEvent('playPrepared', createPlayPreparedId(current, String(resetSourceId)), current));
  }

  if (previous.playState === 'preSnap' && current.playState === 'live') {
    const playIdentity = createActivePlayId(current);
    events.push(createEvent('playStarted', `playStarted:${playIdentity}`, current));
    events.push(createEvent('ballSnapped', `ballSnapped:${playIdentity}`, current));
  }

  if (previous.ball.state.kind === 'inFlight' && current.ball.state.kind === 'caught') {
    events.push(
      createEvent('passCaught', `passCaught:${createActivePlayId(current)}:${current.ball.state.playerId}`, current),
    );
  }

  if (
    current.lastPlayResult &&
    previous.lastPlayResult?.id !== current.lastPlayResult.id
  ) {
    events.push(...createResultEvents(previous, current, current.lastPlayResult));
  }

  if (
    previous.scoreAttack.state !== 'gameOver' &&
    current.scoreAttack.state === 'gameOver'
  ) {
    events.push(createEvent('challengeEnding', `challengeEnding:${current.scoreAttack.finalScore ?? current.score}`, current));
  }

  if (previous.playState === 'dead' && current.playState === 'preSnap') {
    const resetSourceId = previous.lastPlayResult?.id ?? 'unknown';
    events.push(createEvent('playReset', `playReset:${resetSourceId}`, current));
  }

  return freezeEvents(events);
}

function createResultEvents(
  previous: GameplaySnapshot,
  current: GameplaySnapshot,
  result: PlayResult,
): PresentationAudioEvent[] {
  const events = [
    createEvent(result.type, `${result.type}:${result.id}`, current, result),
  ];

  if (current.drive.lastDriveResult?.type === 'turnoverOnDowns') {
    events.push(createEvent('turnoverOnDowns', `turnoverOnDowns:${result.id}`, current, result));
    return events;
  }

  if (isFirstDownResult(previous, current, result)) {
    events.push(createEvent('firstDown', `firstDown:${result.id}`, current, result));
  }

  return events;
}

function isFirstDownResult(
  previous: GameplaySnapshot,
  current: GameplaySnapshot,
  result: PlayResult,
): boolean {
  if (
    result.type === 'touchdown' ||
    result.type === 'incomplete' ||
    result.type === 'safety' ||
    current.drive.state !== 'active'
  ) {
    return false;
  }

  return (
    current.drive.currentDown === 1 &&
    result.endingBallSpot.z >= previous.drive.firstDownMarker.z - FIRST_DOWN_EPSILON_YARDS &&
    current.drive.lineOfScrimmage.z !== previous.drive.lineOfScrimmage.z
  );
}

function createEvent(
  type: PresentationAudioEventType,
  id: string,
  snapshot: GameplaySnapshot,
  playResult?: PlayResult,
): PresentationAudioEvent {
  return Object.freeze({
    id,
    playResult: playResult ? Object.freeze({ ...playResult }) : undefined,
    playState: snapshot.playState,
    score: snapshot.score,
    type,
  });
}

function createActivePlayId(snapshot: GameplaySnapshot): string {
  const spot = snapshot.activePlayStartSpot ?? snapshot.currentBallSpot;

  return [
    snapshot.selectedPlay.id,
    snapshot.drive.currentDown,
    spot.x.toFixed(2),
    spot.z.toFixed(2),
    snapshot.scoreAttack.remainingSeconds.toFixed(2),
  ].join(':');
}

function createPlayPreparedId(snapshot: GameplaySnapshot, sourceId: string): string {
  return [
    'playPrepared',
    sourceId,
    snapshot.selectedPlay.id,
    snapshot.drive.currentDown,
    snapshot.drive.lineOfScrimmage.x.toFixed(2),
    snapshot.drive.lineOfScrimmage.z.toFixed(2),
  ].join(':');
}

function freezeEvents(events: PresentationAudioEvent[]): readonly PresentationAudioEvent[] {
  return Object.freeze(events);
}
