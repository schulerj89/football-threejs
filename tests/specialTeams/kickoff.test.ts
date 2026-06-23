import * as THREE from 'three';
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
  createKickoffFormation,
  validateKickoffFormation,
} from '../../src/specialTeams/KickoffFormation';
import {
  COLLEGE_SPECIAL_TEAMS_RULE_SPEC,
  resolveReceivingRestrainingLineZ,
} from '../../src/specialTeams/CollegeSpecialTeamsRuleSpec';
import {
  createFreeKickTouchbackPosition,
  possessionFieldPositionToOffenseSpot,
  worldSpotToPossessionFieldPosition,
} from '../../src/match/FieldPositionModel';
import { resolveKickoffPresentationRoster } from '../../src/specialTeams/SpecialTeamsLineupResolver';
import {
  createKickoffReturnState,
  resolveAssignedKickReturner,
  startKickoffRunUp,
  updateKickoffReturnState,
  type KickoffReturnOutcome,
} from '../../src/specialTeams/KickoffReturnSimulation';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
} from '../../src/presentation/players/FootballPlayerVisualFactory';
import {
  KICKOFF_SIMULATION_CONFIG,
  createKickoffSimulationInput,
  sampleKickoffBallPosition,
  simulateKickoff,
} from '../../src/specialTeams/KickoffSimulation';
import type { KickoffState } from '../../src/specialTeams/KickoffTypes';
import { getPlayerVisualHeadAnchor } from '../../src/playerVisual';
import type { PlayerModel } from '../../src/playerModel';
import type { PlayerTeamUniforms } from '../../src/playerVisual';

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
    expect(fielded.receivingStartPosition.yardsFromOwnGoalLine).toBeGreaterThan(0);
    expect(fielded.receivingStartPosition.yardsFromOwnGoalLine).toBeLessThanOrEqual(100);
    expect(touchback.receivingStartPosition).toEqual(createFreeKickTouchbackPosition());
  });

  it('resolves touchbacks to the receiving team own 25 from either physical end', () => {
    const userReceiving = findResult('touchback', 'opponent');
    const opponentReceiving = findResult('touchback', 'user');

    expect(userReceiving.receivingStartPosition).toEqual(createFreeKickTouchbackPosition());
    expect(opponentReceiving.receivingStartPosition).toEqual(createFreeKickTouchbackPosition());
  });
});

describe('kickoff presentation formation', () => {
  it('resolves a full roster-backed kickoff formation with eleven players per team', () => {
    const binding = createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
    const kickoff = createKickoffStateForTeam('user');
    const roster = resolveKickoffPresentationRoster(kickoff, binding);
    const layout = createKickoffFormation(kickoff, binding);
    const jerseyNumbersByRosterId = new Map(
      [...binding.userRoster.players, ...binding.opponentRoster.players]
        .map((player) => [player.id, player.jerseyNumber]),
    );

    expect(roster?.participants).toHaveLength(22);
    expect(roster?.kickingParticipants).toHaveLength(11);
    expect(roster?.receivingParticipants).toHaveLength(11);
    expect(roster?.kicker?.rosterPlayerId).toBe(binding.userRoster.kickerId);
    expect(roster?.returners.map((returner) => returner.footballPosition)).toEqual(['RB', 'WR']);
    expect(new Set(roster?.participants.map((participant) => participant.rosterPlayerId)).size).toBe(22);
    expect(layout.family).toBe('kickoff');
    expect(layout.participants).toHaveLength(22);
    expect(layout.participants.every((participant) => participant.presentationOnly)).toBe(true);
    for (const participant of layout.participants) {
      expect(participant.jerseyNumber).toBe(jerseyNumbersByRosterId.get(participant.rosterPlayerId));
    }
    expect(validateKickoffFormation(layout)).toEqual([]);
  });

  it('mirrors kickoff alignment by kicking direction while keeping returners behind receiving rows', () => {
    const binding = createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
    const userKick = createKickoffFormation(createKickoffStateForTeam('user', 7400), binding);
    const opponentKick = createKickoffFormation(createKickoffStateForTeam('opponent', 7401), binding);

    expect(userKick.ballPlacement?.z).toBeLessThan(0);
    expect(opponentKick.ballPlacement?.z).toBeGreaterThan(0);

    const userReturner = userKick.participants.find((participant) => participant.slotId === 'returner-left');
    const opponentReturner = opponentKick.participants.find((participant) => participant.slotId === 'returner-left');
    const userFront = userKick.participants.find((participant) => participant.slotId === 'front-line-middle');
    const opponentFront = opponentKick.participants.find((participant) => participant.slotId === 'front-line-middle');

    expect(userReturner?.position.z).toBeGreaterThan(userFront?.position.z ?? 0);
    expect(opponentReturner?.position.z).toBeLessThan(opponentFront?.position.z ?? 0);
    expect(userKick.participants.find((participant) => participant.slotId === 'coverage-left-5')?.position.x)
      .toBeCloseTo(
        -(userKick.participants.find((participant) => participant.slotId === 'coverage-right-5')?.position.x ?? 0),
        5,
      );
    expect(opponentKick.participants.find((participant) => participant.slotId === 'coverage-left-5')?.position.x)
      .toBeCloseTo(
        -(opponentKick.participants.find((participant) => participant.slotId === 'coverage-right-5')?.position.x ?? 0),
        5,
      );
  });

  it('enforces college kickoff line and receiving restraining-line constraints', () => {
    const binding = createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
    const kickoff = createKickoffStateForTeam('user', 7402);
    const layout = createKickoffFormation(kickoff, binding);
    const direction = kickoff.direction;
    const restrainingLineZ = resolveReceivingRestrainingLineZ(direction);
    const coverageLeft = layout.participants.filter((participant) =>
      participant.phase === 'kicking' && participant.slotId.startsWith('coverage-left-'));
    const coverageRight = layout.participants.filter((participant) =>
      participant.phase === 'kicking' && participant.slotId.startsWith('coverage-right-'));
    const nonKickers = layout.participants.filter((participant) =>
      participant.phase === 'kicking' && participant.slotId !== 'kicker');
    const receiving = layout.participants.filter((participant) => participant.phase === 'receiving');

    expect(coverageLeft).toHaveLength(5);
    expect(coverageRight).toHaveLength(5);
    for (const player of nonKickers) {
      const depthBehindKickLine = ((layout.ballPlacement?.z ?? 0) - player.position.z) * direction;
      expect(depthBehindKickLine).toBeGreaterThanOrEqual(0);
      expect(depthBehindKickLine).toBeLessThanOrEqual(
        COLLEGE_SPECIAL_TEAMS_RULE_SPEC.maximumNonKickerDepthBehindKickingLineYards,
      );
    }
    for (const player of receiving) {
      expect(player.position.z * direction).toBeGreaterThanOrEqual(restrainingLineZ * direction);
    }
  });

  it('builds kickoff participants through the shared full player visual profile', async () => {
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
      footballPlayerVisual: {
        attachHelmet: attachMockHelmet,
      },
      rosterBinding: createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
      teamTheme: resolveTeamPresentationTheme(BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
    });

    director.start(matchSnapshot);
    await Promise.resolve();
    await Promise.resolve();

    expect(director.getSnapshot()).toMatchObject({
      formationFamily: 'kickoff',
      formationValidation: [],
      helmetReadyCount: 22,
      kickingParticipantCount: 11,
      participantCount: 22,
      receivingParticipantCount: 11,
      stageVisibility: {
        kickoffParticipantsVisible: true,
        officialsVisible: false,
        scrimmagePlayersVisible: false,
      },
      visualProfile: {
        bareHeadCount: 0,
        fullFootballPlayerVisualCount: 22,
        presentationOnlyCount: 22,
        profileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
        profileMatchCount: 22,
      },
    });

    director.finish();
    expect(director.getSnapshot().participantCount).toBe(0);
    expect(director.getSnapshot().stageVisibility.kickoffParticipantsVisible).toBe(false);

    director.dispose();
  });

  it('repeated kickoff stage entries do not retain kickoff roots or reticles', async () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const binding = createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
    const director = new KickoffPresentationDirector({
      audioCoordinator: createFakeKickoffAudioCoordinator() as never,
      ballVisualStyle: 'football',
      footballPlayerVisual: {
        attachHelmet: attachMockHelmet,
      },
      rosterBinding: binding,
      teamTheme: resolveTeamPresentationTheme(BROADCAST_EXPERIENCE_SETTINGS.teamProfiles),
    });

    for (let cycle = 0; cycle < 50; cycle += 1) {
      const kickoff = createKickoffStateForTeam(cycle % 2 === 0 ? 'user' : 'opponent', 8000 + cycle);
      director.start({ deterministicSeed: 8000 + cycle, kickoff });
      await Promise.resolve();
      await Promise.resolve();
      expect(director.getSnapshot()).toMatchObject({
        helmetReadyCount: 22,
        participantCount: 22,
        visualProfile: {
          bareHeadCount: 0,
          profileMatchCount: 22,
        },
      });
      director.finish();
      expect(director.getSnapshot()).toMatchObject({
        participantCount: 0,
        reticleVisible: false,
        stageVisibility: {
          kickoffParticipantsVisible: false,
        },
      });
      expect(snapshotGameplayModel(gameplay).players).toHaveLength(22);
    }

    director.dispose();
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

  it('selects the closest kickoff returner with stable tie-breaking', () => {
    const landingSpot = { x: 0, z: 20 };
    const closest = resolveAssignedKickReturner([
      { position: { x: -12, z: 20 }, rosterPlayerId: 'returner-b', visualId: 'b' },
      { position: { x: 2, z: 20 }, rosterPlayerId: 'returner-a', visualId: 'a' },
    ], landingSpot, 2);
    const tied = resolveAssignedKickReturner([
      { position: { x: -5, z: 20 }, rosterPlayerId: 'returner-b', visualId: 'b' },
      { position: { x: 5, z: 20 }, rosterPlayerId: 'returner-a', visualId: 'a' },
    ], landingSpot, 2);

    expect(closest?.returnerRosterId).toBe('returner-a');
    expect(tied?.returnerRosterId).toBe('returner-a');
  });

  it('holds coverage during the kicker run-up, then assigns return blockers at contact', () => {
    const binding = createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
    const kickoff = createKickoffStateForTeam('opponent', 1, { kickPower: 20 });
    const layout = createKickoffFormation(kickoff, binding);
    const state = createKickoffReturnState({ kickoff, layout, matchSeed: 1 });
    const coverageStart = state.participants
      .filter((participant) => participant.phase === 'kicking' && participant.slotId !== 'kicker')
      .map((participant) => ({ id: participant.visualId, position: { ...participant.position } }));

    startKickoffRunUp(state);
    const beforeContactEvents = updateKickoffReturnState(state, { deltaSeconds: 1 / 60 });

    expect(beforeContactEvents.contact).toBe(false);
    for (const start of coverageStart) {
      const current = state.participants.find((participant) => participant.visualId === start.id);
      expect(current?.position).toEqual(start.position);
    }

    let contact = false;
    for (let frame = 0; frame < 60 && !contact; frame += 1) {
      const events = updateKickoffReturnState(state, { deltaSeconds: 1 / 60 });
      contact = events.contact;
    }

    expect(contact).toBe(true);
    expect(state.assignedReturner).not.toBeNull();
    expect(state.nonAssignedReturnerVisualId).not.toBeNull();
    expect(state.blockerAssignments.length).toBeGreaterThan(0);
    expect(new Set(state.blockerAssignments.map((assignment) => assignment.blockerVisualId)).size)
      .toBe(state.blockerAssignments.length);
    expect(new Set(state.blockerAssignments.map((assignment) => assignment.coverageVisualId)).size)
      .toBe(state.blockerAssignments.length);
  });

  it('starts the clock on legal touch and resolves a fielded return to the exact dead-ball spot', () => {
    const binding = createGameplayRosterBinding('11v11', BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
    const kickoff = createKickoffStateForTeam('opponent', 1, { kickPower: 20 });
    const layout = createKickoffFormation(kickoff, binding);
    const state = createKickoffReturnState({ kickoff, layout, matchSeed: 1 });
    let clockStarted = false;

    startKickoffRunUp(state);
    for (let frame = 0; frame < 600 && !state.outcome; frame += 1) {
      const events = updateKickoffReturnState(state, {
        deltaSeconds: 1 / 60,
        userInput: { x: 1, z: 0 },
      });
      clockStarted ||= events.clockStarted;
    }

    expect(clockStarted).toBe(true);
    expect(state.clockStartReason).toBe('legalTouch');
    expect(state.outcome).toMatchObject({
      receivingTeam: 'user',
      type: expect.stringMatching(/tackle|outOfBounds|touchdown/),
    });
    expect(state.outcome?.clockElapsedSeconds).toBeGreaterThan(0);
    expect(state.outcome?.receivingStartPosition).toEqual(
      state.outcome
        ? worldSpotToPossessionFieldPosition(state.outcome.deadBallSpot, state.outcome.receivingTeam)
        : undefined,
    );
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
    expect(snapshot.currentFieldPosition).toEqual(result?.receivingStartPosition);
    expect(snapshotGameplayModel(gameplay).drive.lineOfScrimmage.z)
      .toBeCloseTo(
        result ? possessionFieldPositionToOffenseSpot(result.receivingStartPosition).z : 0,
        5,
      );
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

    expect(result?.receivingStartPosition).toEqual(kickoff.result?.receivingStartPosition);
    if (receivingTeam === 'user') {
      expect(snapshot.phase).toBe('userPossession');
      expect(snapshot.currentFieldPosition).toEqual(kickoff.result?.receivingStartPosition);
      expect(snapshotGameplayModel(gameplay).drive.lineOfScrimmage.z)
        .toBeCloseTo(
          kickoff.result
            ? possessionFieldPositionToOffenseSpot(kickoff.result.receivingStartPosition).z
            : 0,
          5,
        );
    } else {
      expect(snapshot.previousDriveSummary?.possession).toBe('opponent');
      expect(snapshot.previousDriveSummary?.startingFieldPosition).toEqual(
        kickoff.result?.receivingStartPosition,
      );
    }
  });

  it('hands a user fielded return to the user offense at the live dead-ball spot', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(findSeedForOpeningKickoff('fielded', 'user'));
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss(resolveCoinTossFace(controller.getSnapshot().deterministicSeed));
    controller.beginOpeningKickoffAfterCoinToss(gameplay);
    const outcome = createReturnOutcome({
      receivingTeam: 'user',
      spot: { x: 6.5, z: -8.75 },
      type: 'tackle',
    });

    const result = controller.completeKickoff(gameplay, outcome);
    const snapshot = controller.getSnapshot();

    expect(result?.receivingStartPosition).toEqual(outcome.receivingStartPosition);
    expect(snapshot.kickoff.returnResult).toEqual(outcome);
    expect(snapshot.phase).toBe('userPossession');
    expect(snapshot.currentFieldPosition).toEqual(outcome.receivingStartPosition);
    expect(snapshotGameplayModel(gameplay).currentBallSpot).toEqual(
      possessionFieldPositionToOffenseSpot(outcome.receivingStartPosition),
    );
    expect(snapshotGameplayModel(gameplay).drive.lineOfScrimmage.z)
      .toBeCloseTo(possessionFieldPositionToOffenseSpot(outcome.receivingStartPosition).z, 5);
  });

  it('feeds an opponent fielded return to the drive simulator at the live dead-ball spot', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(findSeedForOpeningKickoff('fielded', 'opponent'));
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss(oppositeFace(resolveCoinTossFace(controller.getSnapshot().deterministicSeed)));
    controller.beginOpeningKickoffAfterCoinToss(gameplay);
    const outcome = createReturnOutcome({
      receivingTeam: 'opponent',
      spot: { x: -3.25, z: 11.5 },
      type: 'outOfBounds',
    });

    controller.completeKickoff(gameplay, outcome);
    const snapshot = controller.getSnapshot();

    expect(snapshot.previousDriveSummary?.possession).toBe('opponent');
    expect(snapshot.previousDriveSummary?.startingFieldPosition).toEqual(outcome.receivingStartPosition);
    expect(snapshot.kickoff.returnResult).toEqual(outcome);
  });

  it('routes a user kickoff-return touchdown into the extra-point flow', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(findSeedForOpeningKickoff('fielded', 'user'));
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss(resolveCoinTossFace(controller.getSnapshot().deterministicSeed));
    controller.beginOpeningKickoffAfterCoinToss(gameplay);
    const outcome = createReturnOutcome({
      receivingTeam: 'user',
      scoringTeam: 'user',
      spot: { x: 0, z: 51 },
      type: 'touchdown',
    });

    controller.completeKickoff(gameplay, outcome);

    expect(controller.getSnapshot().userScore).toBe(6);
    expect(controller.hasPendingExtraPoint()).toBe(true);
    expect(controller.beginPreparedExtraPoint()).toBe(true);
    expect(controller.getSnapshot().phase).toBe('extraPoint');
  });

  it('resolves an opponent kickoff-return touchdown and schedules the next kickoff', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const controller = createController(findSeedForOpeningKickoff('fielded', 'opponent'));
    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss(oppositeFace(resolveCoinTossFace(controller.getSnapshot().deterministicSeed)));
    controller.beginOpeningKickoffAfterCoinToss(gameplay);
    const outcome = createReturnOutcome({
      receivingTeam: 'opponent',
      scoringTeam: 'opponent',
      spot: { x: 0, z: -51 },
      type: 'touchdown',
    });

    controller.completeKickoff(gameplay, outcome);
    const snapshot = controller.getSnapshot();

    expect(snapshot.opponentScore).toBeGreaterThanOrEqual(6);
    expect(snapshot.phase).toBe('kickoff');
    expect(snapshot.kickoff.reason).toBe('postScore');
    expect(snapshot.kickoff.receivingTeam).toBe('user');
    expect(snapshot.previousDriveSummary?.result).toBe('touchdown');
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

    expect(first.phase).toBe('userPossession');
    expect(first.userScore).toBe(6);
    expect(first.driveSummaries).toHaveLength(0);
    expect(second.phase).toBe('userPossession');

    expect(controller.beginPreparedExtraPoint()).toBe(true);
    controller.resolveExtraPointKick({
      confirmedAtSeconds: 0.5,
      normalizedValue: 0,
    });
    controller.completeExtraPointAndScheduleKickoff(gameplay);
    const afterPat = controller.getSnapshot();

    expect(afterPat.phase).toBe('kickoff');
    expect(afterPat.kickoff.reason).toBe('postScore');
    expect(afterPat.kickoff.receivingTeam).toBe('opponent');
    expect(afterPat.driveSummaries).toHaveLength(1);
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
    expect(audio.startedLines).toEqual(['kickoffReady']);
    expect(director.getSnapshot().phase).toBe('runUp');

    updateKickoffFrames(director, gameplay, matchSnapshot, 20);
    expect(audio.startedLines).toEqual(['kickoffReady', 'kickoffInFlight']);
    expect(['flight', 'fielding', 'returnLive', 'dead']).toContain(director.getSnapshot().phase);

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
  kickingTeam?: MatchPossession;
  matchSeed?: number;
  sequenceIndex?: number;
} = {}) {
  return createKickoffSimulationInput({
    kickAccuracy: options.kickAccuracy ?? 82,
    kickerRosterId: 'test-kicker',
    kickPower: options.kickPower ?? 82,
    kickingTeam: options.kickingTeam ?? 'user',
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

function findResult(
  landingType: 'fielded' | 'touchback',
  kickingTeam: MatchPossession = 'user',
) {
  for (let seed = 1; seed < 5000; seed += 1) {
    const result = simulateKickoff(createInput({
      kickingTeam,
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

function createKickoffStateForTeam(
  kickingTeam: MatchPossession,
  matchSeed = 7200,
  options: { kickAccuracy?: number; kickPower?: number } = {},
): KickoffState {
  const kickerRosterId = `${kickingTeam === 'user' ? DEFAULT_USER_TEAM_ID : DEFAULT_OPPONENT_TEAM_ID}-k-5`;
  const input = createKickoffSimulationInput({
    kickAccuracy: options.kickAccuracy ?? 82,
    kickerRosterId,
    kickPower: options.kickPower ?? 82,
    kickingTeam,
    matchSeed,
    rules: DEFAULT_MATCH_RULES,
    sequenceIndex: 0,
  });

  return {
    completed: false,
    direction: input.direction,
    kickerRatings: {
      kickAccuracy: input.kickAccuracy,
      kickPower: input.kickPower,
    },
    kickerRosterId,
    kickingTeam,
    phase: 'ready',
    reason: 'opening',
    receivingTeam: kickingTeam === 'user' ? 'opponent' : 'user',
    result: simulateKickoff(input),
    returnResult: null,
    sequenceIndex: 0,
  };
}

function createReturnOutcome(options: {
  receivingTeam: MatchPossession;
  scoringTeam?: MatchPossession | null;
  spot: { x: number; z: number };
  type: KickoffReturnOutcome['type'];
}): KickoffReturnOutcome {
  return {
    carrierRosterId: `${options.receivingTeam}-returner`,
    carrierVisualId: `kickoff-${options.receivingTeam}-returner`,
    clockElapsedSeconds: 4.25,
    deadBallSpot: { ...options.spot },
    receivingStartPosition: worldSpotToPossessionFieldPosition(options.spot, options.receivingTeam),
    receivingTeam: options.receivingTeam,
    scoringTeam: options.scoringTeam ?? null,
    type: options.type,
  };
}

async function attachMockHelmet(
  playerVisual: THREE.Object3D,
  _player: PlayerModel,
  _teamUniforms?: PlayerTeamUniforms,
): Promise<boolean> {
  const headAnchor = getPlayerVisualHeadAnchor(playerVisual);
  if (!headAnchor) {
    return false;
  }
  const helmet = new THREE.Group();
  helmet.name = 'low-poly-helmet';
  headAnchor.add(helmet);
  return true;
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
