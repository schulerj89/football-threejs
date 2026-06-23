import { describe, expect, it } from 'vitest';
import { createCenterSnapPlacement } from '../../../src/ballSpotting';
import { INITIAL_BALL_SPOT } from '../../../src/fieldSpec';
import { resolveElevenOnElevenPreviewFormation } from '../../../src/elevenOnElevenFormation';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
} from '../../../src/presentation/players/FootballPlayerVisualFactory';
import {
  FIELD_GOAL_DEVELOPMENT_FORMATION,
  createKickoffFootballFormation,
  createScrimmageFootballFormation,
  getRegisteredFootballFormation,
  listRegisteredFootballFormations,
  validateResolvedFootballFormationContract,
} from '../../../src/presentation/stage/FootballFormationFamilies';
import type { KickoffFormationParticipantPlacement } from '../../../src/specialTeams/KickoffFormation';

describe('FootballFormationFamilies', () => {
  it('registers a static development field-goal fixture with no gameplay authority', () => {
    const fixture = getRegisteredFootballFormation(FIELD_GOAL_DEVELOPMENT_FORMATION.id);

    expect(fixture).not.toBeNull();
    expect(fixture?.family).toBe('fieldGoal');
    expect(validateResolvedFootballFormationContract(FIELD_GOAL_DEVELOPMENT_FORMATION)).toEqual([]);
    expect(FIELD_GOAL_DEVELOPMENT_FORMATION.participantPlacements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'field-goal-holder', presentationOnly: true }),
        expect.objectContaining({ id: 'field-goal-long-snapper', presentationOnly: true }),
        expect.objectContaining({ id: 'field-goal-kicker', presentationOnly: true }),
      ]),
    );
    expect(FIELD_GOAL_DEVELOPMENT_FORMATION.participantPlacements.every(
      (placement) => placement.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
    )).toBe(true);
  });

  it('converts a resolved scrimmage formation into the shared family contract', () => {
    const resolvedFormation = resolveElevenOnElevenPreviewFormation(
      createCenterSnapPlacement(INITIAL_BALL_SPOT),
    );
    const contract = createScrimmageFootballFormation('scrimmage-preview', resolvedFormation);

    expect(contract.family).toBe('scrimmage');
    expect(contract.ballPlacement).toEqual(resolvedFormation.snapPlacement.spot);
    expect(contract.participantPlacements).toHaveLength(22);
    expect(contract.participantPlacements.every((placement) => !placement.presentationOnly)).toBe(true);
    expect(contract.participantPlacements.every(
      (placement) => placement.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
    )).toBe(true);
    expect(validateResolvedFootballFormationContract(contract)).toEqual([]);
  });

  it('converts kickoff presentation placements into a kickoff family contract', () => {
    const kickoffPlacements: KickoffFormationParticipantPlacement[] = [
      placement('kickoff-0-kicker', 'kicker-a', 'K', 'kicker', 'runner', 'offense', 'user', 0, -35),
      placement('kickoff-0-coverage-1', 'coverage-a', 'OLB', 'coverage-left-1', 'defender', 'offense', 'user', -4, -41),
      placement('kickoff-0-returner-0', 'returner-a', 'WR', 'returner-left', 'receiver', 'defense', 'opponent', -4, 20),
      placement('kickoff-0-returner-1', 'returner-b', 'RB', 'returner-right', 'receiver', 'defense', 'opponent', 4, 20),
    ];

    const contract = createKickoffFootballFormation(
      'kickoff-preview',
      kickoffPlacements,
      { x: 0, z: -35 },
    );

    expect(contract.family).toBe('kickoff');
    expect(contract.participantPlacements).toHaveLength(kickoffPlacements.length);
    expect(contract.participantPlacements.every((candidate) => candidate.presentationOnly)).toBe(true);
    expect(contract.participantPlacements.every(
      (candidate) => candidate.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
    )).toBe(true);
    expect(validateResolvedFootballFormationContract(contract)).toEqual([]);
  });

  it('lists registered formations as defensive copies', () => {
    const [fixture] = listRegisteredFootballFormations();
    expect(fixture?.id).toBe(FIELD_GOAL_DEVELOPMENT_FORMATION.id);

    if (!fixture) {
      return;
    }
    fixture.participantPlacements[0]!.position.x = 999;

    expect(
      getRegisteredFootballFormation(FIELD_GOAL_DEVELOPMENT_FORMATION.id)
        ?.participantPlacements[0]?.position.x,
    ).not.toBe(999);
  });

  it('keeps scrimmage, kickoff, and field-goal family contracts independent', () => {
    const resolvedFormation = resolveElevenOnElevenPreviewFormation(
      createCenterSnapPlacement(INITIAL_BALL_SPOT),
    );
    const scrimmage = createScrimmageFootballFormation('scrimmage-cycle', resolvedFormation);
    const kickoff = createKickoffFootballFormation(
      'kickoff-cycle',
      [
        placement('kickoff-0-kicker', 'kicker-a', 'K', 'kicker', 'runner', 'offense', 'user', 0, -35),
        placement('kickoff-0-returner-0', 'returner-a', 'WR', 'returner-left', 'receiver', 'defense', 'opponent', -4, 20),
      ],
      { x: 0, z: -35 },
    );

    expect(scrimmage.family).toBe('scrimmage');
    expect(kickoff.family).toBe('kickoff');
    expect(FIELD_GOAL_DEVELOPMENT_FORMATION.family).toBe('fieldGoal');
    expect(scrimmage.participantPlacements.every((candidate) => !candidate.presentationOnly)).toBe(true);
    expect(kickoff.participantPlacements.every((candidate) => candidate.presentationOnly)).toBe(true);
    expect(FIELD_GOAL_DEVELOPMENT_FORMATION.participantPlacements.every((candidate) => candidate.presentationOnly)).toBe(true);
    expect([
      ...scrimmage.participantPlacements,
      ...kickoff.participantPlacements,
      ...FIELD_GOAL_DEVELOPMENT_FORMATION.participantPlacements,
    ].every((candidate) => candidate.visualProfileId === FOOTBALL_PLAYER_VISUAL_PROFILE_ID)).toBe(true);
  });
});

function placement(
  visualId: string,
  rosterPlayerId: string,
  footballPosition: KickoffFormationParticipantPlacement['footballPosition'],
  slotId: KickoffFormationParticipantPlacement['slotId'],
  role: KickoffFormationParticipantPlacement['role'],
  gameplayTeam: 'defense' | 'offense',
  teamSide: 'opponent' | 'user',
  x: number,
  z: number,
): KickoffFormationParticipantPlacement {
  return {
    appearanceId: rosterPlayerId,
    facingRadians: gameplayTeam === 'offense' ? 0 : Math.PI,
    footballPosition,
    formationFamily: 'kickoff',
    gameplayTeam,
    jerseyNumber: 7,
    phase: gameplayTeam === 'offense' ? 'kicking' : 'receiving',
    position: { x, z },
    presentationOnly: true,
    role,
    rosterPlayerId,
    scale: 1,
    slotId,
    team: teamSide,
    teamSide,
    visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
    visualId,
  };
}
