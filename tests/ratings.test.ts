import { describe, expect, it } from 'vitest';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import {
  calculateOverallRating,
  calculateWeightedRating,
} from '../src/ratings/OverallRatingCalculator';
import {
  createDeterministicPlayerRatings,
  type PlayerRatings,
} from '../src/ratings/PlayerRatings';
import {
  validatePlayerRatings,
  validatePositionRatingProfiles,
  validateTeamRatingsDistinct,
  validateTeamRosterRatings,
  createPlayerWithRatingsForValidation,
} from '../src/ratings/RatingValidation';
import { calculateTeamRatings } from '../src/ratings/TeamRatingCalculator';
import { listTeamStyleProfiles } from '../src/ratings/TeamStyleProfile';
import {
  STARTER_TEAM_ROSTERS,
  getTeamRoster,
  listTeamRosters,
} from '../src/roster/RosterRegistry';

describe('player ratings foundation', () => {
  it('calculates position-specific overall ratings from normalized weights', () => {
    const quarterbackRatings: PlayerRatings = {
      ACC: 70,
      AGI: 70,
      AWR: 80,
      SPD: 72,
      STA: 75,
      STR: 60,
      THA: 90,
      THP: 84,
    };
    const rbRatings: PlayerRatings = {
      ACC: 88,
      AGI: 82,
      AWR: 72,
      BCV: 78,
      BTK: 76,
      CAR: 80,
      COD: 84,
      SPD: 86,
      STA: 78,
      STR: 74,
    };

    expect(validatePositionRatingProfiles()).toEqual([]);
    expect(calculateOverallRating('QB', quarterbackRatings)).toBe(84);
    expect(calculateOverallRating('RB', rbRatings)).toBe(82);
    expect(calculateWeightedRating(quarterbackRatings, { THA: 0.7, THP: 0.3 })).toBe(88);
  });

  it('creates deterministic archetype-driven ratings for stable player identities', () => {
    const first = createDeterministicPlayerRatings({
      archetype: 'fieldGeneral',
      playerId: 'metro-meteors-qb-12',
      position: 'QB',
      teamId: 'metro-meteors',
    });
    const second = createDeterministicPlayerRatings({
      archetype: 'fieldGeneral',
      playerId: 'metro-meteors-qb-12',
      position: 'QB',
      teamId: 'metro-meteors',
    });
    const third = createDeterministicPlayerRatings({
      archetype: 'fieldGeneral',
      playerId: 'lakefront-lights-qb-8',
      position: 'QB',
      teamId: 'lakefront-lights',
    });

    expect(first).toEqual(second);
    expect(first).not.toEqual(third);
    expect(first.THA).toBeGreaterThanOrEqual(70);
    expect(first.THP).toBeGreaterThanOrEqual(70);
  });

  it('validates required attributes, unknown keys, and invalid values', () => {
    const roster = STARTER_TEAM_ROSTERS[0]!;
    const quarterback = roster.players.find((player) => player.footballPosition === 'QB')!;
    const missingRequired = createPlayerWithRatingsForValidation(quarterback, {
      AWR: 80,
      THP: 88,
    });
    const invalidValue = createPlayerWithRatingsForValidation(quarterback, {
      ...quarterback.ratings,
      THA: 103,
      XYZ: 75,
    } as PlayerRatings);

    expect(validatePlayerRatings(missingRequired).map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing required'),
      ]),
    );
    expect(validatePlayerRatings(invalidValue).map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unknown rating attribute XYZ'),
        expect.stringContaining('invalid THA rating 103'),
      ]),
    );
  });

  it('ships every roster player with valid calculated ratings and no stored OVR', () => {
    for (const roster of STARTER_TEAM_ROSTERS) {
      expect(validateTeamRosterRatings(roster), roster.teamId).toEqual([]);
      for (const player of roster.players) {
        expect('OVR' in player.ratings).toBe(false);
        expect(calculateOverallRating(player.footballPosition, player.ratings)).toBeGreaterThanOrEqual(60);
        expect(calculateOverallRating(player.footballPosition, player.ratings)).toBeLessThanOrEqual(92);
      }
    }
  });

  it('calculates distinct six-team aggregate profiles from starters and specialists', () => {
    expect(listTeamStyleProfiles()).toHaveLength(6);
    expect(validateTeamRatingsDistinct(STARTER_TEAM_ROSTERS)).toEqual([]);

    const ratings = Object.fromEntries(
      STARTER_TEAM_ROSTERS.map((roster) => [roster.teamId, calculateTeamRatings(roster)]),
    );

    expect(ratings['metro-meteors']!.passing).toBeGreaterThanOrEqual(ratings['metro-meteors']!.rushing);
    expect(ratings['summit-forge']!.rushing).toBeGreaterThan(ratings['summit-forge']!.passing);
    expect(ratings['ironwood-owls']!.blocking).toBeGreaterThanOrEqual(ratings['metro-meteors']!.blocking);
    expect(ratings['bay-city-current']!.coverage).toBeGreaterThanOrEqual(75);
    expect(ratings['desert-ridge-scorpions']!.passRush).toBeGreaterThanOrEqual(75);
  });

  it('preserves ratings through roster cloning', () => {
    const first = getTeamRoster('metro-meteors')!;
    const second = getTeamRoster('metro-meteors')!;
    const listed = listTeamRosters().find((roster) => roster.teamId === 'metro-meteors')!;

    expect(first.players[0]!.ratings).toEqual(second.players[0]!.ratings);
    expect(first.players[0]!.ratings).toEqual(listed.players[0]!.ratings);
    expect(first.players[0]!.ratings).not.toBe(second.players[0]!.ratings);
  });

  it('does not change gameplay snapshots when ratings are present', () => {
    const first = snapshotGameplayModel(createGameplayModel({ playbookId: '11v11' }));
    const second = snapshotGameplayModel(createGameplayModel({ playbookId: '11v11' }));

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
