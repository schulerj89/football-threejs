import type { GameplayModel, GameplaySnapshot, PlayResult } from '../playState';
import { resetOffensePossession } from '../playState';
import type { FootballSpot } from '../fieldScale';
import { calculateYardsGained } from '../fieldScale';
import {
  createDriveSummary,
} from './DriveSummary';
import {
  addDriveSummary,
  advanceToNextQuarter,
  beginMatch,
  completeKickoff,
  createMatchModel,
  enterCoinToss,
  enterGameOver,
  enterKickoff,
  enterOpponentPossession,
  enterQuarterTransition,
  enterUserPossession,
  resetMatchModel,
  resolveMatchCoinToss,
  snapshotMatchModel,
  startUserPlayClock,
  stopUserPlayClock,
  tickMatchClock,
  type MutableMatchModel,
} from './MatchModel';
import {
  simulateOpponentDrive,
} from './OpponentDriveSimulator';
import type {
  DriveSummary,
  DriveSummaryResult,
  MatchDifficulty,
  MatchPossession,
  MatchRules,
  MatchSnapshot,
} from './MatchTypes';
import { DEFAULT_MATCH_RULES } from './MatchTypes';
import type { CoinFace, CoinTossState } from './CoinTossModel';
import { otherPossession } from './PossessionModel';
import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import { getKickerRatings } from '../specialTeams/KickerRatings';
import {
  createKickoffSimulationInput,
  simulateKickoff,
} from '../specialTeams/KickoffSimulation';
import type { KickoffReason, KickoffResult } from '../specialTeams/KickoffTypes';

export interface MatchFlowControllerOptions {
  difficulty?: MatchDifficulty;
  opponentTeamId: string;
  quarterDurationSeconds?: number;
  seed?: number;
  userTeamId: string;
}

export class MatchFlowController {
  readonly model: MutableMatchModel;
  private readonly opponentRatings;
  private lastProcessedPlayResultId: number | null = null;
  private lastOpponentSimulationDriveNumber: number | null = null;
  private previousPlayState: GameplaySnapshot['playState'] | null = null;

  constructor(options: MatchFlowControllerOptions) {
    const rules: Partial<MatchRules> = {
      difficulty: options.difficulty ?? DEFAULT_MATCH_RULES.difficulty,
      quarterDurationSeconds:
        options.quarterDurationSeconds ?? DEFAULT_MATCH_RULES.quarterDurationSeconds,
      seed: options.seed ?? DEFAULT_MATCH_RULES.seed,
    };
    this.model = createMatchModel({
      opponentTeamId: options.opponentTeamId,
      rules,
      userTeamId: options.userTeamId,
    });
    this.opponentRatings = createAggregateRatings(options.opponentTeamId, options.userTeamId);
  }

  start(gameplay: GameplayModel): void {
    resetMatchModel(this.model);
    beginMatch(this.model);
    this.lastProcessedPlayResultId = null;
    this.lastOpponentSimulationDriveNumber = null;
    this.previousPlayState = null;
    resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
    if (this.model.phase === 'opponentDriveSimulation') {
      this.simulateOpponentPossessionOnce();
    }
  }

  prepareForPregame(gameplay: GameplayModel): void {
    resetMatchModel(this.model);
    this.lastProcessedPlayResultId = null;
    this.lastOpponentSimulationDriveNumber = null;
    this.previousPlayState = null;
    resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
  }

  enterCoinToss(): CoinTossState {
    return enterCoinToss(this.model);
  }

  resolveOpeningCoinToss(userCall: CoinFace): CoinTossState {
    return resolveMatchCoinToss(this.model, userCall);
  }

  beginAfterCoinToss(gameplay: GameplayModel): void {
    if (!this.model.coinToss.completed) {
      return;
    }

    beginMatch(this.model);
    this.lastProcessedPlayResultId = null;
    this.lastOpponentSimulationDriveNumber = null;
    this.previousPlayState = null;
    resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
    if (this.model.phase === 'opponentDriveSimulation') {
      this.simulateOpponentPossessionOnce();
    }
  }

  beginOpeningKickoffAfterCoinToss(gameplay: GameplayModel): boolean {
    if (!this.model.coinToss.completed) {
      return false;
    }

    this.lastProcessedPlayResultId = null;
    this.lastOpponentSimulationDriveNumber = null;
    this.previousPlayState = null;
    resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
    return this.scheduleKickoff('opening', this.model.openingPossession);
  }

  completeKickoff(gameplay: GameplayModel): KickoffResult | null {
    const receivingTeam = this.model.kickoff.receivingTeam;
    const result = completeKickoff(this.model);
    if (!result || !receivingTeam) {
      return null;
    }

    this.lastProcessedPlayResultId = null;
    this.previousPlayState = null;
    if (receivingTeam === 'user') {
      enterUserPossession(this.model, result.receivingStartSpot);
      resetOffensePossession(gameplay, result.receivingStartSpot);
    } else {
      enterOpponentPossession(this.model, result.receivingStartSpot);
      resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
      this.simulateOpponentPossessionOnce();
    }

    return result;
  }

  update(deltaSeconds: number, gameplay: GameplayModel, snapshot: GameplaySnapshot): void {
    if (this.model.phase !== 'userPossession') {
      this.previousPlayState = snapshot.playState;
      return;
    }

    if (snapshot.playState === 'live') {
      startUserPlayClock(this.model);
    }

    if (this.model.clock.running) {
      tickMatchClock(this.model, deltaSeconds);
    }

    const result = snapshot.lastPlayResult;
    if (result && result.id !== this.lastProcessedPlayResultId) {
      this.lastProcessedPlayResultId = result.id;
      this.handleUserPlayResult(result, snapshot);
    }

    if (
      this.model.phase === 'userPossession' &&
      this.model.clock.remainingSeconds <= 0 &&
      snapshot.playState !== 'live'
    ) {
      this.endUserDriveForClock(snapshot);
    }

    this.previousPlayState = snapshot.playState;
  }

  canStartPlay(snapshot: GameplaySnapshot): boolean {
    return (
      this.model.phase === 'userPossession' &&
      this.model.clock.remainingSeconds > 0 &&
      snapshot.playState === 'preSnap'
    );
  }

  punt(gameplay: GameplayModel, snapshot: GameplaySnapshot): boolean {
    if (!this.canPunt(snapshot)) {
      return false;
    }

    const puntDistance = this.model.rules.puntDistanceYards;
    const endingSpot = {
      x: snapshot.drive.lineOfScrimmage.x,
      z: Math.min(50, snapshot.drive.lineOfScrimmage.z + puntDistance),
    };
    const summary = createDriveSummary({
      description: `The offense punts it away for ${puntDistance} yards.`,
      driveNumber: this.model.driveNumber,
      elapsedSeconds: 18,
      endingFieldPosition: endingSpot,
      plays: 0,
      possession: 'user',
      quarter: this.model.quarter,
      result: 'punt',
      startedAtSeconds: this.model.clock.remainingSeconds,
      startingFieldPosition: snapshot.drive.lineOfScrimmage,
      yards: calculateYardsGained(snapshot.drive.lineOfScrimmage, endingSpot),
    });
    addDriveSummary(this.model, summary);
    stopUserPlayClock(this.model);
    enterOpponentPossession(this.model);
    this.simulateOpponentPossessionOnce();
    resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
    return true;
  }

  canPunt(snapshot: GameplaySnapshot): boolean {
    return this.model.phase === 'userPossession' && snapshot.playState === 'preSnap';
  }

  continue(gameplay: GameplayModel): void {
    if (this.model.phase === 'opponentDriveSimulation') {
      if (this.model.clock.remainingSeconds <= 0) {
        enterQuarterTransition(this.model);
        return;
      }
      if (this.shouldKickAfterOpponentDrive()) {
        this.scheduleKickoff('postScore', 'user');
        return;
      }
      enterUserPossession(this.model, this.model.rules.touchbackSpot);
      resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
      return;
    }

    if (this.model.phase === 'quarterBreak' || this.model.phase === 'halftime') {
      const wasHalftime = this.model.phase === 'halftime';
      advanceToNextQuarter(this.model);
      if (wasHalftime && this.model.quarter === 3) {
        this.scheduleKickoff('secondHalf', this.model.possession);
        return;
      }
      const nextPhase = this.model.phase as string;
      if (nextPhase === 'userPossession') {
        resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
      } else if (nextPhase === 'opponentDriveSimulation') {
        this.simulateOpponentPossessionOnce();
      }
    }
  }

  rematch(gameplay: GameplayModel): void {
    this.start(gameplay);
  }

  getSnapshot(): MatchSnapshot {
    return snapshotMatchModel(this.model);
  }

  private handleUserPlayResult(result: PlayResult, snapshot: GameplaySnapshot): void {
    if (result.type === 'touchdown') {
      const summary = createDriveSummary({
        description: 'The offense finishes the drive with a touchdown and the automatic extra point.',
        driveNumber: this.model.driveNumber,
        elapsedSeconds: 0,
        endingFieldPosition: result.endingBallSpot,
        plays: 1,
        possession: 'user',
        quarter: this.model.quarter,
        result: 'touchdown',
        scoringEvents: [
          { points: 6, team: 'user', type: 'touchdown' },
          { points: 1, team: 'user', type: 'extraPoint' },
        ],
        startedAtSeconds: this.model.clock.remainingSeconds,
        startingFieldPosition: result.startingBallSpot,
        yards: result.yardsGained,
      });
      addDriveSummary(this.model, summary);
      stopUserPlayClock(this.model);
      this.scheduleKickoff('postScore', 'opponent');
      return;
    }

    if (snapshot.drive.lastDriveResult?.type === 'turnoverOnDowns') {
      const summary = createDriveSummary({
        description: 'The offense comes up short on fourth down.',
        driveNumber: this.model.driveNumber,
        elapsedSeconds: 0,
        endingFieldPosition: result.endingBallSpot,
        plays: 1,
        possession: 'user',
        quarter: this.model.quarter,
        result: 'turnoverOnDowns',
        startedAtSeconds: this.model.clock.remainingSeconds,
        startingFieldPosition: result.startingBallSpot,
        yards: result.yardsGained,
      });
      addDriveSummary(this.model, summary);
      stopUserPlayClock(this.model);
      enterOpponentPossession(this.model);
      this.simulateOpponentPossessionOnce();
      return;
    }

    if (result.type === 'incomplete' || result.type === 'outOfBounds') {
      stopUserPlayClock(this.model);
    }
  }

  private endUserDriveForClock(snapshot: GameplaySnapshot): void {
    const finalPhase = this.model.quarter >= 4 ? 'endOfGame' : 'endOfHalf';
    const summary = createDriveSummary({
      description: this.model.quarter >= 4
        ? 'The clock expires before another snap.'
        : 'The half ends before another snap.',
      driveNumber: this.model.driveNumber,
      elapsedSeconds: 0,
      endingFieldPosition: snapshot.drive.lineOfScrimmage,
      plays: 0,
      possession: 'user',
      quarter: this.model.quarter,
      result: finalPhase,
      startedAtSeconds: 0,
      startingFieldPosition: snapshot.drive.lineOfScrimmage,
      yards: 0,
    });
    addDriveSummary(this.model, summary);
    if (this.model.quarter >= 4) {
      enterGameOver(this.model);
    } else {
      enterQuarterTransition(this.model);
    }
  }

  private simulateOpponentPossessionOnce(): DriveSummary | null {
    if (
      this.model.phase !== 'opponentDriveSimulation' ||
      this.lastOpponentSimulationDriveNumber === this.model.driveNumber
    ) {
      return null;
    }

    this.lastOpponentSimulationDriveNumber = this.model.driveNumber;
    const summary = simulateOpponentDrive({
      difficulty: this.model.rules.difficulty,
      driveNumber: this.model.driveNumber,
      opponentOffensiveRating: this.opponentRatings.opponentOffense,
      quarter: this.model.quarter,
      remainingSeconds: this.model.clock.remainingSeconds,
      seed: this.model.deterministicSeed,
      startingFieldPosition: this.model.currentFieldPosition,
      userDefensiveRating: this.opponentRatings.userDefense,
    });
    addDriveSummary(this.model, summary);
    this.model.clock.remainingSeconds = Math.max(
      0,
      this.model.clock.remainingSeconds - summary.elapsedSeconds,
    );
    if (this.model.clock.remainingSeconds <= 0 && this.model.quarter >= 4) {
      enterGameOver(this.model);
    }
    return summary;
  }

  private scheduleKickoff(reason: KickoffReason, receivingTeam: MatchPossession): boolean {
    if (this.model.clock.remainingSeconds <= 0 && reason !== 'opening') {
      enterQuarterTransition(this.model);
      return false;
    }

    const kickingTeam = otherPossession(receivingTeam);
    const roster = getTeamRosterOrDefault(
      kickingTeam === 'user'
        ? this.model.userTeam.id
        : this.model.opponentTeam.id,
    );
    const kicker = roster.players.find((player) => player.id === roster.kickerId) ?? null;
    const ratings = getKickerRatings(kicker);
    const sequenceIndex = Math.max(-1, this.model.kickoff.sequenceIndex) + 1;
    const simulationInput = createKickoffSimulationInput({
      kickAccuracy: ratings.kickAccuracy,
      kickerRosterId: roster.kickerId,
      kickPower: ratings.kickPower,
      kickingTeam,
      matchSeed: this.model.deterministicSeed,
      rules: this.model.rules,
      sequenceIndex,
    });

    enterKickoff(this.model, {
      completed: false,
      direction: simulationInput.direction,
      kickerRatings: ratings,
      kickerRosterId: roster.kickerId,
      kickingTeam,
      phase: 'ready',
      reason,
      receivingTeam,
      result: simulateKickoff(simulationInput),
      sequenceIndex,
    });
    return true;
  }

  private shouldKickAfterOpponentDrive(): boolean {
    const summary = this.model.previousDriveSummary;
    return Boolean(
      summary &&
      summary.possession === 'opponent' &&
      isScoringDriveResult(summary.result),
    );
  }
}

function createAggregateRatings(opponentTeamId: string, userTeamId: string): {
  opponentOffense: number;
  userDefense: number;
} {
  return {
    opponentOffense: 70 + stableRatingOffset(opponentTeamId),
    userDefense: 70 + stableRatingOffset(userTeamId),
  };
}

function stableRatingOffset(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return (hash % 17) - 8;
}

function isScoringDriveResult(result: DriveSummaryResult): boolean {
  return result === 'fieldGoal' || result === 'touchdown';
}
