export type PlayerAttributeKey =
  | 'ACC'
  | 'AGI'
  | 'AWR'
  | 'BCV'
  | 'BSH'
  | 'BTK'
  | 'CAR'
  | 'CIT'
  | 'COD'
  | 'CTH'
  | 'FMV'
  | 'KAC'
  | 'KPW'
  | 'MCV'
  | 'PBK'
  | 'PMV'
  | 'PRC'
  | 'PUR'
  | 'RBK'
  | 'RTE'
  | 'SPD'
  | 'STA'
  | 'STR'
  | 'TAK'
  | 'THA'
  | 'THP'
  | 'ZCV';

export interface PlayerAttributeDefinition {
  readonly description: string;
  readonly key: PlayerAttributeKey;
  readonly label: string;
}

export const PLAYER_ATTRIBUTE_DEFINITIONS: readonly PlayerAttributeDefinition[] = [
  { description: 'awareness', key: 'AWR', label: 'Awareness' },
  { description: 'speed', key: 'SPD', label: 'Speed' },
  { description: 'acceleration', key: 'ACC', label: 'Acceleration' },
  { description: 'agility', key: 'AGI', label: 'Agility' },
  { description: 'strength', key: 'STR', label: 'Strength' },
  { description: 'stamina', key: 'STA', label: 'Stamina' },
  { description: 'throw power', key: 'THP', label: 'Throw Power' },
  { description: 'throw accuracy', key: 'THA', label: 'Throw Accuracy' },
  { description: 'carrying', key: 'CAR', label: 'Carrying' },
  { description: 'ball-carrier vision', key: 'BCV', label: 'Ball-Carrier Vision' },
  { description: 'change of direction', key: 'COD', label: 'Change of Direction' },
  { description: 'break tackle', key: 'BTK', label: 'Break Tackle' },
  { description: 'catching', key: 'CTH', label: 'Catching' },
  { description: 'route running', key: 'RTE', label: 'Route Running' },
  { description: 'catch in traffic', key: 'CIT', label: 'Catch In Traffic' },
  { description: 'pass blocking', key: 'PBK', label: 'Pass Blocking' },
  { description: 'run blocking', key: 'RBK', label: 'Run Blocking' },
  { description: 'tackling', key: 'TAK', label: 'Tackling' },
  { description: 'pursuit', key: 'PUR', label: 'Pursuit' },
  { description: 'block shedding', key: 'BSH', label: 'Block Shedding' },
  { description: 'play recognition', key: 'PRC', label: 'Play Recognition' },
  { description: 'power move', key: 'PMV', label: 'Power Move' },
  { description: 'finesse move', key: 'FMV', label: 'Finesse Move' },
  { description: 'man coverage', key: 'MCV', label: 'Man Coverage' },
  { description: 'zone coverage', key: 'ZCV', label: 'Zone Coverage' },
  { description: 'kick power', key: 'KPW', label: 'Kick Power' },
  { description: 'kick accuracy', key: 'KAC', label: 'Kick Accuracy' },
] as const;

export const PLAYER_ATTRIBUTE_KEYS = PLAYER_ATTRIBUTE_DEFINITIONS.map((definition) => definition.key);

const PLAYER_ATTRIBUTE_KEY_SET = new Set<string>(PLAYER_ATTRIBUTE_KEYS);

export function isPlayerAttributeKey(value: unknown): value is PlayerAttributeKey {
  return typeof value === 'string' && PLAYER_ATTRIBUTE_KEY_SET.has(value);
}

export function isPlayerRatingValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 99;
}
