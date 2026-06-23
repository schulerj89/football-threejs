export type PerformancePhase =
  | 'input'
  | 'gameplayStateUpdate'
  | 'playerMovementIntegration'
  | 'offensiveAssignments'
  | 'defensiveAi'
  | 'blockingAndEngagement'
  | 'playerCollisionSeparation'
  | 'receiverRouteUpdates'
  | 'passTargetingAndBallSimulation'
  | 'cameraUpdate'
  | 'playerVisualSync'
  | 'proceduralPlayerPosing'
  | 'footballVisualUpdate'
  | 'officialsUpdate'
  | 'sidelineTeamsUpdate'
  | 'crowdBehaviorUpdate'
  | 'crowdInstanceUpdates'
  | 'stadiumUpdate'
  | 'presentationEventProcessing'
  | 'audioUpdate'
  | 'hudDomUpdate'
  | 'rendererRender'
  | 'unclassifiedFrameTime';

export interface PerformancePhaseDefinition {
  displayName: string;
  id: PerformancePhase;
}

export const PERFORMANCE_PHASES: readonly PerformancePhaseDefinition[] = [
  { id: 'input', displayName: 'Input' },
  { id: 'gameplayStateUpdate', displayName: 'Gameplay state update' },
  { id: 'playerMovementIntegration', displayName: 'Player movement integration' },
  { id: 'offensiveAssignments', displayName: 'Offensive assignments' },
  { id: 'defensiveAi', displayName: 'Defensive AI' },
  { id: 'blockingAndEngagement', displayName: 'Blocking and engagement' },
  { id: 'playerCollisionSeparation', displayName: 'Player-player collision and separation' },
  { id: 'receiverRouteUpdates', displayName: 'Receiver-route updates' },
  { id: 'passTargetingAndBallSimulation', displayName: 'Pass targeting and ball simulation' },
  { id: 'cameraUpdate', displayName: 'Camera update' },
  { id: 'playerVisualSync', displayName: 'Player visual synchronization' },
  { id: 'proceduralPlayerPosing', displayName: 'Procedural player posing' },
  { id: 'footballVisualUpdate', displayName: 'Football visual update' },
  { id: 'officialsUpdate', displayName: 'Officials update' },
  { id: 'sidelineTeamsUpdate', displayName: 'Sideline teams update' },
  { id: 'crowdBehaviorUpdate', displayName: 'Crowd behavior update' },
  { id: 'crowdInstanceUpdates', displayName: 'Crowd instance updates' },
  { id: 'stadiumUpdate', displayName: 'Stadium update' },
  { id: 'presentationEventProcessing', displayName: 'Presentation-event processing' },
  { id: 'audioUpdate', displayName: 'Audio update' },
  { id: 'hudDomUpdate', displayName: 'HUD and DOM update' },
  { id: 'rendererRender', displayName: 'renderer.render' },
  { id: 'unclassifiedFrameTime', displayName: 'Unclassified frame time' },
] as const;

export const PERFORMANCE_PHASE_INDEX = Object.freeze(
  Object.fromEntries(PERFORMANCE_PHASES.map((phase, index) => [phase.id, index])),
) as Readonly<Record<PerformancePhase, number>>;

export type PerformanceScenarioName =
  | 'eleven-presnap'
  | 'eleven-run-interior'
  | 'eleven-run-open-field'
  | 'eleven-pass-routes'
  | 'eleven-pass-flight'
  | 'eleven-after-catch'
  | 'eleven-touchdown-presentation'
  | 'eleven-reset-cycle';

export const PERFORMANCE_SCENARIOS: readonly PerformanceScenarioName[] = [
  'eleven-presnap',
  'eleven-run-interior',
  'eleven-run-open-field',
  'eleven-pass-routes',
  'eleven-pass-flight',
  'eleven-after-catch',
  'eleven-touchdown-presentation',
  'eleven-reset-cycle',
] as const;

export const PERFORMANCE_FRAME_THRESHOLDS_MS = {
  target60Fps: 16.67,
  target55Fps: 18.18,
  noticeableFrame: 25,
  longFrame: 33.33,
} as const;

export const PERFORMANCE_REFERENCE_PROFILE = {
  deviceScaleFactor: 1,
  height: 1080,
  sampleDurationMs: 12_000,
  warmupMs: 3_000,
  width: 1920,
} as const;

export const PERFORMANCE_RING_BUFFER_CAPACITY = 4_096;

export const PERFORMANCE_STRUCTURAL_BUDGETS = {
  crowdSpectatorCount: 25_000,
  maxCrowdDrawCalls: 8,
  maxDrawCalls: 450,
  maxGeometries: 200,
  maxMaterials: 90,
  maxShadowCasters: 0,
  maxStadiumDrawCalls: 20,
  maxTextures: 32,
  maxTriangles: 250_000,
  maxVisiblePlayerMeshes: 390,
  playerCount: 22,
} as const;
