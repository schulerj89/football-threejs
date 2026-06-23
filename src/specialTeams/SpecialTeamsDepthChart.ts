import type { TeamRoster } from '../roster/TeamRoster';

export interface SpecialTeamsDepthChart {
  kickoffCoverage: {
    kickerId: string;
    leftCoverageIds: readonly string[];
    rightCoverageIds: readonly string[];
  };
  kickoffReturn: {
    frontLineIds: readonly string[];
    returnerIds: readonly [string, string];
    secondLineIds: readonly string[];
  };
  placeKick: {
    holderId: string;
    kickerId: string;
    longSnapperId: string;
    protectorIds: readonly string[];
  };
  placeKickDefense: {
    rusherIds: readonly string[];
  };
  teamId: string;
}

export interface SpecialTeamsDepthChartValidationIssue {
  ids: readonly string[];
  message: string;
}

export function createSpecialTeamsDepthChart(roster: TeamRoster): SpecialTeamsDepthChart {
  const returnerIds = selectReturnerIds(roster);
  const coverageIds = selectUniqueRosterIds(
    roster,
    [
      ...roster.reserveIds,
      ...roster.defensiveStarterIds,
      roster.punterId,
      roster.longSnapperId,
      ...roster.offensiveStarterIds,
    ],
    10,
    new Set([roster.kickerId]),
  );
  const returnBlockerIds = selectUniqueRosterIds(
    roster,
    [
      ...roster.reserveIds,
      ...roster.offensiveStarterIds,
      ...roster.defensiveStarterIds,
      roster.punterId,
      roster.longSnapperId,
    ],
    9,
    new Set(returnerIds),
  );
  const protectorIds = selectUniqueRosterIds(
    roster,
    [
      ...roster.offensiveStarterIds.filter((id) => !id.includes('-qb-') && !id.includes('-rb-')),
      ...roster.reserveIds,
      ...roster.defensiveStarterIds,
    ],
    8,
    new Set([roster.kickerId, roster.punterId, roster.longSnapperId]),
  );

  return {
    kickoffCoverage: {
      kickerId: roster.kickerId,
      leftCoverageIds: coverageIds.slice(0, 5),
      rightCoverageIds: coverageIds.slice(5, 10),
    },
    kickoffReturn: {
      frontLineIds: returnBlockerIds.slice(0, 5),
      returnerIds,
      secondLineIds: returnBlockerIds.slice(5, 9),
    },
    placeKick: {
      holderId: roster.punterId,
      kickerId: roster.kickerId,
      longSnapperId: roster.longSnapperId,
      protectorIds,
    },
    placeKickDefense: {
      rusherIds: [...roster.defensiveStarterIds],
    },
    teamId: roster.teamId,
  };
}

export function validateSpecialTeamsDepthChart(
  chart: SpecialTeamsDepthChart,
  roster: TeamRoster,
): SpecialTeamsDepthChartValidationIssue[] {
  const issues: SpecialTeamsDepthChartValidationIssue[] = [];
  const rosterIds = new Set(roster.players.map((player) => player.id));

  validateUnit('kickoff coverage', [
    chart.kickoffCoverage.kickerId,
    ...chart.kickoffCoverage.leftCoverageIds,
    ...chart.kickoffCoverage.rightCoverageIds,
  ], 11, rosterIds, issues);
  validateUnit('kickoff return', [
    ...chart.kickoffReturn.returnerIds,
    ...chart.kickoffReturn.frontLineIds,
    ...chart.kickoffReturn.secondLineIds,
  ], 11, rosterIds, issues);
  validateUnit('place kick', [
    chart.placeKick.kickerId,
    chart.placeKick.holderId,
    chart.placeKick.longSnapperId,
    ...chart.placeKick.protectorIds,
  ], 11, rosterIds, issues);
  validateUnit('place-kick defense', chart.placeKickDefense.rusherIds, 11, rosterIds, issues);

  if (chart.kickoffCoverage.leftCoverageIds.length !== 5) {
    issues.push({
      ids: [...chart.kickoffCoverage.leftCoverageIds],
      message: 'Kickoff coverage must have five players left of the kicker',
    });
  }
  if (chart.kickoffCoverage.rightCoverageIds.length !== 5) {
    issues.push({
      ids: [...chart.kickoffCoverage.rightCoverageIds],
      message: 'Kickoff coverage must have five players right of the kicker',
    });
  }
  if (new Set(chart.kickoffReturn.returnerIds).size !== 2) {
    issues.push({
      ids: [...chart.kickoffReturn.returnerIds],
      message: 'Kickoff returners must be distinct',
    });
  }
  if (
    new Set([
      chart.placeKick.kickerId,
      chart.placeKick.holderId,
      chart.placeKick.longSnapperId,
    ]).size !== 3
  ) {
    issues.push({
      ids: [
        chart.placeKick.kickerId,
        chart.placeKick.holderId,
        chart.placeKick.longSnapperId,
      ],
      message: 'Place-kick kicker, holder, and long snapper must be distinct',
    });
  }
  if (new Set(chart.placeKick.protectorIds).size !== chart.placeKick.protectorIds.length) {
    issues.push({
      ids: [...chart.placeKick.protectorIds],
      message: 'Place-kick protectors must be distinct',
    });
  }
  validateRosterJerseyNumbers(roster, issues);

  return issues;
}

function selectReturnerIds(roster: TeamRoster): [string, string] {
  const reserveReturners = roster.reserveIds.filter((id) => {
    const player = roster.players.find((candidate) => candidate.id === id);
    return player?.footballPosition === 'RB' || player?.footballPosition === 'WR';
  });
  const selected = selectUniqueRosterIds(
    roster,
    [...reserveReturners, ...roster.offensiveStarterIds, ...roster.defensiveStarterIds],
    2,
  );

  return [selected[0]!, selected[1]!];
}

function selectUniqueRosterIds(
  roster: TeamRoster,
  preferredIds: readonly string[],
  count: number,
  excludedIds = new Set<string>(),
): string[] {
  const selected: string[] = [];
  const seen = new Set(excludedIds);
  const allIds = roster.players.map((player) => player.id);

  for (const id of [...preferredIds, ...allIds]) {
    if (seen.has(id) || !allIds.includes(id)) {
      continue;
    }
    selected.push(id);
    seen.add(id);
    if (selected.length >= count) {
      return selected;
    }
  }

  return selected;
}

function validateUnit(
  label: string,
  ids: readonly string[],
  expectedCount: number,
  rosterIds: ReadonlySet<string>,
  issues: SpecialTeamsDepthChartValidationIssue[],
): void {
  if (ids.length !== expectedCount) {
    issues.push({
      ids,
      message: `${label} must have exactly ${expectedCount} players`,
    });
  }

  const seen = new Set<string>();
  for (const id of ids) {
    if (!rosterIds.has(id)) {
      issues.push({
        ids: [id],
        message: `${label} references missing roster player ${id}`,
      });
    }
    if (seen.has(id)) {
      issues.push({
        ids: [id],
        message: `${label} contains duplicate roster player ${id}`,
      });
    }
    seen.add(id);
  }
}

function validateRosterJerseyNumbers(
  roster: TeamRoster,
  issues: SpecialTeamsDepthChartValidationIssue[],
): void {
  const seen = new Map<number, string>();

  for (const player of roster.players) {
    const existingId = seen.get(player.jerseyNumber);
    if (existingId) {
      issues.push({
        ids: [existingId, player.id],
        message: `${roster.teamId} has duplicate jersey #${player.jerseyNumber}`,
      });
    }
    seen.set(player.jerseyNumber, player.id);
  }
}
