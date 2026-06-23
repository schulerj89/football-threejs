export type OnFieldStageId =
  | 'coinToss'
  | 'deadBall'
  | 'fieldGoal'
  | 'kickoff'
  | 'none'
  | 'pregameWarmup'
  | 'scrimmage';

export type OnFieldParticipantGroupId =
  | 'coinTossParticipants'
  | 'fieldGoalParticipants'
  | 'gameplayPlayers'
  | 'kickoffParticipants'
  | 'warmupPlayers';

export interface OnFieldStageVisibility {
  coin: boolean;
  coinTossParticipants: boolean;
  dynamicFieldMarkers: boolean;
  fieldGoalParticipants: boolean;
  gameplayBall: boolean;
  gameplayPlayers: boolean;
  kickoffParticipants: boolean;
  normalOfficials: boolean;
  routeArt: boolean;
  warmupPlayers: boolean;
}

export interface OnFieldStageSnapshot {
  activePrimaryGroup: OnFieldParticipantGroupId | null;
  stageId: OnFieldStageId;
  transitionCount: number;
  visibility: OnFieldStageVisibility;
}

export const ON_FIELD_STAGE_VISIBILITY: Record<OnFieldStageId, OnFieldStageVisibility> = {
  coinToss: {
    coin: true,
    coinTossParticipants: true,
    dynamicFieldMarkers: false,
    fieldGoalParticipants: false,
    gameplayBall: false,
    gameplayPlayers: false,
    kickoffParticipants: false,
    normalOfficials: false,
    routeArt: false,
    warmupPlayers: false,
  },
  deadBall: {
    coin: false,
    coinTossParticipants: false,
    dynamicFieldMarkers: true,
    fieldGoalParticipants: false,
    gameplayBall: true,
    gameplayPlayers: true,
    kickoffParticipants: false,
    normalOfficials: false,
    routeArt: false,
    warmupPlayers: false,
  },
  fieldGoal: {
    coin: false,
    coinTossParticipants: false,
    dynamicFieldMarkers: true,
    fieldGoalParticipants: true,
    gameplayBall: true,
    gameplayPlayers: false,
    kickoffParticipants: false,
    normalOfficials: false,
    routeArt: false,
    warmupPlayers: false,
  },
  kickoff: {
    coin: false,
    coinTossParticipants: false,
    dynamicFieldMarkers: false,
    fieldGoalParticipants: false,
    gameplayBall: true,
    gameplayPlayers: false,
    kickoffParticipants: true,
    normalOfficials: false,
    routeArt: false,
    warmupPlayers: false,
  },
  none: {
    coin: false,
    coinTossParticipants: false,
    dynamicFieldMarkers: false,
    fieldGoalParticipants: false,
    gameplayBall: false,
    gameplayPlayers: false,
    kickoffParticipants: false,
    normalOfficials: false,
    routeArt: false,
    warmupPlayers: false,
  },
  pregameWarmup: {
    coin: false,
    coinTossParticipants: false,
    dynamicFieldMarkers: false,
    fieldGoalParticipants: false,
    gameplayBall: false,
    gameplayPlayers: false,
    kickoffParticipants: false,
    normalOfficials: false,
    routeArt: false,
    warmupPlayers: true,
  },
  scrimmage: {
    coin: false,
    coinTossParticipants: false,
    dynamicFieldMarkers: true,
    fieldGoalParticipants: false,
    gameplayBall: true,
    gameplayPlayers: true,
    kickoffParticipants: false,
    normalOfficials: false,
    routeArt: true,
    warmupPlayers: false,
  },
} as const;

export const ON_FIELD_STAGE_PRIMARY_GROUP: Record<
  OnFieldStageId,
  OnFieldParticipantGroupId | null
> = {
  coinToss: 'coinTossParticipants',
  deadBall: 'gameplayPlayers',
  fieldGoal: 'fieldGoalParticipants',
  kickoff: 'kickoffParticipants',
  none: null,
  pregameWarmup: 'warmupPlayers',
  scrimmage: 'gameplayPlayers',
} as const;
