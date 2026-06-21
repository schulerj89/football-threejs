import { describe, expect, it } from 'vitest';
import {
  createGameplayModel,
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
import type { DriveSummaryResult } from '../src/match/MatchTypes';
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

    advanceToNextQuarter(match);
    expect(match.quarter).toBe(2);
    expect(match.phase).toBe('opponentDriveSimulation');

    advanceToNextQuarter(match);
    expect(match.quarter).toBe(3);
    expect(match.phase).toBe('opponentDriveSimulation');
    expect(match.possession).toBe('opponent');

    advanceToNextQuarter(match);
    expect(match.quarter).toBe(4);
    expect(match.phase).toBe('userPossession');

    advanceToNextQuarter(match);
    expect(match.phase).toBe('gameOver');
    expect(match.clock.remainingSeconds).toBe(0);
  });

  it('simulates opponent drives deterministically from the same input', () => {
    const input = {
      difficulty: 'pro' as const,
      driveNumber: 4,
      opponentOffensiveRating: 73,
      quarter: 2,
      remainingSeconds: 94,
      seed: 991,
      startingFieldPosition: { x: 0, z: -15 },
      userDefensiveRating: 69,
    };

    expect(simulateOpponentDrive(input)).toEqual(simulateOpponentDrive(input));
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

  it('records a user touchdown as touchdown plus automatic extra point once', () => {
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

    expect(first.userScore).toBe(7);
    expect(first.driveSummaries[0]?.result).toBe('touchdown');
    expect(first.driveSummaries[0]?.possession).toBe('user');
    expect(first.driveSummaries[0]?.scoringEvents).toEqual([
      { points: 6, team: 'user', type: 'touchdown' },
      { points: 1, team: 'user', type: 'extraPoint' },
    ]);

    controller.update(1 / 60, gameplay, snapshotGameplayModel(gameplay));
    expect(controller.getSnapshot().userScore).toBe(7);
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

    expect(controller.getSnapshot().phase).toBe('quarterBreak');
    expect(controller.canStartPlay(snapshotGameplayModel(gameplay))).toBe(false);
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
      endingFieldPosition: { x: 0, z: 50 },
      plays: 6,
      possession: 'opponent',
      quarter: match.quarter,
      result: 'touchdown',
      scoringEvents: [
        { points: 6, team: 'opponent', type: 'touchdown' },
        { points: 1, team: 'opponent', type: 'extraPoint' },
      ],
      startedAtSeconds: match.clock.remainingSeconds,
      startingFieldPosition: { x: 0, z: -15 },
      yards: 65,
    }));
    addDriveSummary(match, createDriveSummary({
      description: 'Opponent field goal.',
      driveNumber: match.driveNumber,
      elapsedSeconds: 28,
      endingFieldPosition: { x: 0, z: 28 },
      plays: 5,
      possession: 'opponent',
      quarter: match.quarter,
      result: 'fieldGoal',
      scoringEvents: [{ points: 3, team: 'opponent', type: 'fieldGoal' }],
      startedAtSeconds: match.clock.remainingSeconds,
      startingFieldPosition: { x: 0, z: -15 },
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
