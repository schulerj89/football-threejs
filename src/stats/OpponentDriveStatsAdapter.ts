import type { TeamRoster } from '../roster/TeamRoster';
import type { RosterPlayer } from '../roster/RosterPlayer';
import type { DriveSummary, MatchPossession } from '../match/MatchTypes';
import type { SimulatedDriveStats, PlayerGameStatsDelta } from './GameStatsTypes';

export interface OpponentDriveStatsAdapterInput {
  opponentRoster: TeamRoster;
  seed: number;
  summary: DriveSummary;
  userRoster: TeamRoster;
}

export function createOpponentDriveStats(
  input: OpponentDriveStatsAdapterInput,
): SimulatedDriveStats {
  const rng = createSeededRng(hashString(`${input.seed}:${input.summary.id}:stats`));
  const offenseTeam: MatchPossession = 'opponent';
  const defenseTeam: MatchPossession = 'user';
  const plays = Math.max(0, input.summary.plays);
  const totalYards = input.summary.yards;
  const positiveYards = Math.max(0, totalYards);
  const passAttempts = plays > 0
    ? clampInt(Math.round(plays * (0.48 + rng() * 0.16)), 1, Math.max(1, plays))
    : 0;
  const completions = passAttempts > 0
    ? clampInt(Math.round(passAttempts * (0.52 + rng() * 0.2)), 0, passAttempts)
    : 0;
  const passYards = completions > 0 ? Math.round(positiveYards * (0.48 + rng() * 0.22)) : 0;
  const rushAttempts = Math.max(0, plays - passAttempts);
  const rushYards = totalYards - passYards;
  const touchdown = input.summary.result === 'touchdown';
  const passingTouchdown = touchdown && completions > 0 && rng() >= 0.42;
  const rushingTouchdown = touchdown && !passingTouchdown;
  const sackCount = plays > 0 && input.summary.result !== 'touchdown' && rng() > 0.72 ? 1 : 0;

  const qb = findStarterByPosition(input.opponentRoster, 'QB');
  const rb = findStarterByPosition(input.opponentRoster, 'RB');
  const receivers = findReceiverPool(input.opponentRoster);
  const kicker = findPlayer(input.opponentRoster, input.opponentRoster.kickerId);
  const punter = findPlayer(input.opponentRoster, input.opponentRoster.punterId);
  const defenders = input.userRoster.defensiveStarterIds
    .map((id) => findPlayer(input.userRoster, id))
    .filter(Boolean) as RosterPlayer[];
  const playerDeltas: PlayerGameStatsDelta[] = [];

  if (qb && passAttempts > 0) {
    playerDeltas.push({
      rosterPlayerId: qb.id,
      team: offenseTeam,
      stats: {
        attempts: passAttempts,
        completions,
        interceptions: input.summary.result === 'turnover' && rng() > 0.5 ? 1 : 0,
        passingTouchdowns: passingTouchdown ? 1 : 0,
        passingYards: passYards,
        sacksTaken: sackCount,
      },
    });
  }
  if (rb && rushAttempts > 0) {
    playerDeltas.push({
      rosterPlayerId: rb.id,
      team: offenseTeam,
      stats: {
        longestRush: Math.max(0, rushYards),
        rushingAttempts: rushAttempts,
        rushingTouchdowns: rushingTouchdown ? 1 : 0,
        rushingYards: rushYards,
      },
    });
  }

  const targetSplits = splitInteger(passAttempts, receivers.length || 1);
  const receptionSplits = splitInteger(completions, receivers.length || 1);
  const receivingYardSplits = splitInteger(passYards, receivers.length || 1);
  receivers.forEach((receiver, index) => {
    const targets = targetSplits[index] ?? 0;
    const receptions = receptionSplits[index] ?? 0;
    const yards = receivingYardSplits[index] ?? 0;
    if (targets <= 0 && receptions <= 0 && yards <= 0) {
      return;
    }
    playerDeltas.push({
      rosterPlayerId: receiver.id,
      team: offenseTeam,
      stats: {
        longestReception: yards,
        receivingTouchdowns: passingTouchdown && index === 0 ? 1 : 0,
        receivingYards: yards,
        receptions,
        targets,
      },
    });
  });

  if (kicker) {
    const madeFieldGoal = input.summary.result === 'fieldGoal';
    const touchdownPatAttempt = touchdown ? 1 : 0;
    const touchdownPatMade = input.summary.scoringEvents.some((event) => event.type === 'extraPoint') ? 1 : 0;
    if (madeFieldGoal || touchdownPatAttempt) {
      playerDeltas.push({
        rosterPlayerId: kicker.id,
        team: offenseTeam,
        stats: {
          fieldGoalsAttempted: madeFieldGoal ? 1 : 0,
          fieldGoalsMade: madeFieldGoal ? 1 : 0,
          longestMadeFieldGoal: madeFieldGoal ? 34 + Math.floor(rng() * 18) : 0,
          patAttempted: touchdownPatAttempt,
          patMade: touchdownPatMade,
        },
      });
    }
  }
  if (punter && input.summary.result === 'punt') {
    playerDeltas.push({
      rosterPlayerId: punter.id,
      team: offenseTeam,
      stats: {},
    });
  }

  const tackleSplits = splitInteger(Math.max(0, plays - Number(touchdown)), defenders.length || 1);
  defenders.forEach((defender, index) => {
    const tackles = tackleSplits[index] ?? 0;
    const sacks = index === 0 ? sackCount : 0;
    const turnoversForced = input.summary.result === 'turnover' && index === 1 ? 1 : 0;
    if (tackles <= 0 && sacks <= 0 && turnoversForced <= 0) {
      return;
    }
    playerDeltas.push({
      rosterPlayerId: defender.id,
      team: defenseTeam,
      stats: {
        sacks,
        tackles: tackles + sacks,
        turnoversForced,
      },
    });
  });

  const patAttempts = touchdown ? 1 : 0;
  const patMade = input.summary.scoringEvents.some((event) => event.type === 'extraPoint') ? 1 : 0;
  const fieldGoals = input.summary.result === 'fieldGoal' ? 1 : 0;
  return {
    playerDeltas,
    teamDelta: {
      completions,
      fieldGoalsAttempted: fieldGoals,
      fieldGoalsMade: fieldGoals,
      firstDowns: estimateFirstDowns(input.summary, positiveYards),
      fourthDownAttempts: input.summary.result === 'turnoverOnDowns' ? 1 : 0,
      fourthDownConversions: 0,
      offensivePlays: plays,
      passingAttempts: passAttempts,
      passingTouchdowns: passingTouchdown ? 1 : 0,
      passingYards: passYards,
      patAttempts,
      patMade,
      points: input.summary.points,
      puntYards: input.summary.result === 'punt' ? 42 : 0,
      punts: input.summary.result === 'punt' ? 1 : 0,
      rushingAttempts: rushAttempts,
      rushingTouchdowns: rushingTouchdown ? 1 : 0,
      rushingYards: rushYards,
      sacksAllowed: sackCount,
      thirdDownAttempts: Math.floor(plays / 3),
      thirdDownConversions: Math.min(estimateFirstDowns(input.summary, positiveYards), Math.floor(plays / 3)),
      timeOfPossession: input.summary.elapsedSeconds,
      totalYards,
      turnovers: input.summary.result === 'turnover' ? 1 : 0,
    },
  };
}

function findStarterByPosition(roster: TeamRoster, position: RosterPlayer['footballPosition']): RosterPlayer | null {
  return roster.offensiveStarterIds
    .map((id) => findPlayer(roster, id))
    .find((player) => player?.footballPosition === position) ?? null;
}

function findReceiverPool(roster: TeamRoster): RosterPlayer[] {
  const eligible = new Set(['WR', 'SLOT', 'TE']);
  return roster.offensiveStarterIds
    .map((id) => findPlayer(roster, id))
    .filter((player): player is RosterPlayer => Boolean(player && eligible.has(player.footballPosition)))
    .slice(0, 4);
}

function findPlayer(roster: TeamRoster, id: string): RosterPlayer | null {
  return roster.players.find((player) => player.id === id) ?? null;
}

function estimateFirstDowns(summary: DriveSummary, positiveYards: number): number {
  if (summary.result === 'touchdown') {
    return Math.max(1, Math.floor(positiveYards / 10));
  }
  return Math.max(0, Math.floor(positiveYards / 12));
}

function splitInteger(total: number, buckets: number): number[] {
  if (buckets <= 0) {
    return [];
  }
  const base = Math.trunc(total / buckets);
  const remainder = Math.abs(total % buckets);
  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? Math.sign(total) || 1 : 0));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function createSeededRng(seed: number): () => number {
  let state = Math.abs(Math.trunc(seed)) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

