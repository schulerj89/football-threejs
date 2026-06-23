import { describe, expect, it } from 'vitest';
import {
  createGameplayModel,
  resetOffensePossession,
  snapshotGameplayModel,
} from '../src/playState';
import {
  createMatchModel,
  enterGameOver,
  enterUserPossession,
  snapshotMatchModel,
} from '../src/match/MatchModel';
import {
  createOpponentYardLinePosition,
  createOwnYardLinePosition,
  possessionFieldPositionToOffenseSpot,
} from '../src/match/FieldPositionModel';
import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
} from '../src/teams/TeamRegistry';
import {
  BROADCAST_SCOREBUG_LAYOUT,
  BROADCAST_SCOREBUG_SHELL_URL,
  getScorebugSafeZone,
} from '../src/ui/ScorebugLayout';
import {
  createBroadcastScorebugViewModel,
  formatMatchClock,
  resolveBallLocationText,
  resolveDownDistanceText,
} from '../src/ui/ScorebugViewModel';
import {
  formatWholeFootballYards,
  formatYardGainForDisplay,
  formatYardsToGoForDisplay,
} from '../src/yardDisplay';

describe('broadcast scorebug', () => {
  it('maps team logos, abbreviations, score, quarter, and clock from the match snapshot', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const match = createMatchModel({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    enterUserPossession(match, createOwnYardLinePosition(25));
    match.userScore = 14;
    match.opponentScore = 10;
    match.quarter = 2;
    match.clock.remainingSeconds = 74.2;

    const viewModel = createBroadcastScorebugViewModel(
      snapshotMatchModel(match),
      snapshotGameplayModel(gameplay),
    );

    expect(viewModel.user.abbreviation).toBe(match.userTeam.abbreviation);
    expect(viewModel.user.logoUrl).toBe(match.userTeam.logoUrl);
    expect(viewModel.opponent.abbreviation).toBe(match.opponentTeam.abbreviation);
    expect(viewModel.opponent.logoUrl).toBe(match.opponentTeam.logoUrl);
    expect(viewModel.user.score).toBe(14);
    expect(viewModel.opponent.score).toBe(10);
    expect(viewModel.quarterText).toBe('Q2');
    expect(viewModel.clockText).toBe('1:15');
    expect(viewModel.possession).toBe('user');
  });

  it('formats normal downs and canonical possession-relative ball location', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const match = createMatchModel({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const fieldPosition = createOpponentYardLinePosition(14);
    enterUserPossession(match, fieldPosition);
    resetOffensePossession(gameplay, possessionFieldPositionToOffenseSpot(fieldPosition));
    gameplay.drive.currentDown = 3;
    gameplay.drive.yardsToFirstDown = 4.4;

    const matchSnapshot = snapshotMatchModel(match);
    const gameplaySnapshot = snapshotGameplayModel(gameplay);

    expect(resolveDownDistanceText(matchSnapshot, gameplaySnapshot)).toBe('3RD & 4');
    expect(resolveBallLocationText(matchSnapshot, gameplaySnapshot)).toBe('OPP 14');
  });

  it('uses phase-specific context labels for kickoff, halftime, and final', () => {
    const gameplay = createGameplayModel({ challengeMode: 'exhibition', playbookId: '11v11' });
    const match = createMatchModel({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const gameplaySnapshot = snapshotGameplayModel(gameplay);

    match.phase = 'kickoff';
    match.kickoff.result = {
      apexHeight: 28,
      flightSeconds: 3.8,
      landingType: 'touchback',
      lateralErrorYards: 0,
      longitudinalErrorYards: 0,
      origin: { x: 0, z: -15 },
      receivingStartPosition: createOwnYardLinePosition(25),
      target: { x: 0, z: 50 },
      uncertaintyRadiusYards: 0,
    };
    expect(resolveDownDistanceText(snapshotMatchModel(match), gameplaySnapshot)).toBe('KICKOFF');
    expect(resolveBallLocationText(snapshotMatchModel(match), gameplaySnapshot)).toBe('OWN 25');

    match.phase = 'halftime';
    expect(resolveDownDistanceText(snapshotMatchModel(match), gameplaySnapshot)).toBe('HALFTIME');
    expect(resolveBallLocationText(snapshotMatchModel(match), gameplaySnapshot)).toBe('LOCKER ROOM');

    enterGameOver(match);
    const finalViewModel = createBroadcastScorebugViewModel(snapshotMatchModel(match), gameplaySnapshot);
    expect(finalViewModel.quarterText).toBe('FINAL');
    expect(finalViewModel.downDistanceText).toBe('FINAL');
    expect(finalViewModel.ballLocationText).toBe('FINAL');
  });

  it('uses the selected shell asset and bounded safe zones for dynamic HTML overlays', () => {
    expect(BROADCAST_SCOREBUG_SHELL_URL).toBe('/branding/scorebug/football-js-scorebug-shell.webp');
    expect(BROADCAST_SCOREBUG_LAYOUT.imageWidth).toBe(1536);
    expect(BROADCAST_SCOREBUG_LAYOUT.imageHeight).toBe(512);

    const ids = new Set(BROADCAST_SCOREBUG_LAYOUT.safeZones.map((zone) => zone.id));
    expect(ids.size).toBe(BROADCAST_SCOREBUG_LAYOUT.safeZones.length);
    for (const zone of BROADCAST_SCOREBUG_LAYOUT.safeZones) {
      expect(zone.normalized.x).toBeGreaterThanOrEqual(0);
      expect(zone.normalized.y).toBeGreaterThanOrEqual(0);
      expect(zone.normalized.x + zone.normalized.width).toBeLessThanOrEqual(1);
      expect(zone.normalized.y + zone.normalized.height).toBeLessThanOrEqual(1);
    }
    expect(getScorebugSafeZone('userScore').normalized.width).toBeGreaterThan(0);
    expect(getScorebugSafeZone('opponentScore').normalized.width).toBeGreaterThan(0);
    expect(getScorebugSafeZone('userTimeouts').normalized.width).toBeGreaterThan(0);
    expect(getScorebugSafeZone('opponentTimeouts').normalized.width).toBeGreaterThan(0);
  });

  it('keeps paired scorebug zones dimensionally matched and mirrored', () => {
    const pairs = [
      ['userLogo', 'opponentLogo'],
      ['userAbbreviation', 'opponentAbbreviation'],
      ['userScore', 'opponentScore'],
      ['userTimeouts', 'opponentTimeouts'],
    ] as const;

    for (const [userId, opponentId] of pairs) {
      const user = getScorebugSafeZone(userId).normalized;
      const opponent = getScorebugSafeZone(opponentId).normalized;
      const userCenterX = user.x + user.width / 2;
      const opponentCenterX = opponent.x + opponent.width / 2;
      const userCenterY = user.y + user.height / 2;
      const opponentCenterY = opponent.y + opponent.height / 2;

      expect(opponent.width).toBeCloseTo(user.width, 6);
      expect(opponent.height).toBeCloseTo(user.height, 6);
      expect(userCenterX + opponentCenterX).toBeCloseTo(1, 6);
      expect(opponentCenterY).toBeCloseTo(userCenterY, 6);
    }
  });

  it('keeps clock formatting stable and non-negative', () => {
    expect(formatMatchClock(180)).toBe('3:00');
    expect(formatMatchClock(74.2)).toBe('1:15');
    expect(formatMatchClock(-4)).toBe('0:00');
  });

  it('formats player-facing football yardage as whole yards', () => {
    expect(formatYardsToGoForDisplay(7.7)).toBe('8');
    expect(formatYardsToGoForDisplay(0)).toBe('GOAL');
    expect(formatYardGainForDisplay(2.5)).toBe('+3 yards');
    expect(formatYardGainForDisplay(-2.5)).toBe('-3 yards');
    expect(formatWholeFootballYards(14.49)).toBe('14');
  });
});
