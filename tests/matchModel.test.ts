import { describe, expect, it } from 'vitest';
import {
  createGameplayModel,
  resetOffensePossession,
  resetPlay,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
} from '../src/playState';
import {
  addDriveSummary,
  advanceToNextQuarter,
  beginMatch,
  createMatchModel,
  snapshotMatchModel,
} from '../src/match/MatchModel';
import { MatchFlowController } from '../src/match/MatchFlowController';
import { createDriveSummary } from '../src/match/DriveSummary';
import { simulateOpponentDrive } from '../src/match/OpponentDriveSimulator';
import type { DriveSummary, DriveSummaryResult } from '../src/match/MatchTypes';
import {
  createOpponentYardLinePosition,
  createOwnYardLinePosition,
  possessionFieldPositionToOffenseSpot,
} from '../src/match/FieldPositionModel';
import { PLAYABLE_FIELD_BOUNDS } from '../src/fieldSpec';
import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
} from '../src/teams/TeamRegistry';

describe('offense-only exhibition match model', () => {
  it('begins in pregame and opens deterministically from the match seed', () => {
    const userOpening = createMatchModel({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      rules: { seed: 20260620 },
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const opponentOpening = createMatchModel({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      rules: { seed: 20260621 },
      userTeamId: DEFAULT_USER_TEAM_ID,
    });

    expect(snapshotMatchModel(userOpening)).toMatchObject({
      phase: 'pregame',
      openingPossession: 'user',
      secondHalfPossession: 'opponent',
    });
    expect(snapshotMatchModel(opponentOpening)).toMatchObject({
      phase: 'pregame',
      openingPossession: 'opponent',
      secondHalfPossession: 'user',
    });

    beginMatch(userOpening);
    beginMatch(opponentOpening);

    expect(userOpening.phase).toBe('userPossession');
    expect(opponentOpening.phase).toBe('opponentDriveSimulation');
  });

  it('progresses through four quarters with the correct halftime possession', () => {
    const match = createMatchModel({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      rules: { seed: 20260620 },
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    beginMatch(match);
    match.currentFieldPosition = createOwnYardLinePosition(37);

    advanceToNextQuarter(match);
    expect(match.quarter).toBe(2);
    expect(match.phase).toBe('userPossession');
    expect(match.possession).toBe('user');
    expect(match.currentFieldPosition).toEqual(createOwnYardLinePosition(37));

    advanceToNextQuarter(match);
    expect(match.quarter).toBe(3);
    expect(match.phase).toBe('opponentDriveSimulation');
    expect(match.possession).toBe('opponent');

    match.currentFieldPosition = createOwnYardLinePosition(44);
    advanceToNextQuarter(match);
    expect(match.quarter).toBe(4);
    expect(match.phase).toBe('opponentDriveSimulation');
    expect(match.possession).toBe('opponent');
    expect(match.currentFieldPosition).toEqual(createOwnYardLinePosition(44));

    advanceToNextQuarter(match);
    expect(match.phase).toBe('gameOver');
    expect(match.clock.remainingSeconds).toBe(0);
  });

  it('records Q1 clock expiry as a quarter break without changing possession or field position', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({
      quarterDurationSeconds: 30,
      seed: 20260620,
    });
    const startingPosition = createOwnYardLinePosition(37);

    controller.start(gameplay);
    resetOffensePossession(gameplay, possessionFieldPositionToOffenseSpot(startingPosition));

    expect(startPlay(gameplay)).toBe(true);
    controller.update(31, gameplay, snapshotGameplayModel(gameplay));
    resetPlay(gameplay);
    controller.update(0, gameplay, snapshotGameplayModel(gameplay));

    const breakSnapshot = controller.getSnapshot();
    expect(breakSnapshot.quarter).toBe(1);
    expect(breakSnapshot.phase).toBe('quarterBreak');
    expect(breakSnapshot.driveNumber).toBe(1);
    expect(breakSnapshot.driveSummaries).toHaveLength(0);
    expect(breakSnapshot.previousDriveSummary).toBeNull();
    expect(breakSnapshot.possession).toBe('user');
    expect(breakSnapshot.currentFieldPosition).toEqual(startingPosition);

    controller.continue(gameplay);
    const secondQuarterSnapshot = controller.getSnapshot();
    expect(secondQuarterSnapshot.quarter).toBe(2);
    expect(secondQuarterSnapshot.phase).toBe('userPossession');
    expect(secondQuarterSnapshot.driveNumber).toBe(1);
    expect(secondQuarterSnapshot.possession).toBe('user');
    expect(secondQuarterSnapshot.currentFieldPosition).toEqual(startingPosition);
    expect(snapshotGameplayModel(gameplay).drive.lineOfScrimmage).toEqual(
      possessionFieldPositionToOffenseSpot(startingPosition),
    );
  });

  it('simulates opponent drives deterministically from the same input', () => {
    const input = {
      difficulty: 'pro' as const,
      driveNumber: 4,
      opponentOffensiveRating: 73,
      quarter: 2,
      remainingSeconds: 94,
      seed: 991,
      startingFieldPosition: createOwnYardLinePosition(25),
      userDefensiveRating: 69,
    };

    expect(simulateOpponentDrive(input)).toEqual(simulateOpponentDrive(input));
  });

  it('records simulated Q1 opponent clock expiry as end of quarter instead of halftime', () => {
    const summary = simulateOpponentDrive({
      difficulty: 'pro',
      driveNumber: 3,
      opponentOffensiveRating: 73,
      quarter: 1,
      remainingSeconds: 1,
      seed: 991,
      startingFieldPosition: createOwnYardLinePosition(25),
      userDefensiveRating: 69,
    });

    expect(summary.result).toBe('endOfQuarter');
    expect(summary.description).toContain('quarter ends');
    expect(summary.possessionTransition).toBeNull();
    expect(summary.scoringEvents).toEqual([]);
  });

  it('applies opponent scoring events and elapsed clock time once', () => {
    const seed = findSeedForOpponentResult('fieldGoal');
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({ seed });

    controller.start(gameplay);
    const first = controller.getSnapshot();
    const scoreAfterFirstRead = first.opponentScore;
    const remainingAfterFirstRead = first.clock.remainingSeconds;

    expect(first.phase).toBe('opponentDriveSimulation');
    expect(first.previousDriveSummary?.result).toBe('fieldGoal');
    expect(scoreAfterFirstRead).toBe(3);
    expect(remainingAfterFirstRead).toBeLessThan(180);

    controller.update(1, gameplay, snapshotGameplayModel(gameplay));
    const second = controller.getSnapshot();

    expect(second.opponentScore).toBe(scoreAfterFirstRead);
    expect(second.clock.remainingSeconds).toBe(remainingAfterFirstRead);
    expect(second.driveSummaries).toHaveLength(1);
  });

  it('records a user touchdown as six points pending the extra-point try', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({ seed: 20260620 });
    controller.start(gameplay);

    expect(startPlay(gameplay)).toBe(true);
    gameplay.player.position.z = PLAYABLE_FIELD_BOUNDS.maxZ + 1;
    updateGameplayModel(gameplay, 1 / 60, { suppressDeadPlayReset: true });
    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));
    const first = controller.getSnapshot();

    expect(first.phase).toBe('userPossession');
    expect(first.userScore).toBe(6);
    expect(first.driveSummaries).toHaveLength(0);
    expect(first.pendingScoringDriveSummary?.result).toBe('touchdown');
    expect(first.pendingScoringDriveSummary?.possession).toBe('user');
    expect(first.pendingScoringDriveSummary?.scoringEvents).toEqual([
      { points: 6, team: 'user', type: 'touchdown' },
    ]);

    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));
    expect(controller.getSnapshot().userScore).toBe(6);

    expect(controller.beginPreparedExtraPoint()).toBe(true);
    expect(controller.getSnapshot().phase).toBe('extraPoint');
  });

  it('turns a failed fourth down into one opponent possession', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({ seed: 20260620 });
    controller.start(gameplay);
    gameplay.drive.currentDown = 4;

    expect(startPlay(gameplay)).toBe(true);
    gameplay.player.position.x = PLAYABLE_FIELD_BOUNDS.maxX + gameplay.player.collisionRadius + 1;
    gameplay.player.position.z = gameplay.drive.lineOfScrimmage.z;
    updateGameplayModel(gameplay, 1 / 60, { suppressDeadPlayReset: true });
    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));
    const first = controller.getSnapshot();

    expect(first.driveSummaries[0]?.result).toBe('turnoverOnDowns');
    expect(first.driveSummaries[0]?.possession).toBe('user');
    expect(first.driveSummaries.filter((summary) => summary.possession === 'opponent')).toHaveLength(1);

    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));
    expect(controller.getSnapshot().driveSummaries.filter((summary) => summary.possession === 'opponent')).toHaveLength(1);
  });

  it('supports a voluntary abstract punt from preSnap only', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({ seed: 20260620 });
    controller.start(gameplay);

    expect(controller.punt(gameplay, snapshotGameplayModel(gameplay))).toBe(true);
    const afterPunt = controller.getSnapshot();

    expect(afterPunt.driveSummaries[0]?.result).toBe('punt');
    expect(afterPunt.driveSummaries[0]?.possession).toBe('user');
    expect(afterPunt.driveSummaries.filter((summary) => summary.possession === 'opponent')).toHaveLength(1);

    expect(controller.canStartPlay(snapshotGameplayModel(gameplay))).toBe(false);
    expect(controller.punt(gameplay, snapshotGameplayModel(gameplay))).toBe(false);
  });

  it('uses kickoff, not a direct user spot, after opponent scoring drives', () => {
    for (const result of ['touchdown', 'fieldGoal'] satisfies DriveSummaryResult[]) {
      const seed = findSeedForOpponentSummary((summary) => summary.result === result);
      const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
      const controller = createController({ seed });

      controller.start(gameplay);
      const scored = controller.getSnapshot().previousDriveSummary;
      expect(scored?.result).toBe(result);
      expect(scored?.possessionTransition).toBeNull();

      controller.continue(gameplay);
      const snapshot = controller.getSnapshot();
      expect(snapshot.phase).toBe('kickoff');
      expect(snapshot.kickoff.reason).toBe('postScore');
      expect(snapshot.possession).toBe('user');
    }
  });

  it('converts opponent turnovers and failed fourth downs into exact user starts', () => {
    for (const result of ['turnover', 'turnoverOnDowns'] satisfies DriveSummaryResult[]) {
      const seed = findSeedForOpponentSummary((summary) => summary.result === result);
      const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
      const controller = createController({ seed });

      controller.start(gameplay);
      const transition = controller.getSnapshot().previousDriveSummary?.possessionTransition;
      expect(transition?.reason).toBe(result);
      expect(transition?.toTeam).toBe('user');

      controller.continue(gameplay);
      const snapshot = controller.getSnapshot();
      expect(snapshot.phase).toBe('userPossession');
      expect(snapshot.currentFieldPosition).toEqual(transition?.nextOffenseStartingPosition);
      expect(snapshotGameplayModel(gameplay).currentBallSpot).toEqual(
        possessionFieldPositionToOffenseSpot(transition!.nextOffenseStartingPosition),
      );
    }
  });

  it('uses opponent punt downed and returned transitions for the user start', () => {
    for (const reason of ['puntDowned', 'puntReturn'] as const) {
      const seed = findSeedForOpponentSummary((summary) =>
        summary.possessionTransition?.reason === reason);
      const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
      const controller = createController({ seed });

      controller.start(gameplay);
      const transition = controller.getSnapshot().previousDriveSummary?.possessionTransition;
      expect(transition?.reason).toBe(reason);

      controller.continue(gameplay);
      const snapshot = controller.getSnapshot();
      expect(snapshot.phase).toBe('userPossession');
      expect(snapshot.currentFieldPosition).toEqual(transition?.nextOffenseStartingPosition);
      expect(snapshot.currentFieldPosition).not.toEqual(createOwnYardLinePosition(25));
      expect(snapshotGameplayModel(gameplay).drive.lineOfScrimmage.z).toBeCloseTo(
        possessionFieldPositionToOffenseSpot(transition!.nextOffenseStartingPosition).z,
        5,
      );
    }
  });

  it('uses an own-20 user start for an opponent punt touchback', () => {
    const summary = simulateOpponentDrive({
      difficulty: 'pro',
      driveNumber: 1,
      opponentOffensiveRating: 70,
      quarter: 1,
      remainingSeconds: 180,
      seed: 1,
      startingFieldPosition: createOpponentYardLinePosition(35),
      userDefensiveRating: 70,
    });

    expect(summary.result).toBe('punt');
    expect(summary.possessionTransition?.reason).toBe('puntTouchback');
    expect(summary.possessionTransition?.nextOffenseStartingPosition).toEqual(
      createOwnYardLinePosition(20),
    );
    expect(summary.possessionTransition?.nextOffenseStartingPosition).not.toEqual(
      createOwnYardLinePosition(25),
    );
  });

  it('starts opponent simulation from exact user turnover-on-downs spots', () => {
    const cases = [
      {
        expectedOpponentStart: createOwnYardLinePosition(35),
        userSpot: createOpponentYardLinePosition(35),
      },
      {
        expectedOpponentStart: createOpponentYardLinePosition(40),
        userSpot: createOwnYardLinePosition(40),
      },
    ];

    for (const testCase of cases) {
      const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
      const controller = createController({ seed: 20260620 });
      controller.start(gameplay);
      resetOffensePossession(gameplay, possessionFieldPositionToOffenseSpot(testCase.userSpot));
      gameplay.drive.currentDown = 4;

      expect(startPlay(gameplay)).toBe(true);
      const deadBallSpot = possessionFieldPositionToOffenseSpot(testCase.userSpot);
      gameplay.player.position.x = deadBallSpot.x;
      gameplay.player.position.z = deadBallSpot.z;
      const tackler = gameplay.players.find((player) => player.team === 'defense');
      if (!tackler) {
        throw new Error('Expected a defender for turnover-on-downs setup');
      }
      tackler.position.x = deadBallSpot.x;
      tackler.position.z = deadBallSpot.z;
      updateGameplayModel(gameplay, 1 / 60, { suppressDeadPlayReset: true });
      controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));

      const userSummary = controller.getSnapshot().driveSummaries[0];
      expect(userSummary?.result).toBe('turnoverOnDowns');
      expect(userSummary?.possessionTransition?.nextOffenseStartingPosition).toEqual(
        testCase.expectedOpponentStart,
      );
      expect(controller.getSnapshot().currentFieldPosition).toEqual(testCase.expectedOpponentStart);
    }
  });

  it('uses an own-20 opponent start for a user punt touchback', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController({ seed: 20260620 });
    controller.start(gameplay);
    resetOffensePossession(gameplay, possessionFieldPositionToOffenseSpot(createOpponentYardLinePosition(5)));

    expect(controller.punt(gameplay, snapshotGameplayModel(gameplay))).toBe(true);
    const userSummary = controller.getSnapshot().driveSummaries[0];

    expect(userSummary?.result).toBe('punt');
    expect(userSummary?.possessionTransition?.reason).toBe('puntTouchback');
    expect(userSummary?.possessionTransition?.nextOffenseStartingPosition).toEqual(
      createOwnYardLinePosition(20),
    );
    expect(controller.getSnapshot().currentFieldPosition).toEqual(createOwnYardLinePosition(20));
  });

  it('allows a live play to finish at zero but blocks a new snap afterward', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({
      quarterDurationSeconds: 30,
      seed: 20260620,
    });
    controller.start(gameplay);

    expect(startPlay(gameplay)).toBe(true);
    controller.update(31, gameplay, snapshotGameplayModel(gameplay));
    expect(controller.getSnapshot().clock.remainingSeconds).toBe(0);
    expect(controller.getSnapshot().phase).toBe('userPossession');

    gameplay.player.position.z = PLAYABLE_FIELD_BOUNDS.maxZ + 1;
    updateGameplayModel(gameplay, 1 / 60, { suppressDeadPlayReset: true });
    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));

    expect(controller.getSnapshot().phase).toBe('userPossession');
    expect(controller.getSnapshot().userScore).toBe(6);
    expect(controller.canStartPlay(snapshotGameplayModel(gameplay))).toBe(false);

    expect(controller.beginPreparedExtraPoint()).toBe(true);
    expect(controller.getSnapshot().phase).toBe('extraPoint');
  });

  it('continues the clock after an in-bounds tackle but stops after out of bounds', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({ seed: 20260620 });
    controller.start(gameplay);

    expect(startPlay(gameplay)).toBe(true);
    controller.update(5, gameplay, snapshotGameplayModel(gameplay));
    expect(controller.getSnapshot().clock.remainingSeconds).toBe(175);

    const tackler = gameplay.players.find((player) => player.team === 'defense');
    if (!tackler) {
      throw new Error('Expected a defender for tackle setup');
    }
    tackler.position.x = gameplay.player.position.x;
    tackler.position.z = gameplay.player.position.z;
    updateGameplayModel(gameplay, 0, { suppressDeadPlayReset: true });
    controller.update(0, gameplay, snapshotGameplayModel(gameplay));
    expect(snapshotGameplayModel(gameplay).lastPlayResult?.type).toBe('tackle');
    expect(controller.getSnapshot().clock.running).toBe(true);

    resetPlay(gameplay);
    controller.update(3, gameplay, snapshotGameplayModel(gameplay));
    expect(controller.getSnapshot().clock.remainingSeconds).toBe(172);

    expect(startPlay(gameplay)).toBe(true);
    gameplay.player.position.x = PLAYABLE_FIELD_BOUNDS.maxX + gameplay.player.collisionRadius + 1;
    updateGameplayModel(gameplay, 0, { suppressDeadPlayReset: true });
    controller.update(0, gameplay, snapshotGameplayModel(gameplay));
    expect(snapshotGameplayModel(gameplay).lastPlayResult?.type).toBe('outOfBounds');
    expect(controller.getSnapshot().clock.running).toBe(false);
  });

  it('resets the full exhibition match on rematch', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({ seed: 20260620 });
    controller.start(gameplay);
    controller.punt(gameplay, snapshotGameplayModel(gameplay));

    expect(controller.getSnapshot().driveSummaries.length).toBeGreaterThan(0);

    controller.rematch(gameplay);

    expect(controller.getSnapshot()).toMatchObject({
      driveNumber: 1,
      phase: 'userPossession',
      userScore: 0,
      opponentScore: 0,
      quarter: 1,
    });
    expect(controller.getSnapshot().driveSummaries).toHaveLength(0);
    expect(snapshotGameplayModel(gameplay)).toMatchObject({
      playState: 'preSnap',
      playbookId: '11v11',
    });
  });

  it('leaves score attack available as a regression mode', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'scoreAttack',
      playbookId: '5v5',
    });

    expect(gameplay.challengeMode).toBe('scoreAttack');
    expect(startPlay(gameplay)).toBe(true);
    expect(snapshotGameplayModel(gameplay).scoreAttack.state).toBe('running');
  });
});

describe('match score application', () => {
  it('applies opponent touchdowns and field goals through scoring events', () => {
    const match = createMatchModel({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    beginMatch(match);

    addDriveSummary(match, createDriveSummary({
      description: 'Opponent touchdown.',
      driveNumber: match.driveNumber,
      elapsedSeconds: 42,
      endingFieldPosition: createOpponentYardLinePosition(0),
      plays: 6,
      possession: 'opponent',
      quarter: match.quarter,
      result: 'touchdown',
      scoringEvents: [
        { points: 6, team: 'opponent', type: 'touchdown' },
        { points: 1, team: 'opponent', type: 'extraPoint' },
      ],
      startedAtSeconds: match.clock.remainingSeconds,
      startingFieldPosition: createOwnYardLinePosition(25),
      yards: 65,
    }));
    addDriveSummary(match, createDriveSummary({
      description: 'Opponent field goal.',
      driveNumber: match.driveNumber,
      elapsedSeconds: 28,
      endingFieldPosition: createOpponentYardLinePosition(22),
      plays: 5,
      possession: 'opponent',
      quarter: match.quarter,
      result: 'fieldGoal',
      scoringEvents: [{ points: 3, team: 'opponent', type: 'fieldGoal' }],
      startedAtSeconds: match.clock.remainingSeconds,
      startingFieldPosition: createOwnYardLinePosition(25),
      yards: 43,
    }));

    expect(snapshotMatchModel(match).opponentScore).toBe(10);
  });
});

function createController(options: {
  quarterDurationSeconds?: number;
  seed: number;
}): MatchFlowController {
  return new MatchFlowController({
    opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
    quarterDurationSeconds: options.quarterDurationSeconds,
    seed: options.seed,
    userTeamId: DEFAULT_USER_TEAM_ID,
  });
}

function findSeedForOpponentResult(result: DriveSummaryResult): number {
  for (let seed = 1; seed < 5000; seed += 2) {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({ seed });
    controller.start(gameplay);
    if (controller.getSnapshot().previousDriveSummary?.result === result) {
      return seed;
    }
  }

  throw new Error(`Unable to find deterministic seed for ${result}`);
}

function findSeedForOpponentSummary(predicate: (summary: DriveSummary) => boolean): number {
  for (let seed = 1; seed < 10000; seed += 2) {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = createController({ seed });
    controller.start(gameplay);
    const summary = controller.getSnapshot().previousDriveSummary;
    if (summary && predicate(summary)) {
      return seed;
    }
  }

  throw new Error('Unable to find deterministic opponent drive seed');
}
