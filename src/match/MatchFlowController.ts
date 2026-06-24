import type { GameplayModel, GameplaySnapshot, PlayResult } from '../playState';
import { resetOffensePossession } from '../playState';
import {
  createDriveSummary,
} from './DriveSummary';
import {
  addDriveSummary,
  advanceToNextQuarter,
  beginMatch,
  cloneDynastyStoryContext,
  completeExtraPoint,
  completeKickoff,
  createMatchModel,
  enterPreparedExtraPoint,
  enterCoinToss,
  enterGameOver,
  enterKickoff,
  enterOpponentPossession,
  enterQuarterTransition,
  enterUserPossession,
  prepareExtraPoint,
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
import {
  calculatePossessionYardsGained,
  changePossessionFieldPosition,
  createFreeKickTouchbackPosition,
  offenseSpotToPossessionFieldPosition,
  possessionFieldPositionToOffenseSpot,
  worldSpotToPossessionFieldPosition,
  type PossessionFieldPosition,
} from './FieldPositionModel';
import type { FootballSpot } from '../fieldScale';
import {
  simulateAbstractPunt,
  type SimulatedPuntResult,
} from './AbstractPuntSimulation';
import type {
  DynastyMatchStoryContext,
  DriveSummary,
  DriveSummaryResult,
  MatchDifficulty,
  MatchPossession,
  PossessionTransition,
  MatchRules,
  MatchSnapshot,
} from './MatchTypes';
import { DEFAULT_MATCH_RULES } from './MatchTypes';
import type { CoinFace, CoinTossState } from './CoinTossModel';
import { otherPossession } from './PossessionModel';
import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import {
  createGameplayRosterBinding,
  getLineupBindingForGameplayId,
  type GameplayRosterBinding,
} from '../roster/GameplayRosterBinding';
import { DEFAULT_TEAM_PROFILE_SETTINGS } from '../teams/TeamProfileStore';
import { getKickerRatings } from '../specialTeams/KickerRatings';
import { createSpecialTeamsDepthChart } from '../specialTeams/SpecialTeamsDepthChart';
import {
  createExtraPointPlaceKickState,
  createPlaceKickSimulationInput,
  simulatePlaceKick,
} from '../specialTeams/PlaceKickSimulation';
import type {
  PlaceKickResult,
  PlaceKickTimingInput,
} from '../specialTeams/PlaceKickTypes';
import {
  createKickoffSimulationInput,
  simulateKickoff,
} from '../specialTeams/KickoffSimulation';
import type { KickoffReason, KickoffResult } from '../specialTeams/KickoffTypes';
import type { KickoffReturnOutcome } from '../specialTeams/KickoffReturnSimulation';
import { applyGameStatsEvent } from '../stats/GameStatsReducer';
import { createOpponentDriveStats } from '../stats/OpponentDriveStatsAdapter';
import type { GameStatsPlayEndedEvent } from '../stats/GameStatsEvent';

export interface MatchFlowControllerOptions {
  difficulty?: MatchDifficulty;
  dynastyStoryContext?: DynastyMatchStoryContext | null;
  opponentTeamId: string;
  quarterDurationSeconds?: number;
  rosterBinding?: GameplayRosterBinding;
  seed?: number;
  userTeamId: string;
}

interface UserPlayStatsContext {
  ballCarrierRosterId: string | null;
  downBefore: number;
  passerRosterId: string | null;
  passReleaseRecorded: boolean;
  playEventKey: string;
  playKind: GameplaySnapshot['selectedPlay']['kind'];
  targetRosterId: string | null;
  yardsToFirstDownBefore: number;
}

export class MatchFlowController {
  readonly model: MutableMatchModel;
  private readonly opponentRatings;
  private lastProcessedPlayResultId: number | null = null;
  private lastOpponentSimulationDriveNumber: number | null = null;
  private previousPlayState: GameplaySnapshot['playState'] | null = null;
  private possessionClockEventIndex = 0;
  private rosterBinding: GameplayRosterBinding;
  private userPlaySequence = 0;
  private userPlayStatsContext: UserPlayStatsContext | null = null;

  constructor(options: MatchFlowControllerOptions) {
    const rules: Partial<MatchRules> = {
      difficulty: options.difficulty ?? DEFAULT_MATCH_RULES.difficulty,
      quarterDurationSeconds:
        options.quarterDurationSeconds ?? DEFAULT_MATCH_RULES.quarterDurationSeconds,
      seed: options.seed ?? DEFAULT_MATCH_RULES.seed,
    };
    this.model = createMatchModel({
      dynastyStoryContext: options.dynastyStoryContext ?? null,
      opponentTeamId: options.opponentTeamId,
      rules,
      userTeamId: options.userTeamId,
    });
    this.opponentRatings = createAggregateRatings(options.opponentTeamId, options.userTeamId);
    this.rosterBinding = options.rosterBinding ?? createGameplayRosterBinding('11v11', {
      ...DEFAULT_TEAM_PROFILE_SETTINGS,
      opponentTeamId: options.opponentTeamId,
      userTeamId: options.userTeamId,
    });
  }

  start(gameplay: GameplayModel): void {
    resetMatchModel(this.model);
    beginMatch(this.model);
    this.resetRuntimeEventState();
    this.resetGameplayForFreeKickTouchback(gameplay);
    if (this.model.phase === 'opponentDriveSimulation') {
      this.simulateOpponentPossessionOnce();
    }
  }

  prepareForPregame(gameplay: GameplayModel): void {
    resetMatchModel(this.model);
    this.resetRuntimeEventState();
    this.resetGameplayForFreeKickTouchback(gameplay);
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
    this.resetRuntimeEventState();
    this.resetGameplayForFreeKickTouchback(gameplay);
    if (this.model.phase === 'opponentDriveSimulation') {
      this.simulateOpponentPossessionOnce();
    }
  }

  beginOpeningKickoffAfterCoinToss(gameplay: GameplayModel): boolean {
    if (!this.model.coinToss.completed) {
      return false;
    }
    if (this.model.phase !== 'coinToss') {
      return false;
    }

    this.resetRuntimeEventState();
    this.resetGameplayForFreeKickTouchback(gameplay);
    return this.scheduleKickoff('opening', this.model.openingPossession);
  }

  setRosterBinding(binding: GameplayRosterBinding): void {
    this.rosterBinding = binding;
  }

  setDynastyStoryContext(context: DynastyMatchStoryContext | null): void {
    this.model.dynastyStoryContext = cloneDynastyStoryContext(context);
  }

  recordPassRelease(_gameplay: GameplayModel, snapshotBeforeRelease: GameplaySnapshot): void {
    if (this.model.phase !== 'userPossession') {
      return;
    }

    const context = this.userPlayStatsContext ?? this.createUserPlayStatsContext(snapshotBeforeRelease);
    if (context.passReleaseRecorded) {
      return;
    }

    const targetRosterId = this.resolveGameplayRosterId(snapshotBeforeRelease.selectedReceiver?.id ?? null);
    context.targetRosterId = targetRosterId;
    context.passReleaseRecorded = true;
    this.userPlayStatsContext = context;
    applyGameStatsEvent(this.model.stats, {
      id: `${context.playEventKey}:passReleased`,
      offense: 'user',
      passerRosterId: context.passerRosterId,
      targetRosterId,
      type: 'passReleased',
    });
  }

  recordPlayStarted(_gameplay: GameplayModel, snapshotBeforeStart: GameplaySnapshot): void {
    if (this.model.phase !== 'userPossession') {
      return;
    }
    this.userPlayStatsContext = this.createUserPlayStatsContext(snapshotBeforeStart);
  }

  updateKickoffClock(deltaSeconds: number, clockRunning: boolean): void {
    if (this.model.phase !== 'kickoff' || !clockRunning) {
      return;
    }

    tickMatchClock(this.model, deltaSeconds);
  }

  completeKickoff(
    gameplay: GameplayModel,
    returnOutcome: KickoffReturnOutcome | null = null,
  ): KickoffResult | null {
    const receivingTeam = this.model.kickoff.receivingTeam;
    const kickingTeam = this.model.kickoff.kickingTeam;
    const kickerRosterId = this.model.kickoff.kickerRosterId;
    const result = completeKickoff(this.model, returnOutcome);
    if (!result || !receivingTeam) {
      return null;
    }

    if (kickingTeam) {
      this.recordKickoffResultStats(result, {
        kickerRosterId,
        kickingTeam,
        receivingTeam,
        returnOutcome,
      });
    }
    this.lastProcessedPlayResultId = null;
    this.previousPlayState = null;
    if (returnOutcome?.type === 'touchdown') {
      this.completeKickoffReturnTouchdown(gameplay, returnOutcome);
      return result;
    }

    if (receivingTeam === 'user') {
      enterUserPossession(this.model, result.receivingStartPosition);
      this.resetGameplayForMatchPosition(gameplay, result.receivingStartPosition);
    } else {
      enterOpponentPossession(this.model, result.receivingStartPosition);
      this.resetGameplayForFreeKickTouchback(gameplay);
      this.simulateOpponentPossessionOnce();
    }

    return result;
  }

  resolveExtraPointKick(timingInput: PlaceKickTimingInput): PlaceKickResult | null {
    if (this.model.phase !== 'extraPoint' || this.model.extraPoint.result) {
      return null;
    }

    const extraPoint = this.model.extraPoint;
    if (!extraPoint.kickerRosterId || !extraPoint.kickerRatings) {
      return null;
    }

    const result = simulatePlaceKick(createPlaceKickSimulationInput({
      difficulty: this.model.rules.difficulty,
      direction: extraPoint.direction,
      kickerRatings: extraPoint.kickerRatings,
      kickerRosterId: extraPoint.kickerRosterId,
      matchSeed: this.model.deterministicSeed,
      sequenceIndex: extraPoint.sequenceIndex,
      timingInput,
    }));
    this.model.extraPoint = {
      ...extraPoint,
      phase: 'snap',
      result,
    };
    return { ...result, timingInput: { ...result.timingInput } };
  }

  completeExtraPointAndScheduleKickoff(gameplay: GameplayModel): DriveSummary | null {
    if (this.model.phase !== 'extraPoint' || !this.model.extraPoint.result) {
      return null;
    }

    const kickingTeam = this.model.extraPoint.kickingTeam;
    const summary = completeExtraPoint(this.model, this.model.extraPoint.result);
    if (!summary || !kickingTeam) {
      return null;
    }

    applyGameStatsEvent(this.model.stats, {
      distanceYards: 33,
      good: this.model.extraPoint.result.good,
      id: `placeKick:${summary.id}:pat`,
      kickerRosterId: this.model.extraPoint.kickerRosterId,
      kind: 'pat',
      team: kickingTeam,
      type: 'placeKickResult',
    });
    this.lastProcessedPlayResultId = null;
    this.previousPlayState = null;
    this.resetGameplayForFreeKickTouchback(gameplay);
    this.scheduleKickoff('postScore', otherPossession(kickingTeam));
    return summary;
  }

  update(deltaSeconds: number, gameplay: GameplayModel, snapshot: GameplaySnapshot): void {
    if (this.model.phase !== 'userPossession') {
      this.previousPlayState = snapshot.playState;
      return;
    }

    if (
      snapshot.playState === 'live' &&
      this.previousPlayState !== 'live' &&
      !this.userPlayStatsContext
    ) {
      this.userPlayStatsContext = this.createUserPlayStatsContext(snapshot);
    }

    if (snapshot.playState === 'live') {
      startUserPlayClock(this.model);
    }

    if (this.model.clock.running) {
      const before = this.model.clock.remainingSeconds;
      tickMatchClock(this.model, deltaSeconds);
      const elapsed = Math.max(0, before - this.model.clock.remainingSeconds);
      if (elapsed > 0) {
        this.possessionClockEventIndex += 1;
        applyGameStatsEvent(this.model.stats, {
          id: `possessionTime:user:${this.model.driveNumber}:${this.possessionClockEventIndex}`,
          seconds: elapsed,
          team: 'user',
          type: 'possessionTime',
        });
      }
    }

    const result = snapshot.lastPlayResult;
    if (result && result.id !== this.lastProcessedPlayResultId) {
      this.lastProcessedPlayResultId = result.id;
      this.handleUserPlayResult(gameplay, result, snapshot);
    }

    if (
      this.model.phase === 'userPossession' &&
      this.model.pendingScoringDriveSummary === null &&
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
      this.model.pendingScoringDriveSummary === null &&
      this.model.clock.remainingSeconds > 0 &&
      snapshot.playState === 'preSnap'
    );
  }

  hasPendingExtraPoint(): boolean {
    return Boolean(
      this.model.phase === 'userPossession' &&
      this.model.pendingScoringDriveSummary &&
      this.model.extraPoint.reason === 'extraPoint',
    );
  }

  beginPreparedExtraPoint(): boolean {
    return enterPreparedExtraPoint(this.model) !== null;
  }

  punt(gameplay: GameplayModel, snapshot: GameplaySnapshot): boolean {
    void gameplay;
    if (!this.canPunt(snapshot)) {
      return false;
    }

    const startingFieldPosition = offenseSpotToPossessionFieldPosition(snapshot.drive.lineOfScrimmage);
    const punt = simulateAbstractPunt({
      driveNumber: this.model.driveNumber,
      kickOrigin: startingFieldPosition,
      matchSeed: this.model.deterministicSeed,
      punterRatings: this.getKickerRatingsForPossession('user'),
    });
    const possessionTransition = this.createPossessionTransition({
      fromTeam: 'user',
      nextOffenseStartingPosition: punt.receivingStartPosition,
      previousOffenseEndingPosition: punt.kickOrigin,
      reason: getPuntTransitionReason(punt),
      toTeam: 'opponent',
    });
    const puntDistance = Math.round(
      punt.physicalLandingPosition.yardsFromOwnGoalLine - punt.kickOrigin.yardsFromOwnGoalLine,
    );
    const summary = createDriveSummary({
      description: createUserPuntDescription(puntDistance, punt),
      driveNumber: this.model.driveNumber,
      elapsedSeconds: 18,
      endingFieldPosition: punt.kickOrigin,
      plays: 0,
      possessionTransition,
      possession: 'user',
      quarter: this.model.quarter,
      result: 'punt',
      startedAtSeconds: this.model.clock.remainingSeconds,
      startingFieldPosition,
      yards: puntDistance,
    });
    applyGameStatsEvent(this.model.stats, {
      id: `punt:user:${summary.id}`,
      puntYards: puntDistance,
      punterRosterId: this.getSpecialistRosterId('user', 'punter'),
      team: 'user',
      type: 'punt',
    });
    addDriveSummary(this.model, summary);
    stopUserPlayClock(this.model);
    enterOpponentPossession(this.model, punt.receivingStartPosition);
    this.simulateOpponentPossessionOnce();
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
      const transition = this.model.previousDriveSummary?.possessionTransition ?? null;
      if (!transition) {
        return;
      }
      enterUserPossession(this.model, transition.nextOffenseStartingPosition);
      this.resetGameplayForMatchPosition(gameplay, transition.nextOffenseStartingPosition);
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
        this.resetGameplayForMatchPosition(gameplay, this.model.currentFieldPosition);
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

  private getFreeKickTouchbackPosition(): PossessionFieldPosition {
    return createFreeKickTouchbackPosition(this.model.rules.touchbackRules);
  }

  private resetGameplayForMatchPosition(
    gameplay: GameplayModel,
    position: PossessionFieldPosition,
  ): void {
    resetOffensePossession(gameplay, possessionFieldPositionToOffenseSpot(position));
  }

  private resetGameplayForFreeKickTouchback(gameplay: GameplayModel): void {
    this.resetGameplayForMatchPosition(gameplay, this.getFreeKickTouchbackPosition());
  }

  private createPossessionTransition(
    transition: PossessionTransition,
  ): PossessionTransition {
    return {
      ...transition,
      nextOffenseStartingPosition: {
        ...transition.nextOffenseStartingPosition,
      },
      previousOffenseEndingPosition: {
        ...transition.previousOffenseEndingPosition,
      },
    };
  }

  private handleUserPlayResult(
    gameplay: GameplayModel,
    result: PlayResult,
    snapshot: GameplaySnapshot,
  ): void {
    this.recordUserPlayResultStats(result, snapshot);

    if (result.type === 'touchdown') {
      const startingFieldPosition = offenseSpotToPossessionFieldPosition(result.startingBallSpot);
      const endingFieldPosition = offenseSpotToPossessionFieldPosition(result.endingBallSpot);
      const summary = createDriveSummary({
        description: 'The offense finishes the drive with a touchdown.',
        driveNumber: this.model.driveNumber,
        elapsedSeconds: 0,
        endingFieldPosition,
        plays: 1,
        possession: 'user',
        quarter: this.model.quarter,
        result: 'touchdown',
        scoringEvents: [
          { points: 6, team: 'user', type: 'touchdown' },
        ],
        startedAtSeconds: this.model.clock.remainingSeconds,
        startingFieldPosition,
        yards: result.yardsGained,
      });
      stopUserPlayClock(this.model);
      prepareExtraPoint(this.model, this.createExtraPointState('user'), summary);
      return;
    }

    if (result.type === 'safety') {
      const startingFieldPosition = offenseSpotToPossessionFieldPosition(result.startingBallSpot);
      const endingFieldPosition = offenseSpotToPossessionFieldPosition(result.endingBallSpot);
      const summary = createDriveSummary({
        description: 'The ball carrier is tackled in his own end zone for a safety.',
        driveNumber: this.model.driveNumber,
        elapsedSeconds: 0,
        endingFieldPosition,
        plays: 1,
        possession: 'user',
        quarter: this.model.quarter,
        result: 'safety',
        scoringEvents: [
          { points: 2, team: 'opponent', type: 'safety' },
        ],
        startedAtSeconds: this.model.clock.remainingSeconds,
        startingFieldPosition,
        yards: result.yardsGained,
      });
      addDriveSummary(this.model, summary);
      stopUserPlayClock(this.model);
      this.resetGameplayForFreeKickTouchback(gameplay);
      this.scheduleKickoff('postSafety', 'opponent');
      return;
    }

    if (snapshot.drive.lastDriveResult?.type === 'turnoverOnDowns') {
      const startingFieldPosition = offenseSpotToPossessionFieldPosition(result.startingBallSpot);
      const endingFieldPosition = offenseSpotToPossessionFieldPosition(result.endingBallSpot);
      const possessionTransition = this.createPossessionTransition({
        fromTeam: 'user',
        nextOffenseStartingPosition: changePossessionFieldPosition(endingFieldPosition),
        previousOffenseEndingPosition: endingFieldPosition,
        reason: 'turnoverOnDowns',
        toTeam: 'opponent',
      });
      const summary = createDriveSummary({
        description: 'The offense comes up short on fourth down.',
        driveNumber: this.model.driveNumber,
        elapsedSeconds: 0,
        endingFieldPosition,
        plays: 1,
        possessionTransition,
        possession: 'user',
        quarter: this.model.quarter,
        result: 'turnoverOnDowns',
        startedAtSeconds: this.model.clock.remainingSeconds,
        startingFieldPosition,
        yards: result.yardsGained,
      });
      addDriveSummary(this.model, summary);
      stopUserPlayClock(this.model);
      enterOpponentPossession(this.model, possessionTransition.nextOffenseStartingPosition);
      this.simulateOpponentPossessionOnce();
      return;
    }

    if (result.type === 'incomplete' || result.type === 'outOfBounds') {
      stopUserPlayClock(this.model);
    }
  }

  private endUserDriveForClock(snapshot: GameplaySnapshot): void {
    const finalPhase = resolveClockExpiredDriveResult(this.model.quarter);
    const finalFieldPosition = offenseSpotToPossessionFieldPosition(snapshot.drive.lineOfScrimmage);
    this.model.currentFieldPosition = {
      ...finalFieldPosition,
    };
    if (finalPhase === 'endOfQuarter') {
      enterQuarterTransition(this.model);
      return;
    }

    const summary = createDriveSummary({
      description: createClockExpiredDriveDescription(finalPhase),
      driveNumber: this.model.driveNumber,
      elapsedSeconds: 0,
      endingFieldPosition: finalFieldPosition,
      plays: 0,
      possession: 'user',
      quarter: this.model.quarter,
      result: finalPhase,
      startedAtSeconds: 0,
      startingFieldPosition: finalFieldPosition,
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
      opponentKickerRatings: this.getKickerRatingsForPossession('opponent'),
      quarter: this.model.quarter,
      remainingSeconds: this.model.clock.remainingSeconds,
      seed: this.model.deterministicSeed,
      startingFieldPosition: this.model.currentFieldPosition,
      userDefensiveRating: this.opponentRatings.userDefense,
    });
    applyGameStatsEvent(this.model.stats, {
      id: `opponentDrive:${summary.id}`,
      stats: createOpponentDriveStats({
        opponentRoster: this.rosterBinding.opponentRoster,
        seed: this.model.deterministicSeed,
        summary,
        userRoster: this.rosterBinding.userRoster,
      }),
      team: 'opponent',
      type: 'opponentDrive',
    });
    addDriveSummary(this.model, summary);
    if (summary.result === 'endOfQuarter') {
      this.model.currentFieldPosition = {
        ...summary.endingFieldPosition,
      };
    }
    this.model.clock.remainingSeconds = Math.max(
      0,
      this.model.clock.remainingSeconds - summary.elapsedSeconds,
    );
    if (this.model.clock.remainingSeconds <= 0 && this.model.quarter >= 4) {
      enterGameOver(this.model);
    }
    return summary;
  }

  private getKickerRatingsForPossession(team: MatchPossession) {
    const roster = getTeamRosterOrDefault(
      team === 'user'
        ? this.model.userTeam.id
        : this.model.opponentTeam.id,
    );
    const kicker = roster.players.find((player) => player.id === roster.kickerId) ?? null;
    return getKickerRatings(kicker);
  }

  private createExtraPointState(kickingTeam: MatchPossession) {
    const roster = getTeamRosterOrDefault(
      kickingTeam === 'user'
        ? this.model.userTeam.id
        : this.model.opponentTeam.id,
    );
    const chart = createSpecialTeamsDepthChart(roster);
    const kicker = roster.players.find((player) => player.id === chart.placeKick.kickerId) ?? null;
    const ratings = getKickerRatings(kicker);
    const sequenceIndex = Math.max(-1, this.model.extraPoint.sequenceIndex) + 1;

    return createExtraPointPlaceKickState({
      defendingTeam: otherPossession(kickingTeam),
      holderRosterId: chart.placeKick.holderId,
      kickerRatings: ratings,
      kickerRosterId: chart.placeKick.kickerId,
      kickingTeam,
      sequenceIndex,
    });
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
      placement: reason === 'postSafety' ? 'safetyFreeKick' : 'kickoff',
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
      returnResult: null,
      sequenceIndex,
    });
    return true;
  }

  private completeKickoffReturnTouchdown(
    gameplay: GameplayModel,
    outcome: KickoffReturnOutcome,
  ): void {
    const scoringTeam = outcome.receivingTeam;
    const description = scoringTeam === 'user'
      ? 'The return team takes the opening kick all the way back for a touchdown.'
      : 'The opponent takes the kickoff all the way back for a touchdown.';
    const endingFieldPosition = worldSpotToPossessionFieldPosition(outcome.deadBallSpot, scoringTeam);
    const startingFieldPosition = this.model.kickoff.result
      ? worldSpotToPossessionFieldPosition(this.model.kickoff.result.origin, scoringTeam)
      : this.model.currentFieldPosition;
    const summary = createDriveSummary({
      description,
      driveNumber: this.model.driveNumber,
      elapsedSeconds: outcome.clockElapsedSeconds,
      endingFieldPosition,
      plays: 0,
      possession: scoringTeam,
      quarter: this.model.quarter,
      result: 'touchdown',
      scoringEvents: [
        { points: 6, team: scoringTeam, type: 'touchdown' },
      ],
      startedAtSeconds: this.model.clock.remainingSeconds + outcome.clockElapsedSeconds,
      startingFieldPosition,
      yards: calculatePossessionYardsGained(startingFieldPosition, endingFieldPosition),
    });

    this.resetGameplayForFreeKickTouchback(gameplay);
    if (scoringTeam === 'user') {
      enterUserPossession(this.model, endingFieldPosition);
      prepareExtraPoint(this.model, this.createExtraPointState('user'), summary);
      return;
    }

    prepareExtraPoint(this.model, this.createExtraPointState('opponent'), summary);
    const extraPoint = this.model.extraPoint;
    if (extraPoint.kickerRosterId && extraPoint.kickerRatings) {
      const result = simulatePlaceKick(createPlaceKickSimulationInput({
        difficulty: this.model.rules.difficulty,
        direction: extraPoint.direction,
        kickerRatings: extraPoint.kickerRatings,
        kickerRosterId: extraPoint.kickerRosterId,
        matchSeed: this.model.deterministicSeed,
        sequenceIndex: extraPoint.sequenceIndex,
        timingInput: {
          confirmedAtSeconds: 0,
          normalizedValue: 0,
        },
      }));
      completeExtraPoint(this.model, result);
      applyGameStatsEvent(this.model.stats, {
        distanceYards: 33,
        good: result.good,
        id: `placeKick:${summary.id}:opponentAutomaticPat`,
        kickerRosterId: extraPoint.kickerRosterId,
        kind: 'pat',
        team: 'opponent',
        type: 'placeKickResult',
      });
    }
    this.scheduleKickoff('postScore', 'user');
  }

  private resetRuntimeEventState(): void {
    this.lastProcessedPlayResultId = null;
    this.lastOpponentSimulationDriveNumber = null;
    this.possessionClockEventIndex = 0;
    this.previousPlayState = null;
    this.userPlaySequence = 0;
    this.userPlayStatsContext = null;
  }

  private createUserPlayStatsContext(snapshot: GameplaySnapshot): UserPlayStatsContext {
    this.userPlaySequence += 1;
    const passerRosterId = this.resolveGameplayRosterId('offense-qb');
    return {
      ballCarrierRosterId: this.resolveGameplayRosterId(snapshot.player.id),
      downBefore: snapshot.drive.currentDown,
      passerRosterId,
      passReleaseRecorded: false,
      playEventKey: `userPlay:${this.model.driveNumber}:${this.userPlaySequence}`,
      playKind: snapshot.selectedPlay.kind,
      targetRosterId: this.resolveGameplayRosterId(snapshot.selectedReceiver?.id ?? null),
      yardsToFirstDownBefore: snapshot.drive.yardsToFirstDown,
    };
  }

  private recordUserPlayResultStats(result: PlayResult, snapshot: GameplaySnapshot): void {
    const context = this.userPlayStatsContext ?? this.createUserPlayStatsContext(snapshot);
    const yardsGained = Math.round(result.yardsGained);
    const passAttempted = context.passReleaseRecorded || snapshot.passAttempted;
    const passCompleted = Boolean(
      passAttempted &&
        result.type !== 'incomplete' &&
        result.type !== 'sack' &&
        snapshot.player.team === 'offense' &&
        snapshot.player.id !== 'offense-qb',
    );
    const carrierRosterId = this.resolveGameplayRosterId(snapshot.player.id) ??
      context.ballCarrierRosterId;
    const receiverRosterId = passCompleted ? carrierRosterId : null;
    const firstDown = result.type === 'touchdown' ||
      yardsGained >= Math.ceil(context.yardsToFirstDownBefore - 0.0001);
    const event: GameStatsPlayEndedEvent = {
      carrierRosterId: passAttempted ? null : carrierRosterId,
      defense: 'opponent',
      downBefore: context.downBefore,
      firstDown,
      id: `${context.playEventKey}:result:${result.id}`,
      offense: 'user',
      passAttemptAlreadyRecorded: context.passReleaseRecorded,
      passAttempted,
      passCompleted,
      passerRosterId: context.passerRosterId,
      playKind: context.playKind,
      receiverRosterId,
      resultType: result.type,
      sackerRosterId: result.type === 'sack'
        ? this.findNearestDefenderRosterId(snapshot, result.endingBallSpot)
        : null,
      tacklerRosterId: result.type === 'tackle'
        ? this.findNearestDefenderRosterId(snapshot, result.endingBallSpot)
        : null,
      targetRosterId: context.targetRosterId ??
        this.resolveGameplayRosterId(snapshot.passAudit?.selectedReceiverId ?? null),
      touchdown: result.type === 'touchdown',
      type: 'playEnded',
      yardsGained,
      yardsToFirstDownBefore: context.yardsToFirstDownBefore,
    };
    applyGameStatsEvent(this.model.stats, event);
    this.userPlayStatsContext = null;
  }

  private recordKickoffResultStats(
    result: KickoffResult,
    context: {
      kickerRosterId: string | null;
      kickingTeam: MatchPossession;
      receivingTeam: MatchPossession;
      returnOutcome: KickoffReturnOutcome | null;
    },
  ): void {
    const returnYards = context.returnOutcome && context.returnOutcome.type !== 'touchback'
      ? this.calculateKickoffReturnYards(result, context.returnOutcome)
      : 0;
    applyGameStatsEvent(this.model.stats, {
      id: `kickoff:${this.model.kickoff.sequenceIndex}:${context.receivingTeam}:${context.returnOutcome?.type ?? result.landingType}`,
      kickerRosterId: context.kickerRosterId,
      kickingTeam: context.kickingTeam,
      receivingTeam: context.receivingTeam,
      returnTouchdown: context.returnOutcome?.type === 'touchdown',
      returnYards,
      returnerRosterId: context.returnOutcome?.type === 'touchback'
        ? null
        : context.returnOutcome?.carrierRosterId ?? null,
      touchback: context.returnOutcome?.type === 'touchback' || (!context.returnOutcome && result.landingType === 'touchback'),
      type: 'kickoffResult',
    });
  }

  private calculateKickoffReturnYards(
    result: KickoffResult,
    outcome: KickoffReturnOutcome,
  ): number {
    const catchPosition = worldSpotToPossessionFieldPosition(result.target, outcome.receivingTeam);
    return Math.max(
      0,
      Math.round(calculatePossessionYardsGained(catchPosition, outcome.receivingStartPosition)),
    );
  }

  private resolveGameplayRosterId(gameplayPlayerId: string | null): string | null {
    if (!gameplayPlayerId) {
      return null;
    }
    return getLineupBindingForGameplayId(this.rosterBinding, gameplayPlayerId)?.rosterPlayerId ?? null;
  }

  private findNearestDefenderRosterId(
    snapshot: GameplaySnapshot,
    spot: FootballSpot,
  ): string | null {
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const player of snapshot.players) {
      if (player.team !== 'defense') {
        continue;
      }
      const dx = player.position.x - spot.x;
      const dz = player.position.z - spot.z;
      const distance = dx * dx + dz * dz;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = player.id;
      }
    }
    return this.resolveGameplayRosterId(nearestId);
  }

  private getSpecialistRosterId(
    team: MatchPossession,
    specialist: 'kicker' | 'punter',
  ): string | null {
    const roster = team === 'user' ? this.rosterBinding.userRoster : this.rosterBinding.opponentRoster;
    return specialist === 'kicker' ? roster.kickerId : roster.punterId;
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
  return result === 'fieldGoal' || result === 'safety' || result === 'touchdown';
}

function resolveClockExpiredDriveResult(quarter: number): DriveSummaryResult {
  if (quarter >= 4) {
    return 'endOfGame';
  }
  if (quarter === 2) {
    return 'endOfHalf';
  }
  return 'endOfQuarter';
}

function createClockExpiredDriveDescription(result: DriveSummaryResult): string {
  switch (result) {
    case 'endOfGame':
      return 'The clock expires before another snap.';
    case 'endOfHalf':
      return 'The half ends before another snap.';
    case 'endOfQuarter':
    default:
      return 'The quarter ends before another snap.';
  }
}

function getPuntTransitionReason(punt: SimulatedPuntResult): PossessionTransition['reason'] {
  if (punt.result === 'touchback') {
    return 'puntTouchback';
  }
  return punt.result === 'downed' ? 'puntDowned' : 'puntReturn';
}

function createUserPuntDescription(
  puntDistance: number,
  punt: SimulatedPuntResult,
): string {
  if (punt.result === 'touchback') {
    return `The offense punts it ${puntDistance} yards into the end zone for a touchback.`;
  }
  if (punt.result === 'return') {
    return `The offense punts it ${puntDistance} yards and the opponent returns it ${punt.returnYards} yards.`;
  }
  return `The offense punts it ${puntDistance} yards and the coverage team downs it.`;
}
