import { describe, expect, it } from 'vitest';
import { MatchFlowController } from '../src/match/MatchFlowController';
import type { MatchPossession, MatchSnapshot } from '../src/match/MatchTypes';
import { resolvePostgameStory } from '../src/presentation/postgame/PostgameStoryResolver';
import {
  createZeroPlayerGameStats,
  createZeroTeamGameStats,
  type GameStatsSnapshot,
} from '../src/stats/GameStatsTypes';

describe('postgame presentation', () => {
  it('selects a close-finish story when the final score is tight', () => {
    const match = createGameOverSnapshot({
      opponentPoints: 17,
      userPoints: 20,
    });

    const story = resolvePostgameStory(match);

    expect(story.category).toBe('closeFinish');
    expect(story.supportingStatKeys).toContain('score');
    expect(story.caption).toMatch(/tight|score|answers|deciding/i);
  });

  it('selects a turnover-swing story when turnovers define the final', () => {
    const match = createGameOverSnapshot({
      opponentPoints: 10,
      opponentTurnovers: 4,
      userPoints: 24,
      userTurnovers: 1,
    });

    const story = resolvePostgameStory(match);

    expect(story.category).toBe('turnoverSwing');
    expect(story.supportingTeam).toBe('user');
    expect(story.supportingStatKeys).toContain('turnovers');
  });

  it('includes Dynasty context when the match was launched from Dynasty', () => {
    const match = {
      ...createGameOverSnapshot({
        opponentPoints: 17,
        userPoints: 24,
      }),
      dynastyStoryContext: createDynastyStoryContext(),
    };

    const story = resolvePostgameStory(match);

    expect(story.contextSummary).toBe('Dynasty Week 2: Metro started this matchup 1-0, with Lights at 0-1.');
    expect(story.caption).not.toContain('Dynasty Week 2');
  });

  it('selects a quarterback-dominance story from actual player passing stats', () => {
    const match = createGameOverSnapshot({
      opponentPassingYards: 100,
      opponentPoints: 14,
      userPassingTouchdowns: 2,
      userPassingYards: 150,
      userPoints: 24,
    });

    const story = resolvePostgameStory(match);

    expect(story.category).toBe('quarterbackDominance');
    expect(story.supportingPlayerId).toBe('metro-meteors-qb-12');
    expect(story.caption).toContain('#12 Jalen Carter');
  });

  it('keeps multi-criteria postgame story selection deterministic for a fixed match', () => {
    const match = createGameOverSnapshot({
      deterministicSeed: 8042,
      opponentPassingYards: 60,
      opponentPoints: 7,
      opponentTurnovers: 3,
      userPassingTouchdowns: 3,
      userPassingYards: 240,
      userPoints: 35,
      userRushingYards: 145,
      userTurnovers: 0,
    });

    expect(resolvePostgameStory(match)).toEqual(resolvePostgameStory(match));
  });
});

function createGameOverSnapshot(patch: {
  deterministicSeed?: number;
  opponentPassingYards?: number;
  opponentPoints?: number;
  opponentRushingYards?: number;
  opponentTurnovers?: number;
  userPassingTouchdowns?: number;
  userPassingYards?: number;
  userPoints?: number;
  userRushingYards?: number;
  userTurnovers?: number;
}): MatchSnapshot {
  const controller = new MatchFlowController({
    opponentTeamId: 'lakefront-lights',
    userTeamId: 'metro-meteors',
  });
  const snapshot = controller.getSnapshot();
  const userScore = patch.userPoints ?? 0;
  const opponentScore = patch.opponentPoints ?? 0;
  return {
    ...snapshot,
    deterministicSeed: patch.deterministicSeed ?? 20260623,
    opponentScore,
    phase: 'gameOver',
    stats: createStatsSnapshot(patch),
    userScore,
    winner: resolveWinner(userScore, opponentScore),
  };
}

function createStatsSnapshot(patch: Parameters<typeof createGameOverSnapshot>[0]): GameStatsSnapshot {
  const userPassingYards = patch.userPassingYards ?? 0;
  const userRushingYards = patch.userRushingYards ?? 0;
  const opponentPassingYards = patch.opponentPassingYards ?? 0;
  const opponentRushingYards = patch.opponentRushingYards ?? 0;
  return {
    duplicateSuppressionCount: 0,
    invariantFailures: [],
    lastEvent: null,
    players: {
      'lakefront-lights-qb-8': {
        ...createZeroPlayerGameStats('lakefront-lights-qb-8', 'opponent'),
        passingYards: opponentPassingYards,
      },
      'metro-meteors-qb-12': {
        ...createZeroPlayerGameStats('metro-meteors-qb-12', 'user'),
        passingTouchdowns: patch.userPassingTouchdowns ?? 0,
        passingYards: userPassingYards,
      },
    },
    possessionSeconds: {
      opponent: 360,
      user: 360,
    },
    processedEventCount: 24,
    teams: {
      opponent: {
        ...createZeroTeamGameStats(),
        passingYards: opponentPassingYards,
        points: patch.opponentPoints ?? 0,
        rushingYards: opponentRushingYards,
        totalYards: opponentPassingYards + opponentRushingYards,
        turnovers: patch.opponentTurnovers ?? 0,
      },
      user: {
        ...createZeroTeamGameStats(),
        passingYards: userPassingYards,
        points: patch.userPoints ?? 0,
        rushingYards: userRushingYards,
        totalYards: userPassingYards + userRushingYards,
        turnovers: patch.userTurnovers ?? 0,
      },
    },
  };
}

function resolveWinner(
  userScore: number,
  opponentScore: number,
): MatchPossession | 'tie' {
  if (userScore === opponentScore) {
    return 'tie';
  }

  return userScore > opponentScore ? 'user' : 'opponent';
}

function createDynastyStoryContext(): MatchSnapshot['dynastyStoryContext'] {
  return {
    halftimeSummary: 'Dynasty Week 2: Metro entered 1-0 against Lights (0-1).',
    hubSummary: 'Week 2: Metro host Lights.',
    matchupLabel: 'vs Lakefront Lights',
    opponentRecordLabel: '0-1',
    opponentStandingLabel: 'No. 5',
    postgameSummary: 'Dynasty Week 2: Metro started this matchup 1-0, with Lights at 0-1.',
    seasonLabel: '2026 Season',
    userRecordLabel: '1-0',
    userStandingLabel: 'No. 1',
    weekLabel: 'Week 2',
  };
}
