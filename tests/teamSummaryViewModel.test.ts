import { describe, expect, it } from 'vitest';
import { calculateTeamRatings } from '../src/ratings/TeamRatingCalculator';
import { STARTER_TEAM_ROSTERS } from '../src/roster/RosterRegistry';
import { getRosterPlayer } from '../src/roster/TeamRoster';
import { STARTER_TEAM_PROFILES } from '../src/teams/TeamRegistry';
import {
  createTeamSummaryViewModel,
  resolveRosterPlayerStatus,
} from '../src/ui/TeamSummaryViewModel';

describe('team summary view model', () => {
  it('derives team overview from authoritative roster and ratings data', () => {
    const profile = STARTER_TEAM_PROFILES.find((team) => team.id === 'metro-meteors')!;
    const roster = STARTER_TEAM_ROSTERS.find((teamRoster) => teamRoster.teamId === profile.id)!;
    const summary = createTeamSummaryViewModel(profile, roster);
    const ratings = calculateTeamRatings(roster);

    expect(summary.profile).toBe(profile);
    expect(summary.ratings).toEqual(ratings);
    expect(summary.rosterSize).toBe(roster.players.length);
    expect(summary.startingQuarterback?.id).toBe(roster.offensiveStarterIds[0]);
    expect(summary.colors.map((color) => color.color)).toEqual([
      profile.colors.primary,
      profile.colors.secondary,
      profile.colors.accent,
    ]);
    expect(summary.strengths).toHaveLength(3);
    expect(summary.weaknesses).toHaveLength(2);
    expect(summary.strengths[0]!.value).toBeGreaterThanOrEqual(summary.strengths[1]!.value);
    expect(summary.weaknesses[0]!.value).toBeLessThanOrEqual(summary.weaknesses[1]!.value);
  });

  it('resolves player roster status without changing active lineup data', () => {
    const roster = STARTER_TEAM_ROSTERS[0]!;
    const quarterback = getRosterPlayer(roster, roster.offensiveStarterIds[0]!)!;
    const cornerback = getRosterPlayer(roster, roster.defensiveStarterIds.at(-1)!)!;
    const kicker = getRosterPlayer(roster, roster.kickerId)!;
    const punter = getRosterPlayer(roster, roster.punterId)!;
    const longSnapper = getRosterPlayer(roster, roster.longSnapperId)!;
    const reserve = getRosterPlayer(roster, roster.reserveIds[0]!)!;

    expect(resolveRosterPlayerStatus(roster, quarterback)).toBe('Offensive starter');
    expect(resolveRosterPlayerStatus(roster, cornerback)).toBe('Defensive starter');
    expect(resolveRosterPlayerStatus(roster, kicker)).toBe('Kicker');
    expect(resolveRosterPlayerStatus(roster, punter)).toBe('Punter');
    expect(resolveRosterPlayerStatus(roster, longSnapper)).toBe('Long snapper');
    expect(resolveRosterPlayerStatus(roster, reserve)).toBe('Special teams reserve');
  });
});
