import type { GameStatsState } from './GameStatsTypes';

export function validateGameStatsState(state: GameStatsState): string[] {
  const issues: string[] = [];

  for (const team of ['user', 'opponent'] as const) {
    const teamStats = state.teams[team];
    if (teamStats.completions > teamStats.passingAttempts) {
      issues.push(`${team} completions exceed attempts`);
    }
    if (teamStats.fieldGoalsMade > teamStats.fieldGoalsAttempted) {
      issues.push(`${team} field goals made exceed attempts`);
    }
    if (teamStats.patMade > teamStats.patAttempts) {
      issues.push(`${team} PAT made exceeds attempts`);
    }
    if (teamStats.thirdDownConversions > teamStats.thirdDownAttempts) {
      issues.push(`${team} third-down conversions exceed attempts`);
    }
    if (teamStats.fourthDownConversions > teamStats.fourthDownAttempts) {
      issues.push(`${team} fourth-down conversions exceed attempts`);
    }

    const playerRows = Object.values(state.players).filter((player) => player.team === team);
    const playerPassingYards = playerRows.reduce((total, player) => total + player.passingYards, 0);
    const playerReceivingYards = playerRows.reduce((total, player) => total + player.receivingYards, 0);
    if (playerPassingYards !== teamStats.passingYards) {
      issues.push(`${team} team passing yards ${teamStats.passingYards} != player passing yards ${playerPassingYards}`);
    }
    if (playerReceivingYards !== teamStats.passingYards) {
      issues.push(`${team} team passing yards ${teamStats.passingYards} != receiving yards ${playerReceivingYards}`);
    }

    for (const player of playerRows) {
      if (player.completions > player.attempts) {
        issues.push(`${player.rosterPlayerId} completions exceed attempts`);
      }
      if (player.receptions > player.targets) {
        issues.push(`${player.rosterPlayerId} receptions exceed targets`);
      }
      if (player.fieldGoalsMade > player.fieldGoalsAttempted) {
        issues.push(`${player.rosterPlayerId} field goals made exceed attempts`);
      }
      if (player.patMade > player.patAttempted) {
        issues.push(`${player.rosterPlayerId} PAT made exceeds attempts`);
      }
    }
  }

  return issues;
}

