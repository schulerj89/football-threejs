import type { RosterPlayer } from '../roster/RosterPlayer';
import { getRosterPlayer, type TeamRoster } from '../roster/TeamRoster';
import { calculateOverallRating, calculateWeightedRating } from './OverallRatingCalculator';

export interface TeamRatings {
  readonly blocking: number;
  readonly coverage: number;
  readonly defense: number;
  readonly offense: number;
  readonly overall: number;
  readonly passRush: number;
  readonly passing: number;
  readonly rushing: number;
  readonly specialTeams: number;
}

export function calculateTeamRatings(roster: TeamRoster): TeamRatings {
  const offense = resolvePlayers(roster, roster.offensiveStarterIds);
  const defense = resolvePlayers(roster, roster.defensiveStarterIds);
  const kicker = getRosterPlayer(roster, roster.kickerId);
  const punter = getRosterPlayer(roster, roster.punterId);
  const longSnapper = getRosterPlayer(roster, roster.longSnapperId);
  const specialTeamsPlayers = [kicker, punter, longSnapper].filter(isRosterPlayer);
  const offenseRating = averageRatings(offense.map((player) =>
    calculateOverallRating(player.footballPosition, player.ratings)));
  const defenseRating = averageRatings(defense.map((player) =>
    calculateOverallRating(player.footballPosition, player.ratings)));
  const specialTeams = averageRatings(specialTeamsPlayers.map((player) =>
    calculateOverallRating(player.footballPosition, player.ratings)));
  const passing = calculatePassingRating(offense);
  const rushing = calculateRushingRating(offense);
  const blocking = calculateBlockingRating(offense);
  const passRush = calculatePassRushRating(defense);
  const coverage = calculateCoverageRating(defense);

  return {
    blocking,
    coverage,
    defense: defenseRating,
    offense: offenseRating,
    overall: clampTeamRating(offenseRating * 0.45 + defenseRating * 0.45 + specialTeams * 0.1),
    passRush,
    passing,
    rushing,
    specialTeams,
  };
}

function calculatePassingRating(players: readonly RosterPlayer[]): number {
  const quarterback = players.find((player) => player.footballPosition === 'QB');
  const receivers = players.filter((player) =>
    player.footballPosition === 'WR' ||
    player.footballPosition === 'SLOT' ||
    player.footballPosition === 'TE');
  const qbRating = quarterback
    ? calculateWeightedRating(quarterback.ratings, { AWR: 0.18, THA: 0.52, THP: 0.3 })
    : 0;
  const receiverRating = averageRatings(receivers.map((player) =>
    calculateWeightedRating(player.ratings, { ACC: 0.12, CIT: 0.18, CTH: 0.28, RTE: 0.3, SPD: 0.12 })));

  return clampTeamRating(qbRating * 0.58 + receiverRating * 0.42);
}

function calculateRushingRating(players: readonly RosterPlayer[]): number {
  const runningBack = players.find((player) => player.footballPosition === 'RB');
  const blockers = players.filter((player) =>
    player.footballPosition === 'C' ||
    player.footballPosition === 'LG' ||
    player.footballPosition === 'LT' ||
    player.footballPosition === 'RG' ||
    player.footballPosition === 'RT' ||
    player.footballPosition === 'TE');
  const backRating = runningBack
    ? calculateWeightedRating(runningBack.ratings, { ACC: 0.16, BCV: 0.2, BTK: 0.18, CAR: 0.16, COD: 0.14, SPD: 0.16 })
    : 0;
  const runBlocking = averageRatings(blockers.map((player) =>
    calculateWeightedRating(player.ratings, { RBK: 0.62, STR: 0.28, AWR: 0.1 })));

  return clampTeamRating(backRating * 0.55 + runBlocking * 0.45);
}

function calculateBlockingRating(players: readonly RosterPlayer[]): number {
  const blockers = players.filter((player) =>
    player.footballPosition === 'C' ||
    player.footballPosition === 'LG' ||
    player.footballPosition === 'LT' ||
    player.footballPosition === 'RG' ||
    player.footballPosition === 'RT' ||
    player.footballPosition === 'TE');

  return averageRatings(blockers.map((player) =>
    calculateWeightedRating(player.ratings, { AWR: 0.12, PBK: 0.4, RBK: 0.38, STR: 0.1 })));
}

function calculatePassRushRating(players: readonly RosterPlayer[]): number {
  const rushers = players.filter((player) =>
    player.footballPosition === 'DL' ||
    player.footballPosition === 'OLB');

  return averageRatings(rushers.map((player) =>
    calculateWeightedRating(player.ratings, { BSH: 0.28, FMV: 0.2, PMV: 0.22, PUR: 0.12, STR: 0.18 })));
}

function calculateCoverageRating(players: readonly RosterPlayer[]): number {
  const coveragePlayers = players.filter((player) =>
    player.footballPosition === 'CB' ||
    player.footballPosition === 'FS' ||
    player.footballPosition === 'ILB' ||
    player.footballPosition === 'OLB' ||
    player.footballPosition === 'SS');

  return averageRatings(coveragePlayers.map((player) =>
    calculateWeightedRating(player.ratings, { MCV: 0.28, PRC: 0.22, SPD: 0.12, ZCV: 0.3, TAK: 0.08 })));
}

function resolvePlayers(roster: TeamRoster, ids: readonly string[]): RosterPlayer[] {
  return ids
    .map((id) => getRosterPlayer(roster, id))
    .filter(isRosterPlayer);
}

function averageRatings(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return clampTeamRating(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clampTeamRating(value: number): number {
  return Math.max(0, Math.min(99, Math.round(value)));
}

function isRosterPlayer(player: RosterPlayer | null): player is RosterPlayer {
  return player !== null;
}
