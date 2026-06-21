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
  createMatchModel,
  enterGameOver,
  enterOpponentPossession,
  enterQuarterTransition,
  enterUserPossession,
  resetMatchModel,
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
  MatchDifficulty,
  MatchRules,
  MatchSnapshot,
} from './MatchTypes';
import { DEFAULT_MATCH_RULES } from './MatchTypes';

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
      enterUserPossession(this.model, this.model.rules.touchbackSpot);
      resetOffensePossession(gameplay, this.model.rules.touchbackSpot);
      return;
    }

    if (this.model.phase === 'quarterBreak' || this.model.phase === 'halftime') {
      advanceToNextQuarter(this.model);
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
      enterOpponentPossession(this.model);
      this.simulateOpponentPossessionOnce();
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
