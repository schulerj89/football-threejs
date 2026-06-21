export interface RosterContract {
  defensePlayerIds: readonly string[];
  id: string;
  offensePlayerIds: readonly string[];
}

export type PlaybookId = '11v11' | '5v5' | '7v7';

export const FIVE_ON_FIVE_OFFENSE_PLAYER_IDS = [
  'offense-qb',
  'offense-rb',
  'offense-blocker-left',
  'offense-blocker-right',
  'offense-wr',
] as const;

export const FIVE_ON_FIVE_DEFENSE_PLAYER_IDS = [
  'defense-rusher-left',
  'defense-rusher-right',
  'defense-cover-wr',
  'defense-cover-rb',
  'defense-safety',
] as const;

export const FIVE_ON_FIVE_PLAYER_IDS = [
  ...FIVE_ON_FIVE_OFFENSE_PLAYER_IDS,
  ...FIVE_ON_FIVE_DEFENSE_PLAYER_IDS,
] as const;

export const SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS = [
  'offense-qb',
  'offense-rb',
  'offense-center',
  'offense-line-left',
  'offense-line-right',
  'offense-wr-left',
  'offense-wr-right',
] as const;

export const SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS = [
  'defense-line-left',
  'defense-line-right',
  'defense-line-middle',
  'defense-corner-left',
  'defense-corner-right',
  'defense-linebacker',
  'defense-safety',
] as const;

export const SEVEN_ON_SEVEN_PLAYER_IDS = [
  ...SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS,
  ...SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS,
] as const;

export const ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS = [
  'offense-qb',
  'offense-rb',
  'offense-center',
  'offense-line-left',
  'offense-line-right',
  'offense-wr-left',
  'offense-wr-right',
  'offense-tackle-left',
  'offense-tackle-right',
  'offense-tight-end',
  'offense-slot',
] as const;

export const ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS = [
  'defense-line-left',
  'defense-line-middle',
  'defense-line-right',
  'defense-corner-left',
  'defense-corner-right',
  'defense-linebacker',
  'defense-safety',
  'defense-linebacker-left',
  'defense-linebacker-right',
  'defense-linebacker-inside',
  'defense-safety-strong',
] as const;

export const ELEVEN_ON_ELEVEN_PLAYER_IDS = [
  ...ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS,
  ...ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS,
] as const;

export const FIVE_ON_FIVE_ROSTER: RosterContract = {
  defensePlayerIds: FIVE_ON_FIVE_DEFENSE_PLAYER_IDS,
  id: '5v5',
  offensePlayerIds: FIVE_ON_FIVE_OFFENSE_PLAYER_IDS,
} as const;

export const SEVEN_ON_SEVEN_ROSTER: RosterContract = {
  defensePlayerIds: SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS,
  id: '7v7',
  offensePlayerIds: SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS,
} as const;

export const ELEVEN_ON_ELEVEN_ROSTER: RosterContract = {
  defensePlayerIds: ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS,
  id: '11v11',
  offensePlayerIds: ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS,
} as const;

export function getRosterPlayerIds(roster: RosterContract): string[] {
  return [...roster.offensePlayerIds, ...roster.defensePlayerIds];
}
