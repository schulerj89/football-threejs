import type { FootballSpot } from '../fieldScale';
import {
  getTeamProfileOrDefault,
} from '../teams/TeamRegistry';
import type { TeamProfile } from '../teams/TeamProfile';
import {
  cloneKickoffState,
  createKickoffState,
} from '../specialTeams/KickoffSimulation';
import type {
  KickoffResult,
  KickoffState,
} from '../specialTeams/KickoffTypes';
import {
  createMatchClock,
  resetMatchClock,
  snapshotMatchClock,
  startMatchClock,
  stopMatchClock,
  updateMatchClock,
  type MatchClock,
} from './GameClock';
import {
  cloneCoinTossState,
  createCoinTossState,
  enterOpeningCoinToss,
  resolveOpeningCoinToss,
  type CoinFace,
  type CoinTossState,
} from './CoinTossModel';
import {
  otherPossession,
  resolveOpeningPossession,
  resolveSecondHalfPossession,
} from './PossessionModel';
import type {
  DriveSummary,
  MatchModel,
  MatchPhase,
  MatchPossession,
  MatchRules,
  MatchSnapshot,
} from './MatchTypes';
import { DEFAULT_MATCH_RULES } from './MatchTypes';

export interface CreateMatchModelOptions {
  opponentTeamId: string;
  rules?: Partial<MatchRules>;
  userTeamId: string;
}

export interface MutableMatchModel extends Omit<MatchModel, 'clock' | 'driveSummaries'> {
  clock: MatchClock;
  driveSummaries: DriveSummary[];
  rules: MatchRules;
}

export function createMatchModel({
  opponentTeamId,
  rules = {},
  userTeamId,
}: CreateMatchModelOptions): MutableMatchModel {
  const resolvedRules: MatchRules = {
    ...DEFAULT_MATCH_RULES,
    ...rules,
    touchbackSpot: { ...(rules.touchbackSpot ?? DEFAULT_MATCH_RULES.touchbackSpot) },
  };
  const openingPossession = resolveOpeningPossession(resolvedRules.seed);

  return {
    clock: createMatchClock(resolvedRules.quarterDurationSeconds),
    coinToss: createCoinTossState(),
    currentFieldPosition: { ...resolvedRules.touchbackSpot },
    deterministicSeed: resolvedRules.seed,
    driveNumber: 1,
    driveSummaries: [],
    gameOverReason: null,
    kickoff: createKickoffState(),
    openingPossession,
    opponentScore: 0,
    opponentTeam: getTeamProfileOrDefault(opponentTeamId),
    phase: 'pregame',
    possession: openingPossession,
    previousDriveSummary: null,
    quarter: 1,
    rules: resolvedRules,
    secondHalfPossession: resolveSecondHalfPossession(openingPossession),
    userScore: 0,
    userTeam: getTeamProfileOrDefault(userTeamId),
  };
}

export function enterCoinToss(match: MutableMatchModel): CoinTossState {
  match.phase = 'coinToss';
  match.coinToss = enterOpeningCoinToss(match.coinToss);
  stopMatchClock(match.clock);
  return cloneCoinTossState(match.coinToss);
}

export function resolveMatchCoinToss(
  match: MutableMatchModel,
  userCall: CoinFace,
): CoinTossState {
  match.coinToss = resolveOpeningCoinToss(
    match.coinToss,
    match.deterministicSeed,
    userCall,
  );

  if (
    match.coinToss.completed &&
    match.coinToss.firstHalfOpeningPossession &&
    match.coinToss.secondHalfOpeningPossession
  ) {
    match.openingPossession = match.coinToss.firstHalfOpeningPossession;
    match.secondHalfPossession = match.coinToss.secondHalfOpeningPossession;
    match.possession = match.openingPossession;
  }

  return cloneCoinTossState(match.coinToss);
}

export function beginMatch(match: MutableMatchModel): void {
  match.phase = match.openingPossession === 'user'
    ? 'userPossession'
    : 'opponentDriveSimulation';
  match.possession = match.openingPossession;
  match.currentFieldPosition = { ...match.rules.touchbackSpot };
  stopMatchClock(match.clock);
}

export function resetMatchModel(match: MutableMatchModel): void {
  const reset = createMatchModel({
    opponentTeamId: match.opponentTeam.id,
    rules: match.rules,
    userTeamId: match.userTeam.id,
  });

  match.clock = reset.clock;
  match.coinToss = reset.coinToss;
  match.currentFieldPosition = reset.currentFieldPosition;
  match.deterministicSeed = reset.deterministicSeed;
  match.driveNumber = reset.driveNumber;
  match.driveSummaries = reset.driveSummaries;
  match.gameOverReason = reset.gameOverReason;
  match.kickoff = reset.kickoff;
  match.openingPossession = reset.openingPossession;
  match.opponentScore = reset.opponentScore;
  match.phase = reset.phase;
  match.possession = reset.possession;
  match.previousDriveSummary = reset.previousDriveSummary;
  match.quarter = reset.quarter;
  match.secondHalfPossession = reset.secondHalfPossession;
  match.userScore = reset.userScore;
}

export function tickMatchClock(match: MutableMatchModel, deltaSeconds: number): boolean {
  return updateMatchClock(match.clock, deltaSeconds);
}

export function startUserPlayClock(match: MutableMatchModel): void {
  if (match.phase === 'userPossession') {
    startMatchClock(match.clock);
  }
}

export function stopUserPlayClock(match: MutableMatchModel): void {
  stopMatchClock(match.clock);
}

export function addDriveSummary(match: MutableMatchModel, summary: DriveSummary): void {
  match.previousDriveSummary = summary;
  match.driveSummaries.push(summary);
  for (const event of summary.scoringEvents) {
    if (event.team === 'user') {
      match.userScore += event.points;
    } else {
      match.opponentScore += event.points;
    }
  }
  match.driveNumber += 1;
  match.currentFieldPosition = { ...summary.endingFieldPosition };
}

export function enterKickoff(
  match: MutableMatchModel,
  kickoff: KickoffState,
): KickoffState {
  stopMatchClock(match.clock);
  match.kickoff = cloneKickoffState(kickoff);
  match.phase = 'kickoff';
  if (kickoff.receivingTeam) {
    match.possession = kickoff.receivingTeam;
  }
  return cloneKickoffState(match.kickoff);
}

export function completeKickoff(match: MutableMatchModel): KickoffResult | null {
  const result = match.kickoff.result;
  if (!result) {
    return null;
  }

  match.kickoff = {
    ...cloneKickoffState(match.kickoff),
    completed: true,
    phase: 'completed',
  };
  match.currentFieldPosition = { ...result.receivingStartSpot };
  return { ...result, receivingStartSpot: { ...result.receivingStartSpot } };
}

export function advanceToNextQuarter(match: MutableMatchModel): void {
  if (match.quarter >= 4) {
    enterGameOver(match);
    return;
  }

  match.quarter += 1;
  resetMatchClock(match.clock, match.rules.quarterDurationSeconds);
  const nextPossession = match.quarter === 3
    ? match.secondHalfPossession
    : otherPossession(match.possession);
  match.possession = nextPossession;
  match.phase = nextPossession === 'user' ? 'userPossession' : 'opponentDriveSimulation';
  match.currentFieldPosition = { ...match.rules.touchbackSpot };
}

export function enterQuarterTransition(match: MutableMatchModel): void {
  stopMatchClock(match.clock);
  if (match.quarter >= 4) {
    enterGameOver(match);
  } else if (match.quarter === 2) {
    match.phase = 'halftime';
  } else {
    match.phase = 'quarterBreak';
  }
}

export function enterOpponentPossession(
  match: MutableMatchModel,
  startingFieldPosition: FootballSpot = match.rules.touchbackSpot,
): void {
  if (match.clock.remainingSeconds <= 0) {
    enterQuarterTransition(match);
    return;
  }

  stopMatchClock(match.clock);
  match.possession = 'opponent';
  match.phase = 'opponentDriveSimulation';
  match.currentFieldPosition = { ...startingFieldPosition };
}

export function enterUserPossession(
  match: MutableMatchModel,
  startingFieldPosition: FootballSpot = match.rules.touchbackSpot,
): void {
  if (match.clock.remainingSeconds <= 0) {
    enterQuarterTransition(match);
    return;
  }

  stopMatchClock(match.clock);
  match.possession = 'user';
  match.phase = 'userPossession';
  match.currentFieldPosition = { ...startingFieldPosition };
}

export function enterGameOver(match: MutableMatchModel): void {
  stopMatchClock(match.clock);
  match.clock.remainingSeconds = 0;
  match.gameOverReason = 'clockExpired';
  match.phase = 'gameOver';
}

export function snapshotMatchModel(match: MutableMatchModel): MatchSnapshot {
  return {
    clock: snapshotMatchClock(match.clock),
    coinToss: cloneCoinTossState(match.coinToss),
    currentFieldPosition: { ...match.currentFieldPosition },
    deterministicSeed: match.deterministicSeed,
    driveNumber: match.driveNumber,
    driveSummaries: match.driveSummaries.map((summary) => ({
      ...summary,
      endingFieldPosition: { ...summary.endingFieldPosition },
      scoringEvents: summary.scoringEvents.map((event) => ({ ...event })),
      startingFieldPosition: { ...summary.startingFieldPosition },
    })),
    gameOverReason: match.gameOverReason,
    kickoff: cloneKickoffState(match.kickoff),
    openingPossession: match.openingPossession,
    opponentScore: match.opponentScore,
    opponentTeam: { ...match.opponentTeam },
    phase: match.phase,
    possession: match.possession,
    previousDriveSummary: match.previousDriveSummary
      ? {
          ...match.previousDriveSummary,
          endingFieldPosition: { ...match.previousDriveSummary.endingFieldPosition },
          scoringEvents: match.previousDriveSummary.scoringEvents.map((event) => ({ ...event })),
          startingFieldPosition: { ...match.previousDriveSummary.startingFieldPosition },
        }
      : null,
    quarter: match.quarter,
    secondHalfPossession: match.secondHalfPossession,
    userScore: match.userScore,
    userTeam: { ...match.userTeam },
    canContinue: canContinue(match.phase),
    canPunt: match.phase === 'userPossession',
    canRematch: match.phase === 'gameOver',
    winner: resolveWinner(match),
  };
}

function canContinue(phase: MatchPhase): boolean {
  return phase === 'opponentDriveSimulation' || phase === 'quarterBreak' || phase === 'halftime';
}

function resolveWinner(match: MutableMatchModel): MatchPossession | 'tie' | null {
  if (match.phase !== 'gameOver') {
    return null;
  }

  if (match.userScore === match.opponentScore) {
    return 'tie';
  }

  return match.userScore > match.opponentScore ? 'user' : 'opponent';
}
