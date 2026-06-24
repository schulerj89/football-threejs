import {
  getTeamProfileOrDefault,
} from '../teams/TeamRegistry';
import type { TeamProfile } from '../teams/TeamProfile';
import {
  cloneKickoffState,
  createKickoffState,
} from '../specialTeams/KickoffSimulation';
import {
  clonePlaceKickState,
  createPlaceKickState,
} from '../specialTeams/PlaceKickSimulation';
import type {
  KickoffResult,
  KickoffState,
} from '../specialTeams/KickoffTypes';
import type { KickoffReturnOutcome } from '../specialTeams/KickoffReturnSimulation';
import type {
  PlaceKickResult,
  PlaceKickState,
} from '../specialTeams/PlaceKickTypes';
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
  resolveOpeningPossession,
  resolveSecondHalfPossession,
} from './PossessionModel';
import type {
  DynastyMatchStoryContext,
  DriveSummary,
  MatchModel,
  MatchPhase,
  MatchPossession,
  MatchRules,
  MatchSnapshot,
} from './MatchTypes';
import { DEFAULT_MATCH_RULES } from './MatchTypes';
import {
  createGameStatsModel,
  resetGameStatsModel,
} from '../stats/GameStatsModel';
import { getGameStatsSnapshot } from '../stats/GameStatsSnapshot';
import type { GameStatsState } from '../stats/GameStatsTypes';
import { clonePossessionTransition } from './DriveSummary';
import {
  clonePossessionFieldPosition,
  createFreeKickTouchbackPosition,
  type PossessionFieldPosition,
} from './FieldPositionModel';

export interface CreateMatchModelOptions {
  dynastyStoryContext?: DynastyMatchStoryContext | null;
  opponentTeamId: string;
  rules?: Partial<MatchRules>;
  userTeamId: string;
}

export interface MutableMatchModel extends Omit<MatchModel, 'clock' | 'driveSummaries' | 'stats'> {
  clock: MatchClock;
  driveSummaries: DriveSummary[];
  rules: MatchRules;
  stats: GameStatsState;
}

export function createMatchModel({
  dynastyStoryContext = null,
  opponentTeamId,
  rules = {},
  userTeamId,
}: CreateMatchModelOptions): MutableMatchModel {
  const resolvedRules: MatchRules = {
    ...DEFAULT_MATCH_RULES,
    ...rules,
    touchbackRules: {
      ...DEFAULT_MATCH_RULES.touchbackRules,
      ...(rules.touchbackRules ?? {}),
    },
  };
  const initialFieldPosition = createFreeKickTouchbackPosition(resolvedRules.touchbackRules);
  const openingPossession = resolveOpeningPossession(resolvedRules.seed);

  return {
    clock: createMatchClock(resolvedRules.quarterDurationSeconds),
    coinToss: createCoinTossState(),
    currentFieldPosition: clonePossessionFieldPosition(initialFieldPosition),
    deterministicSeed: resolvedRules.seed,
    driveNumber: 1,
    driveSummaries: [],
    dynastyStoryContext: cloneDynastyStoryContext(dynastyStoryContext),
    extraPoint: createPlaceKickState(),
    gameOverReason: null,
    kickoff: createKickoffState(),
    openingPossession,
    opponentScore: 0,
    opponentTeam: getTeamProfileOrDefault(opponentTeamId),
    pendingScoringDriveSummary: null,
    phase: 'pregame',
    possession: openingPossession,
    previousDriveSummary: null,
    quarter: 1,
    rules: resolvedRules,
    secondHalfPossession: resolveSecondHalfPossession(openingPossession),
    stats: createGameStatsModel(),
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
  match.currentFieldPosition = createFreeKickTouchbackPosition(match.rules.touchbackRules);
  stopMatchClock(match.clock);
}

export function resetMatchModel(match: MutableMatchModel): void {
  const dynastyStoryContext = match.dynastyStoryContext;
  const reset = createMatchModel({
    dynastyStoryContext,
    opponentTeamId: match.opponentTeam.id,
    rules: match.rules,
    userTeamId: match.userTeam.id,
  });

  match.clock = reset.clock;
  match.coinToss = reset.coinToss;
  match.currentFieldPosition = clonePossessionFieldPosition(reset.currentFieldPosition);
  match.deterministicSeed = reset.deterministicSeed;
  match.driveNumber = reset.driveNumber;
  match.driveSummaries = reset.driveSummaries;
  match.dynastyStoryContext = reset.dynastyStoryContext;
  match.extraPoint = reset.extraPoint;
  match.gameOverReason = reset.gameOverReason;
  match.kickoff = reset.kickoff;
  match.openingPossession = reset.openingPossession;
  match.opponentScore = reset.opponentScore;
  match.pendingScoringDriveSummary = reset.pendingScoringDriveSummary;
  match.phase = reset.phase;
  match.possession = reset.possession;
  match.previousDriveSummary = reset.previousDriveSummary;
  match.quarter = reset.quarter;
  match.secondHalfPossession = reset.secondHalfPossession;
  resetGameStatsModel(match.stats);
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
}

export function prepareExtraPoint(
  match: MutableMatchModel,
  extraPoint: PlaceKickState,
  pendingScoringDriveSummary: DriveSummary,
): PlaceKickState {
  stopMatchClock(match.clock);
  match.extraPoint = clonePlaceKickState({
    ...extraPoint,
    phase: 'formation',
  });
  match.pendingScoringDriveSummary = cloneDriveSummary(pendingScoringDriveSummary);
  if (extraPoint.kickingTeam) {
    match.possession = extraPoint.kickingTeam;
  }

  for (const event of pendingScoringDriveSummary.scoringEvents) {
    if (event.type !== 'touchdown') {
      continue;
    }
    if (event.team === 'user') {
      match.userScore += event.points;
    } else {
      match.opponentScore += event.points;
    }
  }

  return clonePlaceKickState(match.extraPoint);
}

export function enterPreparedExtraPoint(match: MutableMatchModel): PlaceKickState | null {
  if (
    match.phase !== 'userPossession' ||
    !match.pendingScoringDriveSummary ||
    !match.extraPoint.kickingTeam
  ) {
    return null;
  }

  const kickingTeam = match.extraPoint.kickingTeam;
  stopMatchClock(match.clock);
  match.phase = 'extraPoint';
  match.extraPoint = clonePlaceKickState({
    ...match.extraPoint,
    phase: 'meter',
  });
  match.possession = kickingTeam;
  return clonePlaceKickState(match.extraPoint);
}

export function completeExtraPoint(
  match: MutableMatchModel,
  result: PlaceKickResult,
): DriveSummary | null {
  const pending = match.pendingScoringDriveSummary;
  if (!pending || !match.extraPoint.kickingTeam) {
    return null;
  }
  const kickingTeam = match.extraPoint.kickingTeam;

  match.extraPoint = {
    ...clonePlaceKickState(match.extraPoint),
    completed: true,
    phase: 'completed',
    result: clonePlaceKickResult(result),
  };
  const extraPointEvents = result.good
    ? [{ points: 1, team: kickingTeam, type: 'extraPoint' as const }]
    : [];
  const scoringEvents = [
    ...pending.scoringEvents.map((event) => ({ ...event })),
    ...extraPointEvents,
  ];
  const summary: DriveSummary = {
    ...cloneDriveSummary(pending),
    description: result.good
      ? 'The offense finishes the drive with a touchdown and converts the extra point.'
      : 'The offense finishes the drive with a touchdown but misses the extra point.',
    points: scoringEvents.reduce((total, event) => total + event.points, 0),
    scoringEvents,
  };

  if (result.good) {
    if (kickingTeam === 'user') {
      match.userScore += 1;
    } else {
      match.opponentScore += 1;
    }
  }

  match.previousDriveSummary = summary;
  match.driveSummaries.push(summary);
  match.driveNumber += 1;
  match.pendingScoringDriveSummary = null;
  return cloneDriveSummary(summary);
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

export function completeKickoff(
  match: MutableMatchModel,
  returnResult: KickoffReturnOutcome | null = null,
): KickoffResult | null {
  const result = match.kickoff.result;
  if (!result) {
    return null;
  }
  const receivingStartPosition =
    returnResult?.receivingStartPosition ?? result.receivingStartPosition;

  match.kickoff = {
    ...cloneKickoffState(match.kickoff),
    completed: true,
    phase: 'completed',
    returnResult: returnResult ? {
      ...returnResult,
      deadBallSpot: { ...returnResult.deadBallSpot },
      receivingStartPosition: clonePossessionFieldPosition(returnResult.receivingStartPosition),
    } : null,
  };
  match.currentFieldPosition = clonePossessionFieldPosition(receivingStartPosition);
  return {
    ...result,
    receivingStartPosition: clonePossessionFieldPosition(receivingStartPosition),
  };
}

export function advanceToNextQuarter(match: MutableMatchModel): void {
  if (match.quarter >= 4) {
    enterGameOver(match);
    return;
  }

  match.quarter += 1;
  resetMatchClock(match.clock, match.rules.quarterDurationSeconds);

  if (match.quarter !== 3) {
    match.phase = match.possession === 'user' ? 'userPossession' : 'opponentDriveSimulation';
    return;
  }

  const nextPossession = match.secondHalfPossession;
  match.possession = nextPossession;
  match.phase = nextPossession === 'user' ? 'userPossession' : 'opponentDriveSimulation';
  match.currentFieldPosition = createFreeKickTouchbackPosition(match.rules.touchbackRules);
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
  startingFieldPosition: PossessionFieldPosition =
    createFreeKickTouchbackPosition(match.rules.touchbackRules),
): void {
  if (match.clock.remainingSeconds <= 0) {
    enterQuarterTransition(match);
    return;
  }

  stopMatchClock(match.clock);
  match.possession = 'opponent';
  match.phase = 'opponentDriveSimulation';
  match.currentFieldPosition = clonePossessionFieldPosition(startingFieldPosition);
}

export function enterUserPossession(
  match: MutableMatchModel,
  startingFieldPosition: PossessionFieldPosition =
    createFreeKickTouchbackPosition(match.rules.touchbackRules),
): void {
  if (match.clock.remainingSeconds <= 0) {
    enterQuarterTransition(match);
    return;
  }

  stopMatchClock(match.clock);
  match.possession = 'user';
  match.phase = 'userPossession';
  match.currentFieldPosition = clonePossessionFieldPosition(startingFieldPosition);
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
    currentFieldPosition: clonePossessionFieldPosition(match.currentFieldPosition),
    deterministicSeed: match.deterministicSeed,
    driveNumber: match.driveNumber,
    driveSummaries: match.driveSummaries.map((summary) => ({
      ...summary,
      endingFieldPosition: clonePossessionFieldPosition(summary.endingFieldPosition),
      possessionTransition: summary.possessionTransition
        ? clonePossessionTransition(summary.possessionTransition)
        : null,
      scoringEvents: summary.scoringEvents.map((event) => ({ ...event })),
      startingFieldPosition: clonePossessionFieldPosition(summary.startingFieldPosition),
    })),
    dynastyStoryContext: cloneDynastyStoryContext(match.dynastyStoryContext),
    extraPoint: clonePlaceKickState(match.extraPoint),
    gameOverReason: match.gameOverReason,
    kickoff: cloneKickoffState(match.kickoff),
    openingPossession: match.openingPossession,
    opponentScore: match.opponentScore,
    opponentTeam: { ...match.opponentTeam },
    pendingScoringDriveSummary: match.pendingScoringDriveSummary
      ? cloneDriveSummary(match.pendingScoringDriveSummary)
      : null,
    phase: match.phase,
    possession: match.possession,
    previousDriveSummary: match.previousDriveSummary
      ? {
          ...match.previousDriveSummary,
          endingFieldPosition: clonePossessionFieldPosition(match.previousDriveSummary.endingFieldPosition),
          possessionTransition: match.previousDriveSummary.possessionTransition
            ? clonePossessionTransition(match.previousDriveSummary.possessionTransition)
            : null,
          scoringEvents: match.previousDriveSummary.scoringEvents.map((event) => ({ ...event })),
          startingFieldPosition: clonePossessionFieldPosition(match.previousDriveSummary.startingFieldPosition),
        }
      : null,
    quarter: match.quarter,
    secondHalfPossession: match.secondHalfPossession,
    stats: getGameStatsSnapshot(match.stats),
    userScore: match.userScore,
    userTeam: { ...match.userTeam },
    canContinue: canContinue(match.phase),
    canPunt: match.phase === 'userPossession',
    canRematch: match.phase === 'gameOver',
    winner: resolveWinner(match),
  };
}

export function cloneDynastyStoryContext(
  context: DynastyMatchStoryContext | null,
): DynastyMatchStoryContext | null {
  return context ? { ...context } : null;
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

function cloneDriveSummary(summary: DriveSummary): DriveSummary {
  return {
    ...summary,
    endingFieldPosition: clonePossessionFieldPosition(summary.endingFieldPosition),
    possessionTransition: summary.possessionTransition
      ? clonePossessionTransition(summary.possessionTransition)
      : null,
    scoringEvents: summary.scoringEvents.map((event) => ({ ...event })),
    startingFieldPosition: clonePossessionFieldPosition(summary.startingFieldPosition),
  };
}

function clonePlaceKickResult(result: PlaceKickResult): PlaceKickResult {
  return {
    ...result,
    goalPlanePosition: { ...result.goalPlanePosition },
    origin: { ...result.origin },
    target: { ...result.target },
    timingInput: { ...result.timingInput },
  };
}
