import type { MatchPossession } from '../match/MatchTypes';
import type { GameStatsEvent } from './GameStatsEvent';
import type {
  GameStatsState,
  PlayerGameStatsDelta,
  TeamGameStatsDelta,
} from './GameStatsTypes';
import { getOrCreatePlayerStats } from './GameStatsModel';
import { refreshGameStatsSnapshot } from './GameStatsSnapshot';
import { validateGameStatsState } from './StatsValidation';

export interface GameStatsReducerResult {
  accepted: boolean;
  duplicate: boolean;
}

export function applyGameStatsEvent(
  state: GameStatsState,
  event: GameStatsEvent,
): GameStatsReducerResult {
  if (event.type === 'reset') {
    state.processedEventIds.clear();
  } else if (state.processedEventIds.has(event.id)) {
    state.duplicateSuppressionCount += 1;
    state.lastEvent = {
      accepted: false,
      description: 'duplicate event suppressed',
      eventId: event.id,
      team: resolveEventTeam(event),
      type: event.type,
    };
    refreshGameStatsSnapshot(state);
    return { accepted: false, duplicate: true };
  }

  state.processedEventIds.add(event.id);
  switch (event.type) {
    case 'kickoffResult':
      applyKickoffResult(state, event);
      break;
    case 'opponentDrive':
      applyTeamDelta(state, event.team, event.stats.teamDelta);
      for (const delta of event.stats.playerDeltas) {
        applyPlayerDelta(state, delta);
      }
      break;
    case 'passReleased':
      applyPassReleased(state, event.offense, event.passerRosterId, event.targetRosterId);
      break;
    case 'placeKickResult':
      applyPlaceKickResult(state, event);
      break;
    case 'playEnded':
      applyPlayEnded(state, event);
      break;
    case 'possessionTime':
      applyPossessionTime(state, event.team, event.seconds);
      break;
    case 'punt':
      applyPunt(state, event.team, event.punterRosterId, event.puntYards);
      break;
    case 'reset':
      break;
  }

  state.invariantFailures = validateGameStatsState(state);
  state.lastEvent = {
    accepted: true,
    description: describeEvent(event),
    eventId: event.id,
    team: resolveEventTeam(event),
    type: event.type,
  };
  refreshGameStatsSnapshot(state);
  return { accepted: true, duplicate: false };
}

function applyPlayEnded(
  state: GameStatsState,
  event: Extract<GameStatsEvent, { type: 'playEnded' }>,
): void {
  const offense = state.teams[event.offense];
  const defense = state.teams[event.defense];
  offense.offensivePlays += 1;
  offense.totalYards += event.yardsGained;
  if (event.firstDown) {
    offense.firstDowns += 1;
  }
  if (event.downBefore === 3) {
    offense.thirdDownAttempts += 1;
    if (event.firstDown || event.touchdown) {
      offense.thirdDownConversions += 1;
    }
  }
  if (event.downBefore === 4) {
    offense.fourthDownAttempts += 1;
    if (event.firstDown || event.touchdown) {
      offense.fourthDownConversions += 1;
    }
  }

  if (event.resultType === 'sack') {
    offense.sacksAllowed += 1;
    defense.sacksMade += 1;
    if (event.passerRosterId) {
      getOrCreatePlayerStats(state, event.passerRosterId, event.offense).sacksTaken += 1;
    }
    if (event.sackerRosterId) {
      const sacker = getOrCreatePlayerStats(state, event.sackerRosterId, event.defense);
      sacker.sacks += 1;
      sacker.tackles += 1;
    }
    return;
  }

  if (event.passAttempted) {
    if (!event.passAttemptAlreadyRecorded) {
      applyPassReleased(state, event.offense, event.passerRosterId, event.targetRosterId);
    }
    if (event.passCompleted && event.passerRosterId && event.receiverRosterId) {
      offense.completions += 1;
      offense.passingYards += event.yardsGained;
      const passer = getOrCreatePlayerStats(state, event.passerRosterId, event.offense);
      passer.completions += 1;
      passer.passingYards += event.yardsGained;
      const receiver = getOrCreatePlayerStats(state, event.receiverRosterId, event.offense);
      receiver.receptions += 1;
      receiver.receivingYards += event.yardsGained;
      receiver.longestReception = Math.max(receiver.longestReception, event.yardsGained);
      if (event.touchdown) {
        offense.points += 6;
        offense.passingTouchdowns += 1;
        passer.passingTouchdowns += 1;
        receiver.receivingTouchdowns += 1;
      }
    }
  } else {
    if (event.carrierRosterId) {
      offense.rushingAttempts += 1;
      offense.rushingYards += event.yardsGained;
      const rusher = getOrCreatePlayerStats(state, event.carrierRosterId, event.offense);
      rusher.rushingAttempts += 1;
      rusher.rushingYards += event.yardsGained;
      rusher.longestRush = Math.max(rusher.longestRush, event.yardsGained);
      if (event.touchdown) {
        offense.points += 6;
        offense.rushingTouchdowns += 1;
        rusher.rushingTouchdowns += 1;
      }
    }
  }

  if (event.resultType === 'tackle' && event.tacklerRosterId) {
    getOrCreatePlayerStats(state, event.tacklerRosterId, event.defense).tackles += 1;
  }
}

function applyPassReleased(
  state: GameStatsState,
  offenseTeam: MatchPossession,
  passerRosterId: string | null,
  targetRosterId: string | null,
): void {
  state.teams[offenseTeam].passingAttempts += 1;
  if (passerRosterId) {
    getOrCreatePlayerStats(state, passerRosterId, offenseTeam).attempts += 1;
  }
  if (targetRosterId) {
    getOrCreatePlayerStats(state, targetRosterId, offenseTeam).targets += 1;
  }
}

function applyKickoffResult(
  state: GameStatsState,
  event: Extract<GameStatsEvent, { type: 'kickoffResult' }>,
): void {
  if (event.kickerRosterId) {
    const kicker = getOrCreatePlayerStats(state, event.kickerRosterId, event.kickingTeam);
    kicker.kickoffs += 1;
    if (event.touchback) {
      kicker.touchbacks += 1;
    }
  }

  if (event.touchback || !event.returnerRosterId) {
    return;
  }

  const team = state.teams[event.receivingTeam];
  team.kickoffReturns += 1;
  team.kickoffReturnYards += event.returnYards;
  const returner = getOrCreatePlayerStats(state, event.returnerRosterId, event.receivingTeam);
  returner.returns += 1;
  returner.returnYards += event.returnYards;
  returner.longestReturn = Math.max(returner.longestReturn, event.returnYards);
  if (event.returnTouchdown) {
    team.points += 6;
    returner.returnTouchdowns += 1;
  }
}

function applyPlaceKickResult(
  state: GameStatsState,
  event: Extract<GameStatsEvent, { type: 'placeKickResult' }>,
): void {
  const team = state.teams[event.team];
  const kicker = event.kickerRosterId
    ? getOrCreatePlayerStats(state, event.kickerRosterId, event.team)
    : null;
  if (event.kind === 'pat') {
    team.patAttempts += 1;
    if (event.good) {
      team.patMade += 1;
      team.points += 1;
    }
    if (kicker) {
      kicker.patAttempted += 1;
      if (event.good) {
        kicker.patMade += 1;
      }
    }
    return;
  }

  team.fieldGoalsAttempted += 1;
  if (event.good) {
    team.fieldGoalsMade += 1;
    team.points += 3;
  }
  if (kicker) {
    kicker.fieldGoalsAttempted += 1;
    if (event.good) {
      kicker.fieldGoalsMade += 1;
      kicker.longestMadeFieldGoal = Math.max(kicker.longestMadeFieldGoal, event.distanceYards);
    }
  }
}

function applyPunt(
  state: GameStatsState,
  team: MatchPossession,
  punterRosterId: string | null,
  puntYards: number,
): void {
  state.teams[team].punts += 1;
  state.teams[team].puntYards += puntYards;
  if (punterRosterId) {
    getOrCreatePlayerStats(state, punterRosterId, team);
  }
}

function applyPossessionTime(
  state: GameStatsState,
  team: MatchPossession,
  seconds: number,
): void {
  const safeSeconds = Math.max(0, seconds);
  state.teams[team].timeOfPossession += safeSeconds;
  state.possessionSeconds[team] += safeSeconds;
}

function applyTeamDelta(
  state: GameStatsState,
  team: MatchPossession,
  delta: TeamGameStatsDelta,
): void {
  const target = state.teams[team];
  for (const [key, value] of Object.entries(delta) as Array<[keyof TeamGameStatsDelta, number | undefined]>) {
    if (typeof value === 'number') {
      target[key] = (target[key] ?? 0) + value;
    }
  }
  if (typeof delta.timeOfPossession === 'number') {
    state.possessionSeconds[team] += delta.timeOfPossession;
  }
}

function applyPlayerDelta(
  state: GameStatsState,
  delta: PlayerGameStatsDelta,
): void {
  const target = getOrCreatePlayerStats(state, delta.rosterPlayerId, delta.team);
  for (const [key, value] of Object.entries(delta.stats) as Array<[keyof PlayerGameStatsDelta['stats'], number | undefined]>) {
    if (typeof value === 'number') {
      target[key] = (target[key] ?? 0) + value;
    }
  }
}

function resolveEventTeam(event: GameStatsEvent): MatchPossession | null {
  switch (event.type) {
    case 'kickoffResult':
      return event.receivingTeam;
    case 'opponentDrive':
    case 'passReleased':
      return event.type === 'passReleased' ? event.offense : event.team;
    case 'placeKickResult':
    case 'possessionTime':
    case 'punt':
      return event.team;
    case 'playEnded':
      return event.offense;
    case 'reset':
      return null;
  }
}

function describeEvent(event: GameStatsEvent): string {
  switch (event.type) {
    case 'kickoffResult':
      return event.touchback
        ? 'kickoff touchback'
        : `kickoff return ${event.returnYards} yards`;
    case 'opponentDrive':
      return 'simulated opponent drive';
    case 'passReleased':
      return 'pass attempt recorded';
    case 'placeKickResult':
      return `${event.kind} ${event.good ? 'made' : 'missed'}`;
    case 'playEnded':
      return `${event.resultType} for ${event.yardsGained} yards`;
    case 'possessionTime':
      return `${event.seconds.toFixed(2)} seconds possession`;
    case 'punt':
      return `punt ${event.puntYards} yards`;
    case 'reset':
      return 'stats event ids reset';
  }
}

