import { describe, expect, it } from 'vitest';
import { createGameplayModel, snapshotGameplayModel } from '../../src/playState';
import { createKickLandingReticle } from '../../src/presentation/KickLandingReticle';
import { MatchFlowController } from '../../src/match/MatchFlowController';
import { resolveCoinTossFace } from '../../src/match/CoinTossModel';
import { DEFAULT_MATCH_RULES } from '../../src/match/MatchTypes';
import type { MatchPossession } from '../../src/match/MatchTypes';
import { BROADCAST_EXPERIENCE_SETTINGS } from '../../src/config/GameExperienceSettings';
import { createGameplayRosterBinding } from '../../src/roster/GameplayRosterBinding';
import { resolveTeamPresentationTheme } from '../../src/teams/TeamThemeApplier';
import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
} from '../../src/teams/TeamRegistry';
import { KickoffPresentationDirector } from '../../src/specialTeams/KickoffPresentationDirector';
import {
  KICKOFF_SIMULATION_CONFIG,
  createKickoffSimulationInput,
  sampleKickoffBallPosition,
  simulateKickoff,
} from '../../src/specialTeams/KickoffSimulation';

describe('deterministic kickoff simulation', () => {
  it('produces the same result for the same seed and changes across seeds', () => {
    const input = createInput({ matchSeed: 1001, sequenceIndex: 0 });
    const same = simulateKickoff(input);
    const repeat = simulateKickoff(input);
    const different = simulateKickoff(createInput({ matchSeed: 1002, sequenceIndex: 0 }));

    expect(repeat).toEqual(same);
    expect(different.target).not.toEqual(same.target);
  });

  it('makes stronger kickers drive the ball farther on average', () => {
    const weak = sampleDistances({ kickPower: 30, kickAccuracy: 82 });
    const strong = sampleDistances({ kickPower: 92, kickAccuracy: 82 });

    expect(average(strong)).toBeGreaterThan(average(weak) + 10);
  });

  it('makes accurate kickers produce lower spread and smaller landing reticles', () => {
    const inaccurate = sampleErrorSpread({ kickPower: 82, kickAccuracy: 35 });
    const accurate = sampleErrorSpread({ kickPower: 82, kickAccuracy: 94 });

    expect(accurate.lateralStd).toBeLessThan(inaccurate.lateralStd);
    expect(accurate.longitudinalStd).toBeLessThan(inaccurate.longitudinalStd);
    expect(accurate.radius).toBeLessThan(inaccurate.radius);
    expect(accurate.radius).toBeGreaterThanOrEqual(KICKOFF_SIMULATION_CONFIG.reticleRadiusMinYards);
  });

  it('samples a deterministic arc ending at the authoritative landing target', () => {
    const result = simulateKickoff(createInput({ matchSeed: 2000, sequenceIndex: 2 }));
    const start = sampleKickoffBallPosition(result, 0);
    const end = sampleKickoffBallPosition(result, result.flightSeconds);
    const middle = sampleKickoffBallPosition(result, result.flightSeconds / 2);

    expect(start).toMatchObject({ x: result.origin.x, z: result.origin.z });
    expect(end.x).toBeCloseTo(result.target.x, 5);
    expect(end.z).toBeCloseTo(result.target.z, 5);
    expect(middle.y).toBeGreaterThan(start.y);
    expect(middle.y).toBeGreaterThan(end.y);
  });

  it('syncs the landing reticle to the kickoff target and uncertainty radius', () => {
    const result = simulateKickoff(createInput({ kickAccuracy: 88, matchSeed: 3000 }));
    const reticle = createKickLandingReticle();

    reticle.sync(result, true);

    expect(reticle.group.visible).toBe(true);
    expect(reticle.group.position.x).toBeCloseTo(result.target.x, 5);
    expect(reticle.group.position.z).toBeCloseTo(result.target.z, 5);
    expect(reticle.group.getObjectByName('kick-landing-reticle-uncertainty-ring')?.scale.x)
      .toBeCloseTo(result.uncertaintyRadiusYards, 5);

    reticle.dispose();
  });

  it('creates both fielded and touchback results while preserving valid start spots', () => {
    const fielded = simulateKickoff(createInput({ kickPower: 20, matchSeed: 4100 }));
    const touchback = findResult('touchback');

    expect(fielded.landingType).toBe('fielded');
    expect(fielded.target.z).toBeGreaterThan(0);
    expect(fielded.receivingStartSpot.z).toBeLessThan(0);
    expect(fielded.receivingStartSpot.z).toBeLessThanOrEqual(50);
    expect(touchback.receivingStartSpot).toEqual(DEFAULT_MATCH_RULES.touchbackSpot);
  });
});

describe('kickoff match flow', () => {
  it.each([
    ['user wins', 20260620, 'user', 'opponent'],
    ['opponent wins', 20260621, 'opponent', 'user'],
  ] as const)('uses coin-toss opening possession when %s', (
    _label,
    seed,
    receivingTeam,
    kickingTeam,
  ) => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(seed);
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    const resolvedFace = resolveCoinTossFace(seed);
    controller.resolveOpeningCoinToss(
      receivingTeam === 'user' ? resolvedFace : oppositeFace(resolvedFace),
    );

    expect(controller.beginOpeningKickoffAfterCoinToss(gameplay)).toBe(true);
    const kickoff = controller.getSnapshot().kickoff;

    expect(controller.getSnapshot().phase).toBe('kickoff');
    expect(kickoff.receivingTeam).toBe(receivingTeam);
    expect(kickoff.kickingTeam).toBe(kickingTeam);
    expect(kickoff.kickerRosterId).toBe(
      `${kickingTeam === 'user' ? DEFAULT_USER_TEAM_ID : DEFAULT_OPPONENT_TEAM_ID}-k-5`,
    );
    expect(kickoff.result).not.toBeNull();
  });

  it('does not schedule the opening kickoff more than once for a match', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(20260620);
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss(resolveCoinTossFace(20260620));

    expect(controller.beginOpeningKickoffAfterCoinToss(gameplay)).toBe(true);
    const firstKickoff = controller.getSnapshot().kickoff;

    expect(controller.beginOpeningKickoffAfterCoinToss(gameplay)).toBe(false);
    expect(controller.getSnapshot().kickoff).toEqual(firstKickoff);
  });

  it('hands a user-received kickoff to the user offense at the calculated spot', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(20260620);
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss(resolveCoinTossFace(20260620));
    controller.beginOpeningKickoffAfterCoinToss(gameplay);
    const result = controller.getSnapshot().kickoff.result;

    controller.completeKickoff(gameplay);
    const snapshot = controller.getSnapshot();

    expect(snapshot.phase).toBe('userPossession');
    expect(snapshot.currentFieldPosition).toEqual(result?.receivingStartSpot);
    expect(snapshotGameplayModel(gameplay).drive.lineOfScrimmage.z)
      .toBeCloseTo(result?.receivingStartSpot.z ?? 0, 5);
    expect(snapshotGameplayModel(gameplay).playState).toBe('preSnap');
  });

  it('feeds an opponent-received kickoff into the existing opponent-drive simulator', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(20260621);
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss(oppositeFace(resolveCoinTossFace(20260621)));
    controller.beginOpeningKickoffAfterCoinToss(gameplay);

    controller.completeKickoff(gameplay);
    const snapshot = controller.getSnapshot();

    expect(snapshot.phase).toBe('opponentDriveSimulation');
    expect(snapshot.previousDriveSummary?.possession).toBe('opponent');
    expect(snapshot.driveSummaries).toHaveLength(1);
  });

  it.each([
    ['touchback', 'user'],
    ['fielded', 'user'],
    ['touchback', 'opponent'],
    ['fielded', 'opponent'],
  ] as const)('hands off a %s kickoff to %s possession using the result start spot', (
    landingType,
    receivingTeam,
  ) => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(findSeedForOpeningKickoff(landingType, receivingTeam));
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    const resolvedFace = resolveCoinTossFace(controller.getSnapshot().deterministicSeed);
    controller.resolveOpeningCoinToss(
      receivingTeam === 'user' ? resolvedFace : oppositeFace(resolvedFace),
    );
    controller.beginOpeningKickoffAfterCoinToss(gameplay);
    const kickoff = controller.getSnapshot().kickoff;

    expect(kickoff.receivingTeam).toBe(receivingTeam);
    expect(kickoff.result?.landingType).toBe(landingType);

    const result = controller.completeKickoff(gameplay);
    const snapshot = controller.getSnapshot();

    expect(result?.receivingStartSpot).toEqual(kickoff.result?.receivingStartSpot);
    if (receivingTeam === 'user') {
      expect(snapshot.phase).toBe('userPossession');
      expect(snapshot.currentFieldPosition).toEqual(kickoff.result?.receivingStartSpot);
      expect(snapshotGameplayModel(gameplay).drive.lineOfScrimmage.z)
        .toBeCloseTo(kickoff.result?.receivingStartSpot.z ?? 0, 5);
    } else {
      expect(snapshot.previousDriveSummary?.possession).toBe('opponent');
      expect(snapshot.previousDriveSummary?.startingFieldPosition).toEqual(
        kickoff.result?.receivingStartSpot,
      );
    }
  });

  it('schedules a post-touchdown kickoff once instead of immediately simulating the next drive', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(20260620);
    controller.start(gameplay);

    gameplay.lastPlayResult = {
      endingBallSpot: { x: 0, z: 51 },
      id: 1,
      reason: 'touchdown',
      scoringTeam: 'offense',
      startingBallSpot: gameplay.drive.lineOfScrimmage,
      type: 'touchdown',
      yardsGained: 65,
    };
    controller.update(0, gameplay, snapshotGameplayModel(gameplay));
    const first = controller.getSnapshot();
    controller.update(0, gameplay, snapshotGameplayModel(gameplay));
    const second = controller.getSnapshot();

    expect(first.phase).toBe('kickoff');
    expect(first.kickoff.reason).toBe('postScore');
    expect(first.kickoff.receivingTeam).toBe('opponent');
    expect(first.driveSummaries).toHaveLength(1);
    expect(second.driveSummaries).toHaveLength(1);
  });

  it.each([
    ['user' as const],
    ['opponent' as const],
  ])('schedules the second-half kickoff once for %s possession', (secondHalfPossession) => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(20260620);
    controller.prepareForPregame(gameplay);
    controller.model.phase = 'halftime';
    controller.model.quarter = 2;
    controller.model.secondHalfPossession = secondHalfPossession;

    controller.continue(gameplay);
    const first = controller.getSnapshot();
    controller.continue(gameplay);
    const second = controller.getSnapshot();

    expect(first.phase).toBe('kickoff');
    expect(first.quarter).toBe(3);
    expect(first.kickoff.reason).toBe('secondHalf');
    expect(first.kickoff.receivingTeam).toBe(secondHalfPossession);
    expect(second.kickoff).toEqual(first.kickoff);
  });

  it('serializes kickoff commentary through ready, in-flight, and result phases', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(20260620);
    const audio = createFakeKickoffAudioCoordinator();
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss(resolveCoinTossFace(20260620));
    controller.beginOpeningKickoffAfterCoinToss(gameplay);
    const matchSnapshot = controller.getSnapshot();
    const director = new KickoffPresentationDirector({
      audioCoordinator: audio as never,
      ballVisualStyle: 'football',
      rosterBinding: createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
      teamTheme: resolveTeamPresentationTheme(BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
    });

    director.start(matchSnapshot);
    updateKickoffFrames(director, gameplay, matchSnapshot, 30);
    expect(audio.startedLines).toEqual(['kickoffReady']);
    expect(director.getSnapshot()).toMatchObject({
      phase: 'ready',
      reticleVisible: false,
    });

    audio.complete('kickoffReady');
    updateKickoffFrames(director, gameplay, matchSnapshot, 1);
    expect(audio.startedLines).toEqual(['kickoffReady', 'kickoffInFlight']);
    expect(director.getSnapshot().phase).toBe('flight');

    updateKickoffFrames(director, gameplay, matchSnapshot, 260);
    expect(audio.startedLines).toEqual([
      'kickoffReady',
      'kickoffInFlight',
      'kickoffResult',
    ]);
    expect(director.getSnapshot()).toMatchObject({
      phase: 'result',
      reticleVisible: false,
    });

    audio.complete('kickoffResult');
    updateKickoffFrames(director, gameplay, matchSnapshot, 40);
    expect(director.getSnapshot()).toMatchObject({
      completed: true,
      phase: 'completed',
    });

    director.dispose();
  });
});

function createInput(options: {
  kickAccuracy?: number;
  kickPower?: number;
  matchSeed?: number;
  sequenceIndex?: number;
} = {}) {
  return createKickoffSimulationInput({
    kickAccuracy: options.kickAccuracy ?? 82,
    kickerRosterId: 'test-kicker',
    kickPower: options.kickPower ?? 82,
    kickingTeam: 'user',
    matchSeed: options.matchSeed ?? 1000,
    rules: DEFAULT_MATCH_RULES,
    sequenceIndex: options.sequenceIndex ?? 0,
  });
}

function sampleDistances(options: { kickAccuracy: number; kickPower: number }): number[] {
  return Array.from({ length: 80 }, (_, index) => {
    const result = simulateKickoff(createInput({ ...options, matchSeed: 5000 + index }));
    return Math.hypot(result.target.x - result.origin.x, result.target.z - result.origin.z);
  });
}

function sampleErrorSpread(options: { kickAccuracy: number; kickPower: number }) {
  const results = Array.from({ length: 80 }, (_, index) =>
    simulateKickoff(createInput({ ...options, matchSeed: 6000 + index })));
  return {
    lateralStd: stddev(results.map((result) => result.lateralErrorYards)),
    longitudinalStd: stddev(results.map((result) => result.longitudinalErrorYards)),
    radius: results[0].uncertaintyRadiusYards,
  };
}

function findResult(landingType: 'fielded' | 'touchback') {
  for (let seed = 1; seed < 5000; seed += 1) {
    const result = simulateKickoff(createInput({
      kickPower: landingType === 'touchback' ? 99 : 20,
      matchSeed: seed,
    }));
    if (result.landingType === landingType) {
      return result;
    }
  }

  throw new Error(`Unable to find kickoff result ${landingType}`);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function createController(seed: number): MatchFlowController {
  return new MatchFlowController({
    opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
    seed,
    userTeamId: DEFAULT_USER_TEAM_ID,
  });
}

function oppositeFace(face: 'heads' | 'tails'): 'heads' | 'tails' {
  return face === 'heads' ? 'tails' : 'heads';
}

function updateKickoffFrames(
  director: KickoffPresentationDirector,
  gameplay: ReturnType<typeof createGameplayModel>,
  matchSnapshot: ReturnType<MatchFlowController['getSnapshot']>,
  frames: number,
): void {
  for (let frame = 0; frame < frames; frame += 1) {
    director.update({
      deltaSeconds: 1 / 30,
      gameplaySnapshot: snapshotGameplayModel(gameplay),
      matchSnapshot,
    });
  }
}

function createFakeKickoffAudioCoordinator() {
  const completed = new Set<string>();
  const startedLines: string[] = [];
  return {
    startedLines,
    complete: (lineId: string) => {
      completed.add(lineId);
    },
    fadeTitleMusicToGameplay: () => undefined,
    getSnapshot: () => ({
      activeLine: null,
      completedLineIds: [...completed],
      crowdActiveLoopIds: [],
      crowdDuckingGain: 1,
      crowdGain: 1,
      failedLineIds: [],
      history: [],
      musicGain: 0,
      musicLoopActive: false,
      musicState: 'idle',
      playbackState: 'idle',
      queuedLine: null,
    }),
    isLineComplete: (lineId: string) => completed.has(lineId),
    reset: () => {
      completed.clear();
      startedLines.length = 0;
    },
    startLine: (lineId: string) => {
      startedLines.push(lineId);
    },
    updateAmbience: () => undefined,
  };
}

function findSeedForOpeningKickoff(
  landingType: 'fielded' | 'touchback',
  receivingTeam: MatchPossession,
): number {
  for (let seed = 1; seed < 20_000; seed += 1) {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(seed);
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    const resolvedFace = resolveCoinTossFace(seed);
    controller.resolveOpeningCoinToss(
      receivingTeam === 'user' ? resolvedFace : oppositeFace(resolvedFace),
    );
    controller.beginOpeningKickoffAfterCoinToss(gameplay);
    const kickoff = controller.getSnapshot().kickoff;
    if (
      kickoff.receivingTeam === receivingTeam &&
      kickoff.result?.landingType === landingType
    ) {
      return seed;
    }
  }

  throw new Error(`Unable to find ${landingType} opening kickoff for ${receivingTeam}`);
}
