import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { listTeamProfiles } from '../src/teams/TeamRegistry';

interface PlayerSnapshot {
  collisionRadius: number;
  currentState: 'idle' | 'userControlled' | 'movingToLane' | 'runningRoute' | 'pursuing' | 'engaged';
  facingRadians: number;
  id: string;
  position: { x: number; z: number };
  role: 'runner' | 'quarterback' | 'receiver' | 'blocker' | 'defender' | 'coverageDefender';
  team: 'offense' | 'defense';
  velocity: { x: number; z: number };
}

interface FootballSpot {
  x: number;
  z: number;
}

interface Vector3Snapshot {
  x: number;
  y: number;
  z: number;
}

interface PassAuditSnapshot {
  actualClosestApproach: {
    ball: Vector3Snapshot;
    receiver: FootballSpot;
  } | null;
  ballHeightAtClosestApproach: number | null;
  horizontalMissDistance: number | null;
  predictedFlightSeconds: number;
  predictedReceiverPosition: FootballSpot;
  predictedReceiverRouteDistance: number;
  predictedTargetPosition: Vector3Snapshot;
  releasePosition: Vector3Snapshot;
  resultReason:
    | 'aboveCatchHeight'
    | 'belowCatchHeight'
    | 'catch'
    | 'flightFinished'
    | 'inFlight'
    | 'outOfBounds'
    | 'outsideCatchRadius';
  selectedReceiverId: string;
}

interface PlayResultSnapshot {
  endingBallSpot: FootballSpot;
  id: number;
  reason: 'tackle' | 'outOfBounds' | 'touchdown' | 'incomplete' | 'sack';
  scoringTeam: 'offense' | null;
  startingBallSpot: FootballSpot;
  type: 'tackle' | 'outOfBounds' | 'touchdown' | 'incomplete' | 'sack';
  yardsGained: number;
}

interface DriveSnapshot {
  currentDown: 1 | 2 | 3 | 4;
  firstDownMarker: FootballSpot;
  lastDriveResult:
    | null
    | {
        nextDriveStartSpot: FootballSpot;
        reason: 'touchdown' | 'turnoverOnDowns';
        type: 'touchdown' | 'turnoverOnDowns';
      };
  lineOfScrimmage: FootballSpot;
  state: 'active' | 'over';
  yardsToFirstDown: number;
}

interface GameplaySnapshot {
  activePlayStartSpot: FootballSpot | null;
  ball: {
    possession: { kind: 'none' } | { kind: 'player'; playerId: string };
    position: { x: number; y: number; z: number };
    state:
      | { kind: 'dead' }
      | { kind: 'possessed'; playerId: string }
      | {
          durationSeconds: number;
          elapsedSeconds: number;
          kind: 'inFlight';
          maxFlightTimeSeconds: number;
          peakHeight: number;
          start: { x: number; y: number; z: number };
          target: { x: number; y: number; z: number };
        }
      | { kind: 'caught'; playerId: string }
      | { kind: 'incomplete' };
  };
  blocking: {
    engagements: Array<{ blockerId: string; defenderId: string }>;
  };
  currentBallSpot: FootballSpot;
  drive: DriveSnapshot;
  lastPlayResult: PlayResultSnapshot | null;
  nextBallSpot: FootballSpot;
  player: PlayerSnapshot;
  players: PlayerSnapshot[];
  playbookId: '11v11' | '5v5' | '7v7';
  selectedPlay: {
    displayName: string;
    id:
      | 'inside-run'
      | 'inside-zone-11'
      | 'inside-zone-7'
      | 'outside-run'
      | 'outside-zone-7'
      | 'quick-pass'
      | 'quick-pass-7'
      | 'slant-flat'
      | 'spread-quick-11'
      | 'twin-slants-flat';
    kind: 'run' | 'pass';
    initialMovementDirection: FootballSpot;
  };
  selectedReceiver: { displayName: string; id: string } | null;
  passAudit: PassAuditSnapshot | null;
  passAttempted: boolean;
  forwardPassEligible: boolean;
  passFeedback: 'pastLineOfScrimmage' | null;
  playState: 'preSnap' | 'live' | 'dead' | 'gameOver';
  score: number;
  scoreAttack: {
    durationSeconds: number;
    finalScore: number | null;
    remainingSeconds: number;
    state: 'ready' | 'running' | 'expired' | 'gameOver';
  };
}

interface HelmetAssetSnapshot {
  assetId: string;
  attachedPlayerIds: string[];
  errorMessage: string | null;
  faceguardMeshNames: string[];
  shellMeshNames: string[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
}

interface CameraSnapshot {
  activeShotName?:
    | 'firstDownCrowdCutaway'
    | 'prePlayOrbit180'
    | 'touchdownCrowdCutaway'
    | 'touchdownOrbit360'
    | null;
  cameraPosition: { x: number; y: number; z: number };
  formationBounds?: {
    center: { x: number; z: number };
    max: { x: number; z: number };
    min: { x: number; z: number };
    playerIds: string[];
    size: { x: number; z: number };
  };
  focusPosition: { x: number; y: number; z: number };
  lookTargetPosition?: { x: number; y: number; z: number };
  mode: 'cinematicBroadcast' | 'offensePerspective' | 'tacticalOrthographic';
  orbitCenter?: { x: number; y: number; z: number } | null;
  orbitRadius?: number | null;
  presentationPhase?:
    | 'deadBallResult'
    | 'liveCarrier'
    | 'passFlight'
    | 'preSnapEstablish'
    | 'returnToPreSnap'
    | 'touchdownResult'
    | 'transitionToGameplay';
  restoreCamera?: string | null;
  shotProgress?: number | null;
  state:
    | 'carrierFollow'
    | 'cinematicBroadcast'
    | 'deadBall'
    | 'gameOver'
    | 'passFlight'
    | 'preSnapFormation'
    | 'resetLineOfScrimmage'
    | 'tacticalOverview';
  targetPosition: { x: number; y: number; z: number };
}

interface PlayerBodyVisualSnapshot {
  appearance: {
    skinColor: number;
    skinToneId: string;
  };
  bodyBounds: {
    center: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    min: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  bodyStyle: 'box' | 'mannequin';
  bodyTriangleCount: number;
  combinedBounds: {
    center: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    min: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  headBounds: null | {
    center: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    min: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  headHelmetClearance: number | null;
  helmetBounds: null | {
    center: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    min: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  helmetShoulderVerticalGap: number | null;
  meshesPerPlayer: number;
  minimumBodyY: number;
  neckBounds: null | {
    center: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    min: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  playerId: string;
  shoulderWidth: number;
  totalHeight: number;
  uniqueBodyGeometryCount: number;
  uniqueBodyMaterialCount: number;
}

interface BallVisualSnapshot {
  bounds: {
    center: Vector3Snapshot;
    max: Vector3Snapshot;
    min: Vector3Snapshot;
    size: Vector3Snapshot;
  };
  diameter: number;
  length: number;
  longAxisWorld: Vector3Snapshot;
  materialCount: number;
  meshCount: number;
  style: 'football' | 'sphere';
  triangleCount: number;
  visible: boolean;
}

interface AppearanceAuditSnapshot {
  entries: Array<{
    headBounds: PlayerBodyVisualSnapshot['headBounds'];
    headHelmetClearance: number | null;
    helmetBounds: PlayerBodyVisualSnapshot['helmetBounds'];
    playerId: string;
    skinToneId: string;
  }>;
  playerCount: number;
  skinToneCount: number;
}

interface PlayerPoseSnapshot {
  intent: 'locomotion' | 'neutral' | 'readyDefense' | 'readyOffense';
  phaseOffsetRadians: number;
  phaseRadians: number;
  playerId: string;
  speed: number;
}

interface FormationPreviewSnapshot {
  boundarySide: 'left' | 'right';
  fieldSide: 'left' | 'right';
  issues: Array<{ message: string; playerIds: string[] }>;
  labels: Array<{
    alignment: 'backfield' | 'defense' | 'line' | 'unknown';
    distanceFromLineOfScrimmage: number;
    distanceFromSnap: number;
    eligible: boolean;
    footballPosition:
      | 'C'
      | 'CB'
      | 'DL'
      | 'FS'
      | 'ILB'
      | 'LG'
      | 'OLB'
      | 'QB'
      | 'RB'
      | 'RG'
      | 'RT'
      | 'LT'
      | 'SLOT'
      | 'SS'
      | 'TE'
      | 'WR'
      | null;
    id: string;
  }>;
  mode: '11v11' | '7v7';
  players: PlayerSnapshot[];
  preferredSide: 'left' | 'right';
  snapLane: 'leftHash' | 'middle' | 'rightHash';
  snapPlacement: { lane: 'leftHash' | 'middle' | 'rightHash'; spot: FootballSpot };
}

interface RenderMetricsSnapshot {
  calls: number;
  crowdInstanceCount: number;
  frameTimeMs: number;
  footballMeshCount: number;
  geometries: number;
  officialMeshCount: number;
  playerBodyMeshCount: number;
  playerCount: number;
  sceneMaterialCount: number;
  sceneMeshCount: number;
  textures: number;
  triangles: number;
}

interface CameraFramingSnapshot {
  framedPlayerIds: string[];
  marginNdc?: number;
  players?: Array<{
    ndcBounds: {
      max: { x: number; y: number; z: number };
      min: { x: number; y: number; z: number };
    };
    playerId: string;
    withinMargin: boolean;
  }>;
  unframedPlayerIds: string[];
}

interface PresentationAuditSnapshot {
  allFeetGrounded: boolean;
  allHelmetsAttached: boolean;
  allPlayersInsideFramingMargin: boolean;
  cameraMode: 'cinematicBroadcast' | 'offensePerspective' | 'tacticalOrthographic';
  cameraState: CameraSnapshot['state'];
  enabled: true;
  formationIssueCount: number;
  framingMarginNdc: number;
  issues: string[];
  playerMotionEnabled: boolean;
  players: Array<{
    body: PlayerBodyVisualSnapshot;
    feetOnOrAboveField: boolean;
    helmetAttached: boolean;
    helmetParentName: string | null;
    helmetShoulderGapStable: boolean;
    playerId: string;
    restingLimbSymmetryError: number;
    rootMatchesGameplay: boolean;
    significantGeometryBelowField: boolean;
    withinFramingMargin: boolean;
  }>;
  presentationPhase: CameraSnapshot['presentationPhase'] | null;
  renderMetrics: RenderMetricsSnapshot | null;
  snapLane: 'leftHash' | 'middle' | 'rightHash';
  stableHelmetGaps: boolean;
  state: 'locomotionPreview' | 'preSnap';
}

interface RouteArtRendererSnapshot {
  auditEnabled: boolean;
  enabled: boolean;
  rebuildKey: string;
  routeCount: number;
  routes: Array<{
    audit: null | {
      completionPercentage: number;
      crossTrackErrorYards: number;
      distanceAlongRoute: number;
      nearestPoint: FootballSpot;
      receiverId: string;
      routeId: string;
      segmentIndex: number;
      totalLength: number;
    };
    points: FootballSpot[];
    receiverId: string;
    routeId: string;
    selected: boolean;
  }>;
  visible: boolean;
}

interface AudioRuntimeSnapshot {
  activeAudioNodeCount: number;
  activeBuses: string[];
  activeLoops: string[];
  activeOneShots: number;
  activeSourceCount: number;
  announcerEnabled: boolean;
  busGains: Record<string, number>;
  captionsEnabled: boolean;
  commentary?: {
    captionsEnabled: boolean;
    crowdDuckState: {
      ducked: boolean;
      duckingGain: number;
    };
    currentCaption: string | null;
    currentClip: null | {
      assetId: string;
      caption: string;
      category: string;
      eventId: string;
      priority: number;
    };
    enabled: boolean;
    queue: Array<{ assetId: string; category: string; priority: number }>;
  };
  contextState: 'closed' | 'running' | 'suspended' | 'unavailable';
  crowdDuckingGain: number;
  decodedAssetIds: string[];
  decodedBufferBytes: number;
  enabled: boolean;
  lastUnlockError: string | null;
  loadedAssetIds: string[];
  loadedCompressedBytes: number;
  longestLoadedClipSeconds: number | null;
  missingOptionalAssetIds: string[];
  muted: boolean;
  pageActive: boolean;
  preparedMediaElementSourceCount: number;
  userGestureUnlocked: boolean;
  eventHistory: Array<{
    assetId: string | null;
    eventId: string;
    eventType: string;
    reason: string | null;
    status: 'played' | 'suppressed';
    triggerTimeSeconds: number;
  }>;
  recentEvents: Array<{ type: string }>;
  streamedAssetIds: string[];
  titleMusic?: {
    assetId: string;
    attempted: boolean;
    handoffRequested: boolean;
    loopActive: boolean;
    loopGain: number;
    state: string;
  };
}

type PregameSmokeShotId =
  | 'matchupCombined'
  | 'matchupWide'
  | 'opponentTeamPan'
  | 'quarterbackSpotlight'
  | 'stadiumEstablish'
  | 'transitionToGameplay'
  | 'userTeamTunnelOrSideline'
  | 'weatherAndField';

interface PregamePresentationSnapshot {
  activeCommentary: string | null;
  completed: boolean;
  currentShot: PregameSmokeShotId | null;
  activeSubject?: string | null;
  activeTeam?: 'opponent' | 'user' | null;
  crowdState?: {
    activeLoops: readonly string[];
    duckingGain: number;
    gain: number;
  };
  musicState?: {
    gain: number;
    loopActive: boolean;
    state: string;
  };
  phase: 'completed' | 'idle' | 'running' | 'skipped';
  presentationCloneCount?: number;
  progress: number;
  sequence: PregameSmokeShotId[];
  skipState: 'available' | 'completed' | 'idle' | 'skipped';
  sidelineCounts?: {
    sideline: number;
    tunnel: number;
  };
  targetGameplayCamera: CameraSnapshot['mode'];
}

interface CrowdPreviewSnapshot {
  actualSpectatorCount: number;
  averageFrameTimeMs: number;
  benchmark: {
    active: boolean;
    completed: boolean;
    currentCount: number | null;
    reports: Array<{
      actualSpectatorCount: number;
      averageFrameTimeMs: number;
      crowdDrawCalls: number;
      crowdTriangles: number;
      estimatedInstanceBufferBytes: number;
      estimatedStaticBufferBytes: number;
      frameCount: number;
      minimumObservedFps: number;
      requestedSpectatorCount: number;
      rendererMemory: { geometries: number; textures: number };
    }>;
  };
  cameraView: 'close' | 'endZone' | 'sideline' | 'wide';
  crowdDrawCalls: number;
  crowdFullness: 'full' | 'sparse' | 'standard';
  crowdTriangles: number;
  estimatedInstanceBufferBytes: number;
  estimatedStaticBufferBytes: number;
  farInstanceCount: number;
  farMosaicSeatCount: number;
  frameCount: number;
  gameplayPlayerCount: number;
  geometryCount: number;
  materialCount: number;
  minimumObservedFps: number;
  nearInstanceCount: number;
  perInstanceStorage: {
    colorBytes: number;
    customReactionDataBytes: number;
    farMeshesPerSpectator: number;
    nearMeshesPerSpectator: number;
    transformMatrixBytes: number;
  };
  requestedSpectatorCount: number;
  rendererMemory: { geometries: number; textures: number };
  rendererRender: { calls: number; triangles: number };
  textureCount: number;
}

interface CrowdPresentationSnapshot {
  actualSpectatorCount: number;
  averageFrameTimeMs: number;
  crowdDrawCalls: number;
  crowdFullness: 'full' | 'sparse' | 'standard';
  crowdTriangles: number;
  density: 'high' | 'low' | 'medium';
  deterministicSubsets: boolean;
  estimatedInstanceBufferBytes: number;
  estimatedStaticBufferBytes: number;
  farInstanceCount: number;
  farMosaicSeatCount: number;
  frameCount: number;
  geometryCount: number;
  materialCount: number;
  minimumObservedFps: number;
  nearInstanceCount: number;
  noPerSpectatorObject3D: boolean;
  pageActive: boolean;
  perInstanceStorage: {
    colorBytes: number;
    customReactionDataBytes: number;
    farMeshesPerSpectator: number;
    nearMeshesPerSpectator: number;
    transformMatrixBytes: number;
  };
  reactionHistory: Array<{
    eventId: string;
    eventType: string;
    reason: string | null;
    state: string | null;
    status: 'started' | 'suppressed';
  }>;
  reactionState: 'anticipation' | 'disappointment' | 'firstDown' | 'idle' | 'touchdown';
  reactionUpdateCount: number;
  reactionUpdateHz: number;
  reactionsEnabled: boolean;
  rendererMemory: { geometries: number; textures: number };
  rendererRender: { calls: number; triangles: number };
  requestedSpectatorCount: number;
  settings: {
    crowdDensity: 'high' | 'low' | 'medium';
    crowdReactionsEnabled: boolean;
    crowdVisualsEnabled: boolean;
  };
  textureCount: number;
  visualsEnabled: boolean;
}

interface PresentationHoldSnapshot {
  active: boolean;
  duplicateSuppressionCount: number;
  history: Array<{
    eventId: string;
    eventType: string;
    reason: string | null;
    status: 'released' | 'started' | 'suppressed';
  }>;
  reason: 'firstDown' | 'touchdown' | null;
  remainingSeconds: number;
  skippedCount: number;
  touchdown: {
    blockedReason: string | null;
    cameraComplete: boolean;
    commentaryClip: string | null;
    commentaryComplete: boolean;
    commentaryExpected: boolean;
    commentaryRemainingSeconds: number;
    commentaryStarted: boolean;
    commentaryUnavailable: boolean;
    crowdMinimumComplete: boolean;
    currentShot: string | null;
    elapsedSeconds: number;
    maximumTimeReached: boolean;
    minimumHoldSeconds: number;
    minimumTimeComplete: boolean;
    releaseReason: string | null;
    resultId: string;
  } | null;
}

interface GamePresentationRuntimeSnapshot {
  history: Array<{
    cameraShot: string | null;
    crowdReaction: string | null;
    emittedEventTypes: string[];
    gameplayResultId: string | null;
    resetCompleted: boolean;
  }>;
  recentEvents: Array<{ type: string }>;
}

interface SevenAuditSnapshot {
  activePlay: string;
  activePresentationEvent: string | null;
  playerOverlapWarnings: string[];
  resourceCounts: {
    activeAudioNodes: number;
    drawCalls: number;
    geometries: number;
    materialCount: number;
    playerVisualCount: number;
    presentationHistoryCount: number;
    textures: number;
    triangles: number;
  };
  rosterCount: number;
  routeErrors: Array<{ exceedsTolerance: boolean; receiverId: string }>;
  snapLane: string;
  staleEngagements: string[];
}

interface ElevenAuditSnapshot {
  activePlay: string;
  activePresentationEvent: string | null;
  cameraContainment: {
    framedPlayerIds: string[];
    unframedPlayerIds: string[];
  };
  formationLegality: {
    backfieldCount: number;
    defenseCount: number;
    eligiblePlayerIds: string[];
    formationIssueCount: number;
    formationIssues: string[];
    lineCount: number;
    offenseCount: number;
  };
  outOfBoundsWarnings: string[];
  playerOverlapWarnings: string[];
  resourceCounts: {
    activeAudioNodes: number;
    activeCameraShot: string | null;
    activePresentationHold: boolean;
    crowdReaction: string | null;
    drawCalls: number;
    geometries: number;
    helmetInstanceCount: number;
    materialCount: number;
    playerModelCount: number;
    playerVisualCount: number;
    presentationHistoryCount: number;
    textures: number;
    triangles: number;
  };
  rosterCount: number;
  routeErrors: Array<{ exceedsTolerance: boolean; receiverId: string }>;
  snapLane: string;
  staleReferences: string[];
}

interface SevenAuditResetCycleResult {
  after: SevenAuditResetCycleResourceSnapshot;
  before: SevenAuditResetCycleResourceSnapshot;
  cycles: number;
}

interface SevenAuditResetCycleResourceSnapshot {
  activeAudioNodes: number;
  activePlayerRootCount: number;
  crowdInstanceCount: number;
  debugOverlayCount: number;
  footballMeshCount: number;
  geometryCount: number;
  materialCount: number;
  officialMeshCount: number;
  presentationHistoryCount: number;
  stadiumMeshCount: number;
  textureCount: number;
  visualRootCount: number;
}

interface ElevenAuditResetCycleResult {
  after: ElevenAuditResetCycleResourceSnapshot;
  before: ElevenAuditResetCycleResourceSnapshot;
  cycles: number;
}

interface ElevenAuditResetCycleResourceSnapshot extends SevenAuditResetCycleResourceSnapshot {
  activeCameraShot: string | null;
  activePresentationHold: boolean;
  crowdReaction: string | null;
  helmetInstanceCount: number;
  officialCount: number;
  stadiumGeometryCount: number;
}

interface PresentationHardeningAuditSnapshot {
  activeCameraShot: CameraSnapshot['activeShotName'];
  audio: {
    activeAudioNodes: number;
    announcerEnabled: boolean;
    captionsEnabled: boolean;
    compressedAudioBytes: number;
    decodedAudioBytes: number;
    enabled: boolean;
  };
  cameraMode: CameraSnapshot['mode'];
  cinematics: 'brief' | 'full' | 'off';
  crowd: CrowdPresentationSnapshot | null;
  currentResultType: PlayResultSnapshot['type'] | null;
  duplicateEventSuppressions: number;
  hold: PresentationHoldSnapshot;
  matrix: {
    announcerEnabled: boolean;
    audioEnabled: boolean;
    cameraMode: CameraSnapshot['mode'];
    captionsEnabled: boolean;
    cinematics: 'brief' | 'full' | 'off';
    crowdReactionsEnabled: boolean;
    crowdVisualsEnabled: boolean;
  };
  renderMetrics: RenderMetricsSnapshot | null;
  resultEventCounts: Record<'firstDown' | 'incomplete' | 'sack' | 'touchdown' | 'turnoverOnDowns', number>;
}

interface OfficialsPresentationSnapshot {
  debugLabelsEnabled: boolean;
  enabled: boolean;
  officials: Array<{
    currentPosition: FootballSpot;
    distanceFromBall: number;
    id: string;
    poseIntent: 'neutral' | 'touchdown' | 'tracking';
    role: string;
    targetPosition: FootballSpot;
    updateState: 'deadBall' | 'formation' | 'tracking';
  }>;
  targetUpdateHz: number;
  visibleOfficialCount: number;
  visualMetrics: {
    geometryCount: number;
    materialCount: number;
    meshCount: number;
    triangleCount: number;
  };
}

interface ControlledPlayerLabelSnapshot {
  labels: Array<{
    displayName: string | null;
    footballPosition: string | null;
    gameplayPlayerId: string | null;
    jerseyNumber: number | null;
    kind: 'controlled' | 'selectedReceiver';
    labelPosition: { x: number; y: number; z: number };
    rosterPlayerId: string | null;
    visibilityReason: string;
    visible: boolean;
  }>;
  textureCacheKeys: string[];
  textureCacheSize: number;
  visibleLabelCount: number;
}

interface GameExperienceSettingsSnapshot {
  announcerEnabled: boolean;
  announcerVolume: number;
  audioEnabled: boolean;
  captionsEnabled: boolean;
  cinematics: 'brief' | 'full' | 'off';
  controlledPlayerLabelEnabled: boolean;
  crowdAudioEnabled: boolean;
  crowdDensity: 'high' | 'low' | 'medium';
  crowdReactionsEnabled: boolean;
  crowdVolume: number;
  crowdVisualsEnabled: boolean;
  debugToolsEnabled: boolean;
  gameplayCamera: 'cinematic' | 'offense' | 'tactical';
  gameMode: 'exhibition' | 'scoreAttack';
  masterVolume: number;
  matchDifficulty: 'allPro' | 'pro' | 'rookie';
  musicVolume: number;
  muted: boolean;
  officialsDebugLabels: boolean;
  officialsEnabled: boolean;
  playerMotionEnabled: boolean;
  playbookId: '11v11' | '5v5' | '7v7';
  preset: 'broadcast' | 'custom' | 'performance';
  quarterLengthSeconds: number;
  qualityMode: 'adaptive60' | 'lockedBroadcast' | 'lockedPerformance';
  routeArtEnabled: boolean;
  selectedReceiverLabelEnabled: boolean;
  stadiumEnabled: boolean;
}

interface MatchSnapshot {
  canContinue: boolean;
  canPunt: boolean;
  canRematch: boolean;
  clock: {
    quarterDurationSeconds: number;
    remainingSeconds: number;
    running: boolean;
  };
  coinToss: {
    completed: boolean;
    firstHalfOpeningPossession: 'opponent' | 'user' | null;
    phase: 'animating' | 'awaitingCall' | 'notStarted' | 'resolved';
    resolvedFace: 'heads' | 'tails' | null;
    secondHalfOpeningPossession: 'opponent' | 'user' | null;
    tossIndex: number;
    userCall: 'heads' | 'tails' | null;
    winner: 'opponent' | 'user' | null;
  };
  kickoff: {
    activeCommentary?: string | null;
    animationProgress?: number;
    ballPosition?: Vector3Snapshot | null;
    completed: boolean;
    direction: -1 | 1;
    kickerRosterId: string | null;
    kickingTeam: 'opponent' | 'user' | null;
    landingType?: 'fielded' | 'touchback' | null;
    phase: 'completed' | 'flight' | 'idle' | 'ready' | 'result';
    reason: 'opening' | 'postScore' | 'secondHalf' | null;
    receivingStartSpot?: FootballSpot | null;
    receivingTeam: 'opponent' | 'user' | null;
    result: null | {
      apexHeight: number;
      flightSeconds: number;
      landingType: 'fielded' | 'touchback';
      origin: FootballSpot;
      receivingStartSpot: FootballSpot;
      target: FootballSpot;
      uncertaintyRadiusYards: number;
    };
    reticleVisible?: boolean;
    sequenceIndex: number;
  };
  currentFieldPosition: FootballSpot;
  deterministicSeed: number;
  driveNumber: number;
  gameOverReason: 'clockExpired' | null;
  openingPossession: 'opponent' | 'user';
  opponentScore: number;
  phase:
    | 'coinToss'
    | 'gameOver'
    | 'halftime'
    | 'kickoff'
    | 'opponentDriveSimulation'
    | 'pregame'
    | 'quarterBreak'
    | 'userPossession';
  possession: 'opponent' | 'user';
  previousDriveSummary: null | {
    id: string;
    possession: 'opponent' | 'user';
    result:
      | 'endOfGame'
      | 'endOfHalf'
      | 'fieldGoal'
      | 'punt'
      | 'touchdown'
      | 'turnover'
      | 'turnoverOnDowns';
  };
  quarter: number;
  secondHalfPossession: 'opponent' | 'user';
  userScore: number;
  winner: 'opponent' | 'tie' | 'user' | null;
}

interface KickoffPresentationSnapshot {
  activeCommentary: string | null;
  animationProgress: number;
  ballPosition: Vector3Snapshot | null;
  completed: boolean;
  direction: -1 | 1 | null;
  kickerRosterId: string | null;
  kickingTeam: 'opponent' | 'user' | null;
  landingType: 'fielded' | 'touchback' | null;
  phase: 'completed' | 'flight' | 'idle' | 'ready' | 'result';
  reason?: 'opening' | 'postScore' | 'secondHalf' | null;
  receivingStartSpot: FootballSpot | null;
  receivingTeam: 'opponent' | 'user' | null;
  result: MatchSnapshot['kickoff']['result'];
  reticleVisible: boolean;
  sequenceIndex: number | null;
}

interface StadiumSnapshot {
  drawCalls: number;
  enabled: boolean;
  geometryCount: number;
  imageMaterialsEnabled: boolean;
  lowerTierRows: number;
  materialCount: number;
  seatCount: number;
  textureCount: number;
  triangles: number;
  upperTierEnabled: boolean;
}

interface QualityDebugSnapshot {
  limitingSubsystem: string | null;
  monitor: {
    currentFps: number;
    currentFrameTimeMs: number;
    ignoredReason: string | null;
    medianFrameTimeMs: number;
    p95FrameTimeMs: number;
    ready: boolean;
    sampleCount: number;
  };
  pixelRatio: number;
  quality: {
    currentTier: 'balanced' | 'broadcastHigh' | 'performance';
    mode: 'adaptive60' | 'lockedBroadcast' | 'lockedPerformance';
    profile: {
      displayName: string;
      maxPixelRatio: number;
      tier: 'balanced' | 'broadcastHigh' | 'performance';
    };
    recentDowngradeReason: string | null;
    recentUpgradeReason: string | null;
  };
}

interface GameExperienceSnapshot {
  assetReadiness: {
    audioEnabled: boolean;
    crowdSpectatorCount: number;
    crowdVisualsAllocated: boolean;
    decodedAudioBytes: number;
    loadedAudioAssetIds: string[];
    loadedCompressedAudioBytes: number;
    missingOptionalAudioAssetIds: string[];
    streamedAudioAssetIds: string[];
  };
  developmentModes: {
    appearanceAudit: boolean;
    crowdPreview: boolean;
    formationPreview: boolean;
    passAudit: boolean;
    presentationAudit: boolean;
    routeAudit: boolean;
    shotPreview: boolean;
  };
  effectivePreset: 'broadcast' | 'custom' | 'performance';
  finalSettings: GameExperienceSettingsSnapshot;
  persistedSettings: {
    customSettings: GameExperienceSettingsSnapshot | null;
    preset: 'broadcast' | 'custom' | 'performance';
    settings: GameExperienceSettingsSnapshot | null;
    version: number;
  };
  queryOverrides: Partial<GameExperienceSettingsSnapshot>;
}

test('shows the title screen, opens match setup, and holds gameplay until Play Game', async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.title-screen')).toBeVisible();
  await expect(page.locator('.title-content h1')).toHaveText('Football JS');
  await expect(page.locator('.title-primary-actions button')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('.gameplay-hud')).toBeHidden();
  await expect(page.locator('.play-call-ui')).toBeHidden();
  await expectNoDebugHelpers(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('.title-settings-overlay')).toBeVisible();
  await expect(page.getByLabel('Settings').getByText('Music volume')).toBeVisible();
  await expect(page.locator('.title-screen').getByLabel('Quarter length')).toBeVisible();
  await expect(page.locator('.title-screen').getByLabel('Difficulty')).toBeVisible();
  await expect(page.locator('.title-screen').getByLabel('Game mode')).toHaveCount(0);
  await expect(page.locator('.title-screen').getByLabel('Regression playbook')).toHaveCount(0);
  await expect(page.locator('.title-screen .team-customization-panel')).toHaveCount(1);
  await expect(page.locator('.title-screen .team-customization-panel .team-selector-grid')).toHaveCount(0);
  await expect(page.locator('.title-screen .roster-preview-panel')).toHaveCount(0);
  await expect(page.getByText('Officials debug labels')).toHaveCount(0);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.userGestureUnlocked)).toBe(true);
  await expect.poll(() =>
    getAudioSnapshot(page).then((snapshot) =>
      snapshot.streamedAssetIds.includes('football-js-title'),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.title-settings-overlay')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.title-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });

  const initial = await getGameplaySnapshot(page);
  const initialMatch = await getMatchSnapshot(page);
  expect(initialMatch).toMatchObject({
    clock: {
      remainingSeconds: 180,
      running: false,
    },
    phase: 'pregame',
    userScore: 0,
    opponentScore: 0,
  });
  await page.waitForTimeout(500);
  const afterDelay = await getGameplaySnapshot(page);
  const matchAfterDelay = await getMatchSnapshot(page);
  expect(afterDelay.playState).toBe('preSnap');
  expect(afterDelay.scoreAttack).toMatchObject({
    remainingSeconds: 120,
    state: 'ready',
  });
  expect(afterDelay.player.position).toEqual(initial.player.position);
  expect(matchAfterDelay?.phase).toBe('pregame');

  await page.getByRole('button', { name: 'Start Game' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.title-screen')).toBeHidden();
  await expect(page.locator('.match-setup-screen')).toBeVisible();
  await expect(page.locator('body[data-app-phase="matchSetup"]')).toBeAttached();
  await expect(page.locator('.gameplay-hud')).toBeHidden();
  await expect(page.locator('.play-call-ui')).toBeHidden();
  await expect(page.locator('.match-team-card')).toHaveCount(2);
  await expect(page.locator('.match-setup-customize')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your Team' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Opponent' })).toBeVisible();
  await expect(page.locator('.match-team-card[data-side="user"] .team-helmet-badge')).toBeVisible();
  const registeredTeamNames = listTeamProfiles().map((profile) => profile.displayName);
  await expect(page.locator('.match-team-card[data-side="user"] select').first().locator('option'))
    .toHaveText(registeredTeamNames);
  await expect(page.locator('.match-team-card[data-side="opponent"] select').first().locator('option'))
    .toHaveText(registeredTeamNames);
  await expect(page.locator('.match-team-card[data-side="user"] .match-team-quarterback')).toContainText(/^QB .+ #\d+$/);
  const userHelmetShell = await page.locator('.match-team-card[data-side="user"] .team-helmet-badge').evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--helmet-shell').trim(),
  );
  await expect(page.locator('.match-team-card[data-side="user"] .match-team-swatch[aria-label^="Helmet"]')).toHaveAttribute(
    'aria-label',
    new RegExp(userHelmetShell.replace('#', '#')),
  );
  const userTeamSelect = page.locator('.match-team-card[data-side="user"] select').first();
  const opponentTeamSelect = page.locator('.match-team-card[data-side="opponent"] select').first();
  const originalUserTeam = await userTeamSelect.inputValue();
  await page.getByRole('button', { name: 'Next Your Team team' }).click();
  await expect(userTeamSelect).not.toHaveValue(originalUserTeam);
  await page.getByRole('button', { name: 'Previous Your Team team' }).click();
  await expect(userTeamSelect).toHaveValue(originalUserTeam);
  const userUniformSelect = page.locator('.match-team-card[data-side="user"] select').nth(1);
  await page.getByRole('button', { name: 'Next Your Team uniform' }).click();
  await expect(userUniformSelect).toHaveValue('away');
  const awayHelmetShell = await page.locator('.match-team-card[data-side="user"] .team-helmet-badge').evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--helmet-shell').trim(),
  );
  await expect(page.locator('.match-team-card[data-side="user"] .match-team-swatch[aria-label^="Helmet"]')).toHaveAttribute(
    'aria-label',
    new RegExp(awayHelmetShell.replace('#', '#')),
  );
  await page.getByRole('button', { name: 'Previous Your Team uniform' }).click();
  await expect(userUniformSelect).toHaveValue('home');
  const originalOpponentTeam = await opponentTeamSelect.inputValue();
  await opponentTeamSelect.selectOption(await userTeamSelect.inputValue());
  await expect(page.getByRole('button', { name: 'Play Game' })).toBeDisabled();
  await expect(page.locator('.matchup-summary-warning')).toContainText('Choose two different teams.');
  await opponentTeamSelect.selectOption(originalOpponentTeam);
  await expect(page.getByRole('button', { name: 'Play Game' })).toBeEnabled();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.match-setup-screen')).toBeHidden();
  await expect(page.locator('.title-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('.match-setup-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Play Game' }).click();
  await expect(page.locator('.match-setup-screen')).toBeHidden();
  await expect(page.locator('body[data-app-phase="pregamePresentation"]')).toBeAttached();
  await expect(page.locator('.gameplay-hud')).toBeHidden();
  await expect(page.locator('.play-call-ui')).toBeHidden();
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.userGestureUnlocked)).toBe(true);
  await expect.poll(() =>
    getAudioSnapshot(page).then((snapshot) => snapshot.activeLoops.includes('football-js-title')),
  ).toBe(true);
  await expect.poll(() =>
    getAudioSnapshot(page).then((snapshot) => snapshot.titleMusic?.state),
  ).toBe('handoff');
  await expect.poll(() => getPregamePresentationSnapshot(page)).toMatchObject({
    currentShot: 'stadiumEstablish',
    phase: 'running',
    skipState: 'available',
  });
  const pregamePresentation = await getPregamePresentationSnapshot(page);
  expect(pregamePresentation.sequence).toEqual([
    'stadiumEstablish',
    'matchupWide',
    'weatherAndField',
    'quarterbackSpotlight',
    'transitionToGameplay',
  ]);
  expect(pregamePresentation.musicState).toMatchObject({
    loopActive: expect.any(Boolean),
    state: expect.any(String),
  });
  expect(pregamePresentation.crowdState).toMatchObject({
    activeLoops: expect.any(Array),
    duckingGain: expect.any(Number),
    gain: expect.any(Number),
  });
  expect(pregamePresentation.sidelineCounts?.sideline).toBeGreaterThanOrEqual(0);
  expect(pregamePresentation.sidelineCounts?.tunnel).toBeGreaterThanOrEqual(0);
  expect(pregamePresentation.presentationCloneCount).toEqual(expect.any(Number));
  await expectNoDebugHelpers(page);

  const started = await getGameplaySnapshot(page);
  const experience = await getGameExperienceSnapshot(page);
  expect(started).toMatchObject({
    playState: 'preSnap',
    playbookId: '11v11',
    scoreAttack: {
      remainingSeconds: 120,
      state: 'ready',
    },
  });
  expect(started.players).toHaveLength(22);
  await expect.poll(() => getMatchSnapshot(page)).toMatchObject({
    clock: {
      remainingSeconds: 180,
      running: false,
    },
    phase: 'pregame',
    possession: 'user',
    quarter: 1,
  });
  await page.waitForTimeout(500);
  expect((await getGameplaySnapshot(page)).playState).toBe('preSnap');
  await expect.poll(() => getMatchSnapshot(page)).toMatchObject({
    clock: {
      remainingSeconds: 180,
      running: false,
    },
  });
  await page.keyboard.press('Space');
  await expect(page.locator('body[data-app-phase="coinToss"]')).toBeAttached();
  await expect(page.locator('.coin-toss-ui')).toBeVisible();
  await expect.poll(() => getMatchSnapshot(page)).toMatchObject({
    coinToss: {
      completed: false,
      phase: 'awaitingCall',
      userCall: null,
    },
    phase: 'coinToss',
  });
  await page.keyboard.press('T');
  await page.keyboard.press('Enter');
  await expect.poll(() => getMatchSnapshot(page)).toMatchObject({
    coinToss: {
      completed: true,
      resolvedFace: 'tails',
      userCall: 'tails',
      winner: 'user',
    },
    phase: 'coinToss',
  });
  await expect(page.locator('.coin-toss-ui')).toContainText('will receive', { timeout: 10_000 });
  await expect.poll(() => getMatchSnapshot(page), { timeout: 15_000 }).toMatchObject({
    clock: {
      remainingSeconds: 180,
      running: false,
    },
    coinToss: {
      completed: true,
      firstHalfOpeningPossession: 'user',
      secondHalfOpeningPossession: 'opponent',
      winner: 'user',
    },
    phase: 'kickoff',
    possession: 'user',
    quarter: 1,
  });
  await expect(page.locator('body[data-app-phase="kickoff"]')).toBeAttached();
  const scheduledKickoff = await getMatchSnapshot(page);
  expect(scheduledKickoff?.kickoff).toMatchObject({
    kickingTeam: 'opponent',
    receivingTeam: 'user',
    reason: 'opening',
    result: expect.objectContaining({
      target: expect.objectContaining({
        x: expect.any(Number),
        z: expect.any(Number),
      }),
    }),
  });
  await expect.poll(() => getKickoffSnapshot(page).then((snapshot) => snapshot.phase), {
    timeout: 15_000,
  }).toBe('flight');
  await expect.poll(() => getKickoffSnapshot(page).then((snapshot) => snapshot.reticleVisible), {
    timeout: 5_000,
  }).toBe(true);
  await expect.poll(() => getMatchSnapshot(page), { timeout: 20_000 }).toMatchObject({
    clock: {
      remainingSeconds: 180,
      running: false,
    },
    phase: 'userPossession',
    possession: 'user',
    quarter: 1,
  });
  await expect(page.locator('body[data-app-phase="gameplay"]')).toBeAttached();
  await expect(page.locator('.gameplay-hud')).toBeVisible();
  await expect(page.locator('.play-call-ui')).toBeVisible();
  await expectNoDebugHelpers(page);
  await expect.poll(() => getGameplaySnapshot(page).then((snapshot) => snapshot.playState)).toBe('preSnap');
  expect(started.selectedPlay).toMatchObject({
    displayName: 'Inside Zone 11',
    id: 'inside-zone-11',
  });
  expect(experience.finalSettings).toMatchObject({
    cinematics: 'brief',
    crowdVisualsEnabled: true,
    gameplayCamera: 'offense',
    gameMode: 'exhibition',
    matchDifficulty: 'pro',
    officialsEnabled: true,
    preset: 'broadcast',
    quarterLengthSeconds: 180,
    stadiumEnabled: true,
  });
  const stadium = await getStadiumSnapshot(page);
  expect(stadium.enabled).toBe(true);
  expect(stadium.drawCalls).toBeGreaterThan(0);
  const crowd = await getCrowdPresentationSnapshot(page);
  expect(crowd).toMatchObject({
    actualSpectatorCount: 5000,
    crowdFullness: 'full',
    density: 'low',
    farMosaicSeatCount: 4500,
    nearInstanceCount: 500,
    visualsEnabled: true,
  });
  const officials = await getOfficialsSnapshot(page);
  expect(officials).toMatchObject({
    debugLabelsEnabled: false,
    enabled: true,
    visibleOfficialCount: 2,
  });
  await expect(page.locator('.officials-debug-overlay')).toHaveCount(0);
  await expect.poll(async () => {
    const labels = await getControlledPlayerLabelSnapshot(page);
    return labels.labels.find((label) => label.kind === 'controlled');
  }).toMatchObject({
    displayName: 'Miles Redd',
    gameplayPlayerId: 'offense-rb',
    jerseyNumber: 24,
    visible: true,
  });
  const labelSnapshot = await getControlledPlayerLabelSnapshot(page);
  expect(labelSnapshot.textureCacheSize).toBe(1);
  expect(labelSnapshot.textureCacheKeys[0]).toContain('metro-meteors-rb-24');
  await page.waitForTimeout(100);
  expect((await getControlledPlayerLabelSnapshot(page)).textureCacheSize).toBe(1);
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-settings-panel')).toBeVisible();
  await page.locator('.pause-settings-panel').getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.pause-settings-panel')).toBeHidden();
});

test('keeps the gameplay camera still while scrolling pause settings', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 620 });
  await page.goto('/?debug=1&readback=1&camera=cinematic&cinematics=brief');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect.poll(() => getGameplaySnapshot(page).then((snapshot) => snapshot.playState)).toBe('preSnap');

  await page.keyboard.press('Escape');
  const panel = page.locator('.pause-settings-panel');
  const card = page.locator('.pause-settings-card');
  await expect(panel).toBeVisible();
  await expect(card).toBeVisible();

  const before = await getCameraSnapshot(page);
  const initialScrollTop = await card.evaluate((element) => element.scrollTop);
  await card.hover();
  await page.mouse.wheel(0, 620);
  await page.waitForTimeout(500);

  const after = await getCameraSnapshot(page);
  const finalScrollTop = await card.evaluate((element) => element.scrollTop);
  expect(finalScrollTop).toBeGreaterThan(initialScrollTop);
  expect(vector3Distance(after.cameraPosition, before.cameraPosition)).toBeLessThan(0.001);
  expect(vector3Distance(after.targetPosition, before.targetPosition)).toBeLessThan(0.001);
});

test('cycles title and match setup without exposing debug helpers', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  for (let cycle = 0; cycle < 25; cycle += 1) {
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page.locator('.match-setup-screen')).toBeVisible();
    await expect(page.locator('body[data-app-phase="matchSetup"]')).toBeAttached();
    await expectNoDebugHelpers(page);

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('.title-screen')).toBeVisible();
    await expect(page.locator('body[data-app-phase="title"]')).toBeAttached();
    await expect(page.locator('.gameplay-hud')).toBeHidden();
    await expect(page.locator('.play-call-ui')).toBeHidden();
    await expectNoDebugHelpers(page);
  }
});

test('starts the performance preset without visual crowd or cinematics', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.title-screen').getByLabel('Presentation preset').selectOption('performance');
  await page.keyboard.press('Escape');
  await expect(page.locator('.title-settings-overlay')).toBeHidden();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('.match-setup-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Play Game' }).click();

  await expect(page.locator('.title-screen')).toBeHidden();
  const experience = await getGameExperienceSnapshot(page);
  expect(experience.finalSettings).toMatchObject({
    cinematics: 'off',
    crowdReactionsEnabled: false,
    crowdVisualsEnabled: false,
    gameplayCamera: 'offense',
    officialsEnabled: false,
    preset: 'performance',
  });
  expect(await getOptionalCrowdPresentationSnapshot(page)).toBeNull();
});

test('exposes adaptive quality debug state without gameplay mutation', async ({ page }) => {
  await page.goto('/?qualityDebug=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.performance-debug-overlay')).toBeVisible();

  const before = await getGameplaySnapshot(page);
  const quality = await getQualityDebugSnapshot(page);

  expect(quality.quality.mode).toBe('adaptive60');
  expect(quality.quality.currentTier).toBe('broadcastHigh');
  expect(quality.quality.profile.maxPixelRatio).toBeGreaterThanOrEqual(1);
  expect(quality.pixelRatio).toBeGreaterThan(0);

  await page.waitForTimeout(120);
  const after = await getGameplaySnapshot(page);
  expect(after.players).toHaveLength(before.players.length);
  expect(after.playState).toBe(before.playState);
  expect(after.selectedPlay.id).toBe(before.selectedPlay.id);
});

test('keeps the 5v5 legacy development mode available through query overrides', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&camera=tactical&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await expect(page.locator('.title-screen')).toBeHidden();
  const gameplay = await getGameplaySnapshot(page);
  const experience = await getGameExperienceSnapshot(page);
  expect(experience.finalSettings.gameMode).toBe('scoreAttack');
  expect(gameplay.playbookId).toBe('5v5');
  expect(gameplay.players).toHaveLength(10);
  expect(gameplay.selectedPlay.displayName).toBe('Inside Run');
  await expect(page.locator('.play-card')).toHaveCount(4);
});

test('persists title-screen settings across reloads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.title-screen').getByLabel('Presentation preset').selectOption('performance');
  await page.locator('.title-screen').getByLabel('Quarter length').selectOption('300');
  await page.locator('.title-screen').getByLabel('Difficulty').selectOption('rookie');

  await page.reload();
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.title-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('.title-screen').getByLabel('Presentation preset')).toHaveValue('performance');
  await expect(page.locator('.title-screen').getByLabel('Quarter length')).toHaveValue('300');
  await expect(page.locator('.title-screen').getByLabel('Difficulty')).toHaveValue('rookie');
  await expect(page.locator('.title-screen').getByLabel('Game mode')).toHaveCount(0);
  await expect(page.locator('.title-screen').getByLabel('Regression playbook')).toHaveCount(0);
});

test('toggles runtime debug tools with F1 and persists the title-screen debug setting', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.debug-panel')).toBeHidden();

  await page.keyboard.press('F1');
  await expect(page.locator('.debug-panel')).toBeVisible();
  await expect(page.locator('.debug-feature-row')).toHaveCount(21);
  await expect(page.locator('.debug-feature-row span')).toContainText([
    '11v11 audit',
    '7v7 audit',
    'Appearance',
    'Audio',
    'Camera',
    'Commentary',
    'Crowd',
    'Field',
    'Formation',
    'General metrics',
    'Memory',
    'Officials',
    'Passing',
    'Player motion',
    'Pregame',
    'Presentation',
    'Presentation hardening',
    'Quality',
    'Roster labels',
    'Route',
    'Sideline teams',
  ]);
  await page.locator('.debug-feature-row').filter({ hasText: 'General metrics' }).getByRole('checkbox').check();
  await expect(page.locator('.debug-overlay')).toBeVisible();
  await page.locator('.debug-feature-row').filter({ hasText: 'General metrics' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.debug-overlay')).toBeHidden();
  await page.locator('.debug-feature-row').filter({ hasText: 'Camera' }).getByRole('checkbox').check();
  await expect(page.locator('.debug-overlay')).toContainText('CAM');
  await page.locator('.debug-feature-row').filter({ hasText: 'Camera' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.debug-overlay')).toBeHidden();
  await page.locator('.debug-feature-row').filter({ hasText: 'Field' }).getByRole('checkbox').check();
  await expect(page.locator('.field-audit-overlay')).toContainText('FIELD AUDIT');
  await expect(page.locator('.field-audit-overlay')).toContainText('ISSUES none');
  await page.locator('.debug-feature-row').filter({ hasText: 'Field' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.field-audit-overlay')).toHaveCount(0);
  await page.locator('.debug-feature-row').filter({ hasText: 'Formation' }).getByRole('checkbox').check();
  await expect(page.locator('.formation-audit-overlay')).toContainText('FORMATION AUDIT');
  await page.locator('.debug-feature-row').filter({ hasText: 'Formation' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.formation-audit-overlay')).toHaveCount(0);
  await page.locator('.debug-feature-row').filter({ hasText: 'Route' }).getByRole('checkbox').check();
  await expect(page.locator('.route-audit-overlay')).toContainText('ROUTE AUDIT');
  await page.locator('.debug-feature-row').filter({ hasText: 'Route' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.route-audit-overlay')).toHaveCount(0);
  await page.locator('.debug-feature-row').filter({ hasText: 'Passing' }).getByRole('checkbox').check();
  await expect(page.locator('.pass-audit-overlay')).toContainText('PASS AUDIT');
  await page.locator('.debug-feature-row').filter({ hasText: 'Passing' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.pass-audit-overlay')).toHaveCount(0);
  await page.locator('.debug-feature-row').filter({ hasText: 'Crowd' }).getByRole('checkbox').check();
  await expect(page.locator('.crowd-presentation-overlay')).toContainText('CROWD PRESENTATION');
  await page.locator('.debug-feature-row').filter({ hasText: 'Crowd' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.crowd-presentation-overlay')).toHaveCount(0);
  await page.locator('.debug-feature-row').filter({ hasText: 'Memory' }).getByRole('checkbox').check();
  await expect(page.locator('.memory-debug-panel')).toBeVisible();
  await expect(page.locator('.memory-debug-panel')).toContainText('RENDERER COUNTERS');
  await expect(page.locator('.memory-debug-panel')).toContainText('stadium');
  await expect(page.locator('.memory-debug-panel')).toContainText('officials');
  const memorySnapshot = await page.evaluate(() => window.__footballDebug?.getMemoryProfileSnapshot());
  expect(memorySnapshot?.disclaimer).toContain('not exact GPU VRAM');
  expect(memorySnapshot?.subsystemTotals.some((entry) => entry.subsystem === 'crowd' && entry.objectCount > 0)).toBe(true);
  expect(memorySnapshot?.subsystemTotals.some((entry) => entry.subsystem === 'stadium' && entry.objectCount > 0)).toBe(true);
  expect(memorySnapshot?.subsystemTotals.some((entry) => entry.subsystem === 'officials')).toBe(true);
  await page.locator('.debug-feature-row').filter({ hasText: 'Memory' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.memory-debug-panel')).toBeHidden();
  await page.locator('.debug-feature-row').filter({ hasText: 'Audio' }).getByRole('checkbox').check();
  await expect(page.locator('.audio-debug-overlay')).toContainText('AUDIO');
  await page.locator('.debug-feature-row').filter({ hasText: 'Audio' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.audio-debug-overlay')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Presentation', exact: true }).check();
  await expect(page.locator('.presentation-audit-overlay')).toContainText('PRESENTATION AUDIT');
  await page.getByRole('checkbox', { name: 'Presentation', exact: true }).uncheck();
  await expect(page.locator('.presentation-audit-overlay')).toHaveCount(0);
  await page.locator('.debug-feature-row').filter({ hasText: 'Officials' }).getByRole('checkbox').check();
  await expect(page.locator('.officials-debug-overlay')).toContainText('OFFICIALS');
  await page.keyboard.press('F1');
  await expect(page.locator('.debug-panel')).toBeHidden();
  await expect(page.locator('.officials-debug-overlay')).toHaveCount(0);
  await page.keyboard.press('F1');
  await expect(page.locator('.debug-panel')).toBeVisible();
  await page.locator('.debug-feature-row').filter({ hasText: 'Sideline teams' }).getByRole('checkbox').check();
  await expect(page.locator('.sideline-debug-overlay')).toContainText('SIDELINE TEAMS');
  await page.locator('.debug-feature-row').filter({ hasText: 'Sideline teams' }).getByRole('checkbox').uncheck();
  await expect(page.locator('.sideline-debug-overlay')).toHaveCount(0);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.title-screen').getByLabel('Debug tools').check();
  let experience = await getGameExperienceSnapshot(page);
  expect(experience.finalSettings.debugToolsEnabled).toBe(true);

  await page.reload();
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('.title-screen').getByLabel('Debug tools')).toBeChecked();
  await expect(page.locator('.debug-panel')).toBeVisible();
  experience = await getGameExperienceSnapshot(page);
  expect(experience.finalSettings.debugToolsEnabled).toBe(true);
});

test('starts the Three.js graybox field scene', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1&readback=1&experience=performance&camera=tactical&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.game-clock')).toHaveText('Time 2:00');
  await expect(page.locator('.score-counter')).toHaveText('Score 0');
  await expect(page.locator('.drive-status')).toHaveText('1st & 10 | Ball -15');
  await expect(page.locator('.play-call')).toHaveText('Inside Run');
  await expect(page.locator('.target-label')).toBeHidden();
  const initial = await getGameplaySnapshot(page);
  expect(initial.selectedPlay.id).toBe('inside-run');
  expect(initial.scoreAttack).toMatchObject({
    remainingSeconds: 120,
    state: 'ready',
  });
  expect(initial.players).toHaveLength(10);
  expect(initial.players.filter((player) => player.team === 'offense')).toHaveLength(5);
  expect(initial.players.filter((player) => player.team === 'defense')).toHaveLength(5);
  expect(initial.players.every((player) => player.currentState === 'idle')).toBe(true);
  await expect.poll(() => getHelmetAssetSnapshot(page), { timeout: 5000 }).toMatchObject({
    assetId: 'low_poly_helmet',
    attachedPlayerIds: expect.arrayContaining([
      'defense-cover-rb',
      'defense-cover-wr',
      'defense-rusher-left',
      'defense-rusher-right',
      'defense-safety',
      'offense-blocker-left',
      'offense-blocker-right',
      'offense-qb',
      'offense-rb',
      'offense-wr',
    ]),
    errorMessage: null,
    shellMeshNames: expect.arrayContaining(['Mesh10']),
    status: 'loaded',
  });
  const bodySnapshots = await getPlayerBodyVisualSnapshots(page);
  expect(bodySnapshots).toHaveLength(10);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyStyle === 'mannequin')).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.meshesPerPlayer === 11)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.uniqueBodyGeometryCount === 8)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.uniqueBodyMaterialCount === 6)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyTriangleCount >= 300)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyTriangleCount <= 700)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyBounds.min.y >= -0.001)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.minimumBodyY >= -0.001)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.helmetBounds !== null)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.headBounds !== null)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.neckBounds !== null)).toBe(true);
  expect(
    bodySnapshots.every(
      (snapshot) =>
        snapshot.headHelmetClearance !== null &&
        snapshot.headHelmetClearance >= -0.001,
    ),
  ).toBe(true);
  expect(new Set(bodySnapshots.map((snapshot) => snapshot.appearance.skinToneId)).size).toBeGreaterThanOrEqual(3);
  expect(
    bodySnapshots.every(
      (snapshot) =>
        snapshot.helmetShoulderVerticalGap !== null &&
        snapshot.helmetShoulderVerticalGap >= -0.03,
    ),
  ).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.combinedBounds.size.y <= 2.25)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.totalHeight === 2)).toBe(true);
  for (const teamPrefix of ['player-offense-', 'player-defense-']) {
    const teamBodySnapshots = bodySnapshots.filter((snapshot) =>
      snapshot.playerId.startsWith(teamPrefix),
    );
    const firstBodyBounds = teamBodySnapshots[0].bodyBounds.size;
    expect(
      teamBodySnapshots.every(
        (snapshot) =>
          Math.abs(snapshot.bodyBounds.size.x - firstBodyBounds.x) < 0.001 &&
          Math.abs(snapshot.bodyBounds.size.y - firstBodyBounds.y) < 0.001 &&
          Math.abs(snapshot.bodyBounds.size.z - firstBodyBounds.z) < 0.001,
      ),
    ).toBe(true);
  }
  const poseSnapshots = await getPlayerPoseSnapshots(page);
  expect(poseSnapshots).toHaveLength(10);
  expect(
    poseSnapshots
      .filter((snapshot) => snapshot.playerId.startsWith('offense-'))
      .every((snapshot) => snapshot.intent === 'readyOffense'),
  ).toBe(true);
  expect(
    poseSnapshots
      .filter((snapshot) => snapshot.playerId.startsWith('defense-'))
      .every((snapshot) => snapshot.intent === 'readyDefense'),
  ).toBe(true);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.debug-overlay')).toContainText('FPS');
  await expect(page.locator('.debug-overlay')).toContainText('CAM tacticalOrthographic');
  await expect(page.locator('.debug-overlay')).toContainText('BODY mannequin');
  await expect(page.locator('.debug-overlay')).toContainText('BODY_TRIS');
  await expect.poll(() => getDebugOverlayNumber(page, 'CALLS')).toBeLessThan(210);
  await expectNonBlankCanvas(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const canvasElement = document.querySelector('canvas');
    return canvasElement?.clientWidth === window.innerWidth && canvasElement.clientHeight === window.innerHeight;
  });
  await expectNonBlankCanvas(page);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('resolves normal launch to the broadcast experience preset', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.debug-panel')).toBeHidden();
  await expect(page.locator('.debug-overlay')).toBeHidden();
  await expect(page.locator('.officials-debug-overlay')).toHaveCount(0);
  await expect(page.locator('.field-audit-overlay')).toHaveCount(0);
  await expect(page.locator('.formation-audit-overlay')).toHaveCount(0);
  await expect(page.locator('.route-audit-overlay')).toHaveCount(0);
  await expect(page.locator('.pass-audit-overlay')).toHaveCount(0);
  await expect(page.locator('.memory-debug-panel')).toBeHidden();
  await expect(page.locator('.presentation-audit-overlay')).toHaveCount(0);

  const experience = await getGameExperienceSnapshot(page);
  expect(experience.effectivePreset).toBe('broadcast');
  expect(experience.persistedSettings).toEqual({
    customSettings: null,
    preset: 'broadcast',
    settings: null,
    version: 10,
  });
  expect(experience.queryOverrides).toEqual({});
  expect(experience.developmentModes).toEqual({
    appearanceAudit: false,
    crowdPreview: false,
    formationPreview: false,
    passAudit: false,
    presentationAudit: false,
    routeAudit: false,
    shotPreview: false,
  });
  expect(experience.finalSettings).toMatchObject({
    announcerEnabled: true,
    audioEnabled: true,
    captionsEnabled: false,
    cinematics: 'brief',
    controlledPlayerLabelEnabled: true,
    crowdAudioEnabled: true,
    crowdDensity: 'low',
    crowdReactionsEnabled: true,
    crowdVisualsEnabled: true,
    gameplayCamera: 'offense',
    gameMode: 'exhibition',
    officialsDebugLabels: false,
    officialsEnabled: true,
    matchDifficulty: 'pro',
    playerMotionEnabled: true,
    playbookId: '11v11',
    preset: 'broadcast',
    quarterLengthSeconds: 180,
    routeArtEnabled: true,
    selectedReceiverLabelEnabled: false,
    sidelineDensity: 'medium',
    sidelinePlayersEnabled: true,
    stadiumEnabled: true,
    tunnelTableauEnabled: true,
  });
  expect(experience.assetReadiness).toMatchObject({
    audioEnabled: true,
    crowdSpectatorCount: 5000,
    crowdVisualsAllocated: true,
  });
  const stadium = await getStadiumSnapshot(page);
  expect(stadium).toMatchObject({
    enabled: true,
    upperTierEnabled: true,
  });
  expect(stadium.drawCalls).toBeGreaterThan(0);
  expect(stadium.seatCount).toBeGreaterThanOrEqual(500);
  const officials = await getOfficialsSnapshot(page);
  expect(officials).toMatchObject({
    enabled: true,
    visibleOfficialCount: 2,
  });
  expect(officials.officials.map((official) => official.id)).toEqual([
    'official-referee',
    'official-umpire',
  ]);
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
  });
  await expectNonBlankCanvas(page);
});

test('renders the development crowd preview with bounded instanced resources', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?crowdPreview=1&crowdCount=5000&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.crowd-preview-overlay')).toContainText('CROWD PREVIEW');

  const initial = await getCrowdPreviewSnapshot(page);
  expect(initial.requestedSpectatorCount).toBe(5000);
  expect(initial.actualSpectatorCount).toBe(5000);
  expect(initial.nearInstanceCount + initial.farMosaicSeatCount).toBe(5000);
  expect(initial.gameplayPlayerCount).toBe(0);
  expect(initial.crowdDrawCalls).toBe(5);
  expect(initial.geometryCount).toBe(4);
  expect(initial.materialCount).toBe(3);
  expect(initial.textureCount).toBe(0);
  expect((await getGameplaySnapshot(page)).players).toHaveLength(0);
  expect(initial.perInstanceStorage).toMatchObject({
    colorBytes: 12,
    customReactionDataBytes: 0,
    farMeshesPerSpectator: 0,
    nearMeshesPerSpectator: 4,
    transformMatrixBytes: 64,
  });
  expect(initial.estimatedInstanceBufferBytes).toBeGreaterThan(0);

  await page.keyboard.press('2');
  await expect.poll(() => getCrowdPreviewSnapshot(page).then((snapshot) => snapshot.cameraView)).toBe('sideline');
  await page.keyboard.press('3');
  await expect.poll(() => getCrowdPreviewSnapshot(page).then((snapshot) => snapshot.cameraView)).toBe('endZone');
  await page.keyboard.press('4');
  await expect.poll(() => getCrowdPreviewSnapshot(page).then((snapshot) => snapshot.cameraView)).toBe('close');

  await expectNonBlankCanvas(page);
});

test('runs normal-game crowd visuals, reactions, and presentation audit without loading audio', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&experience=performance&crowdDebug=1&presentationAudit=1&crowdVisuals=1&crowdReactions=1&crowdDensity=low&audio=0&cinematics=full');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.crowd-presentation-overlay')).toContainText('CROWD PRESENTATION');
  await expect(page.locator('.presentation-hardening-audit-overlay')).toContainText('PRESENTATION MATRIX');

  const crowd = await getCrowdPresentationSnapshot(page);
  expect(crowd).toMatchObject({
    actualSpectatorCount: 500,
    crowdFullness: 'sparse',
    crowdDrawCalls: 5,
    density: 'low',
    deterministicSubsets: true,
    noPerSpectatorObject3D: true,
    reactionsEnabled: true,
    visualsEnabled: true,
  });
  expect(crowd.nearInstanceCount + crowd.farMosaicSeatCount).toBe(500);
  expect(crowd.reactionUpdateHz).toBeLessThanOrEqual(15);

  const audit = await getPresentationHardeningAuditSnapshot(page);
  expect(audit).toMatchObject({
    cinematics: 'full',
    matrix: {
      audioEnabled: false,
      crowdReactionsEnabled: true,
      crowdVisualsEnabled: true,
    },
  });
  expect((await getAudioSnapshot(page)).loadedAssetIds).toEqual([]);

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await expect.poll(() => getCrowdPresentationSnapshot(page)).toMatchObject({
    reactionState: 'anticipation',
  });
  await expect.poll(async () => {
    const runtime = await getGamePresentationRuntimeSnapshot(page);
    return runtime.history.some(
      (entry) =>
        entry.crowdReaction === 'anticipation' &&
        entry.emittedEventTypes.includes('playStarted') &&
        entry.emittedEventTypes.includes('ballSnapped') &&
        !entry.resetCompleted,
    );
  }).toBe(true);

  await page.keyboard.press('R');
  await waitForPreSnap(page);
  expect((await getPresentationHoldSnapshot(page)).active).toBe(false);
  await expectNonBlankCanvas(page);
});

test('runs seven-on-seven audit and reset-cycle resource stability checks', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=7v7&sevenAudit=1&audio=0&crowdVisuals=0&cinematics=off');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.seven-audit-overlay')).toContainText('SEVEN AUDIT');
  await expect(page.locator('.seven-audit-overlay')).toContainText('ROSTER 14');
  await expect(page.locator('.seven-audit-overlay')).toContainText('WARNINGS none');
  await expect.poll(() => getHelmetAssetSnapshot(page), { timeout: 5000 }).toMatchObject({
    status: 'loaded',
  });

  const audit = await getSevenAuditSnapshot(page);
  expect(audit).toMatchObject({
    activePlay: 'Inside Zone 7',
    rosterCount: 14,
    snapLane: 'middle',
    staleEngagements: [],
    playerOverlapWarnings: [],
  });
  expect(audit.resourceCounts.playerVisualCount).toBe(14);
  expect(audit.resourceCounts.drawCalls).toBeGreaterThan(0);
  expect(audit.resourceCounts.triangles).toBeGreaterThan(0);

  const resetCycles = await runSevenAuditResetCycles(page, 100);
  expect(resetCycles.cycles).toBe(100);
  expect(resetCycles.after.activePlayerRootCount).toBe(14);
  expect(resetCycles.after.visualRootCount).toBe(14);
  expect(resetCycles.after.geometryCount).toBeLessThanOrEqual(resetCycles.before.geometryCount);
  expect(resetCycles.after.materialCount).toBe(resetCycles.before.materialCount);
  expect(resetCycles.after.activeAudioNodes).toBeLessThanOrEqual(resetCycles.before.activeAudioNodes);
  expect(resetCycles.after.presentationHistoryCount).toBeLessThanOrEqual(24);

  const afterAudit = await getSevenAuditSnapshot(page);
  expect(afterAudit.staleEngagements).toEqual([]);
  expect(afterAudit.playerOverlapWarnings).toEqual([]);
});

test('runs eleven-on-eleven audit matrix and reset-cycle resource stability checks', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=7v7&sevenAudit=1&audio=0&crowdVisuals=0&cinematics=off');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  const sevenBaseline = await getSevenAuditSnapshot(page);
  expect(sevenBaseline.rosterCount).toBe(14);

  await page.goto('/?debug=1&readback=1&experience=performance&elevenAudit=1&audio=0&crowdVisuals=0&cinematics=off&camera=tactical');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.eleven-audit-overlay')).toContainText('ELEVEN AUDIT');
  await expect(page.locator('.eleven-audit-overlay')).toContainText('ROSTER 22');
  await expect(page.locator('.eleven-audit-overlay')).toContainText('WARNINGS none');
  await expect.poll(() => getHelmetAssetSnapshot(page), { timeout: 5000 }).toMatchObject({
    status: 'loaded',
  });

  const noCrowdAudit = await getElevenAuditSnapshot(page);
  expect(noCrowdAudit).toMatchObject({
    activePlay: 'Inside Zone 11',
    formationLegality: {
      backfieldCount: 4,
      defenseCount: 11,
      formationIssueCount: 0,
      lineCount: 7,
      offenseCount: 11,
    },
    outOfBoundsWarnings: [],
    rosterCount: 22,
    snapLane: 'middle',
    staleReferences: [],
  });
  expect(noCrowdAudit.formationLegality.eligiblePlayerIds).toHaveLength(5);
  expect(noCrowdAudit.cameraContainment.unframedPlayerIds).toEqual([]);
  expect(noCrowdAudit.resourceCounts.playerModelCount).toBe(22);
  expect(noCrowdAudit.resourceCounts.playerVisualCount).toBe(22);
  expect(noCrowdAudit.resourceCounts.helmetInstanceCount).toBe(22);
  expect(noCrowdAudit.resourceCounts.drawCalls).toBeGreaterThan(sevenBaseline.resourceCounts.drawCalls);
  expect(noCrowdAudit.resourceCounts.triangles).toBeGreaterThan(sevenBaseline.resourceCounts.triangles);

  const resetCycles = await runElevenAuditResetCycles(page, 100);
  expect(resetCycles.cycles).toBe(100);
  expect(resetCycles.after.activePlayerRootCount).toBe(22);
  expect(resetCycles.after.visualRootCount).toBe(22);
  expect(resetCycles.after.helmetInstanceCount).toBe(22);
  expect(resetCycles.after.footballMeshCount).toBe(resetCycles.before.footballMeshCount);
  expect(resetCycles.after.officialCount).toBe(0);
  expect(resetCycles.after.officialMeshCount).toBe(0);
  expect(resetCycles.after.crowdInstanceCount).toBe(0);
  expect(resetCycles.after.stadiumGeometryCount).toBeGreaterThan(0);
  expect(resetCycles.after.stadiumMeshCount).toBe(resetCycles.before.stadiumMeshCount);
  expect(resetCycles.after.geometryCount).toBeLessThanOrEqual(resetCycles.before.geometryCount);
  expect(resetCycles.after.materialCount).toBe(resetCycles.before.materialCount);
  expect(resetCycles.after.textureCount).toBe(resetCycles.before.textureCount);
  expect(resetCycles.after.debugOverlayCount).toBe(resetCycles.before.debugOverlayCount);
  expect(resetCycles.after.activeAudioNodes).toBeLessThanOrEqual(resetCycles.before.activeAudioNodes);
  expect(resetCycles.after.activeCameraShot).toBeNull();
  expect(resetCycles.after.activePresentationHold).toBe(false);
  expect(resetCycles.after.crowdReaction === null || resetCycles.after.crowdReaction === 'idle').toBe(true);

  await page.goto('/?debug=1&readback=1&experience=performance&elevenAudit=1&crowdVisuals=1&crowdDensity=low&crowdReactions=1&officials=1&audio=1&cinematics=brief&camera=cinematic');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.eleven-audit-overlay')).toContainText('ELEVEN AUDIT');
  const crowdAudit = await getElevenAuditSnapshot(page);
  expect(crowdAudit.rosterCount).toBe(22);
  expect(crowdAudit.resourceCounts.playerVisualCount).toBe(22);
  expect(crowdAudit.resourceCounts.crowdReaction).toBe('idle');
  expect(crowdAudit.resourceCounts.drawCalls).toBeGreaterThan(0);
  expect(crowdAudit.resourceCounts.triangles).toBeGreaterThan(noCrowdAudit.resourceCounts.triangles);
  const integratedResetCycles = await runElevenAuditResetCycles(page, 100);
  expect(integratedResetCycles.cycles).toBe(100);
  expect(integratedResetCycles.after.activePlayerRootCount).toBe(22);
  expect(integratedResetCycles.after.visualRootCount).toBe(22);
  expect(integratedResetCycles.after.helmetInstanceCount).toBe(22);
  expect(integratedResetCycles.after.footballMeshCount).toBe(integratedResetCycles.before.footballMeshCount);
  expect(integratedResetCycles.after.officialCount).toBe(2);
  expect(integratedResetCycles.after.officialMeshCount).toBe(integratedResetCycles.before.officialMeshCount);
  expect(integratedResetCycles.after.crowdInstanceCount).toBeGreaterThanOrEqual(500);
  expect(integratedResetCycles.after.crowdInstanceCount).toBe(
    integratedResetCycles.before.crowdInstanceCount,
  );
  expect(integratedResetCycles.after.stadiumGeometryCount).toBeGreaterThan(0);
  expect(integratedResetCycles.after.stadiumMeshCount).toBe(integratedResetCycles.before.stadiumMeshCount);
  expect(integratedResetCycles.after.geometryCount).toBeLessThanOrEqual(
    integratedResetCycles.before.geometryCount,
  );
  expect(integratedResetCycles.after.materialCount).toBe(integratedResetCycles.before.materialCount);
  expect(integratedResetCycles.after.textureCount).toBe(integratedResetCycles.before.textureCount);
  expect(integratedResetCycles.after.debugOverlayCount).toBe(integratedResetCycles.before.debugOverlayCount);
  expect(integratedResetCycles.after.activeAudioNodes).toBeLessThanOrEqual(
    integratedResetCycles.before.activeAudioNodes,
  );
  expect(integratedResetCycles.after.activeCameraShot).toBeNull();
  expect(integratedResetCycles.after.activePresentationHold).toBe(false);
  await expectNonBlankCanvas(page);
});

test('supports the box player body comparison URL option', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playerBody=box');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const bodySnapshots = await getPlayerBodyVisualSnapshots(page);

  expect(bodySnapshots).toHaveLength(22);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyStyle === 'box')).toBe(true);
  await expect(page.locator('.debug-overlay')).toContainText('BODY box');
  await expectNonBlankCanvas(page);
});

test('starts runtime audio debug and plays local test assets without mutating gameplay', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&audioDebug=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.audio-debug-overlay')).toContainText('AUDIO');
  await expect(page.locator('.audio-debug-overlay')).toContainText('EVENT_HISTORY');
  await expect(page.locator('.audio-debug-overlay')).toContainText('AUDIO_NODES');
  await expect(page.locator('.audio-debug-overlay')).toContainText('SOURCES');

  const before = await getGameplaySnapshot(page);
  const initialAudio = await getAudioSnapshot(page);
  expect(initialAudio.enabled).toBe(true);
  expect(initialAudio.activeBuses).toContain('master');
  expect(initialAudio.userGestureUnlocked).toBe(false);
  expect(initialAudio.loadedAssetIds).toEqual([]);
  expect(initialAudio.activeAudioNodeCount).toBeGreaterThanOrEqual(5);

  await setAudioMuted(page, true);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.muted)).toBe(true);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.userGestureUnlocked)).toBe(false);
  expect((await getAudioSnapshot(page)).loadedAssetIds).toEqual([]);
  await setAudioMuted(page, false);
  await page.keyboard.press('M');
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.muted)).toBe(true);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.userGestureUnlocked)).toBe(true);
  await page.keyboard.press('M');
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.muted)).toBe(false);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.contextState)).toBe('running');

  await expect(playAudioTestOneShot(page)).resolves.toBe(true);
  await expect.poll(
    () => getAudioSnapshot(page).then((snapshot) => snapshot.loadedAssetIds.includes('runtime-test-click')),
  ).toBe(true);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.decodedBufferBytes)).toBeGreaterThan(0);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.loadedCompressedBytes)).toBeGreaterThan(0);

  await expect(startAudioTestLoop(page)).resolves.toBe(true);
  await expect.poll(
    () => getAudioSnapshot(page).then((snapshot) => snapshot.activeLoops.includes('runtime-test-crowd-loop')),
  ).toBe(true);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.activeSourceCount)).toBeGreaterThan(0);
  await expect.poll(
    () => getAudioSnapshot(page).then((snapshot) => snapshot.streamedAssetIds.includes('runtime-test-crowd-loop')),
  ).toBe(true);
  expect((await getAudioSnapshot(page)).preparedMediaElementSourceCount).toBeLessThanOrEqual(2);
  await expect(stopAudioTestLoop(page)).resolves.toBe(true);

  const after = await getGameplaySnapshot(page);
  expect(after).toEqual(before);
});

test('unlocks audio from a pointer gesture and keeps audio-disabled startup unloaded', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&audioDebug=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await page.mouse.click(24, 24);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.contextState)).toBe('running');

  await setAudioPageActiveForTest(page, false);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.pageActive)).toBe(false);
  await setAudioPageActiveForTest(page, true);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.pageActive)).toBe(true);

  await page.goto('/?debug=1&readback=1&experience=performance&audioDebug=1&audio=0');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await page.keyboard.press('Space');
  await page.keyboard.press('R');
  const disabledAudio = await getAudioSnapshot(page);
  expect(disabledAudio.enabled).toBe(false);
  expect(disabledAudio.loadedAssetIds).toEqual([]);
  expect(disabledAudio.streamedAssetIds).toEqual([]);
  expect(disabledAudio.decodedAssetIds).toEqual([]);
});

test('starts commentary debug and keeps disabled announcer speech unloaded', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&commentaryDebug=1&captions=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.audio-debug-overlay')).toContainText('COMMENTARY');

  let audio = await getAudioSnapshot(page);
  expect(audio.commentary?.captionsEnabled).toBe(true);
  expect(audio.commentary?.enabled).toBe(true);
  expect(audio.crowdDuckingGain).toBe(1);

  await page.mouse.click(24, 24);
  await expect.poll(() => getAudioSnapshot(page).then((snapshot) => snapshot.contextState)).toBe('running');
  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page).then((snapshot) => snapshot.playState)).toBe('live');

  audio = await getAudioSnapshot(page);
  expect(audio.commentary).toBeTruthy();
  expect(audio.commentary?.queue.length).toBeGreaterThanOrEqual(0);

  await page.goto('/?debug=1&readback=1&experience=performance&commentaryDebug=1&announcer=0');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await page.mouse.click(24, 24);
  await page.keyboard.press('Space');
  const disabledAnnouncer = await getAudioSnapshot(page);
  expect(disabledAnnouncer.announcerEnabled).toBe(false);
  expect(disabledAnnouncer.commentary?.enabled).toBe(false);
  expect(disabledAnnouncer.loadedAssetIds.some((assetId) => assetId.startsWith('ann_'))).toBe(false);
});

test('supports football visual and appearance audit presentation options', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&experience=performance&appearanceAudit=1&camera=offense');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect.poll(() => getHelmetAssetSnapshot(page), { timeout: 5000 }).toMatchObject({
    status: 'loaded',
  });

  const football = await getBallVisualSnapshot(page);
  expect(football.style).toBe('football');
  expect(football.length).toBeGreaterThan(football.diameter);
  expect(football.bounds.size.z).toBeGreaterThan(football.bounds.size.x);
  expect(football.meshCount).toBeGreaterThan(1);

  const appearanceAudit = await getAppearanceAuditSnapshot(page);
  expect(appearanceAudit.playerCount).toBe(22);
  expect(appearanceAudit.skinToneCount).toBeGreaterThanOrEqual(3);
  expect(
    appearanceAudit.entries.every(
      (entry) =>
        entry.headBounds !== null &&
        entry.helmetBounds !== null &&
        entry.headHelmetClearance !== null &&
        entry.headHelmetClearance >= -0.001,
    ),
  ).toBe(true);
  await expect(page.locator('.appearance-audit-overlay')).toContainText('APPEARANCE AUDIT');

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await expect.poll(() => getBallVisualSnapshot(page)).toMatchObject({
    style: 'football',
    visible: true,
  });
  await expectNonBlankCanvas(page);

  await page.goto('/?debug=1&readback=1&experience=performance&ballVisual=sphere');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect.poll(() => getBallVisualSnapshot(page)).toMatchObject({
    meshCount: 1,
    style: 'sphere',
  });
});

test('supports procedural player motion debug and comparison modes', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&poseDebug=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.pose-debug-overlay')).toContainText('POSE DEBUG');
  await expect(page.locator('.pose-debug-overlay')).toContainText('offense-qb readyOffense');
  await expect(page.locator('.pose-debug-overlay')).toContainText('defense-safety readyDefense');

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await page.keyboard.down('w');
  await expect.poll(async () => {
    const poses = await getPlayerPoseSnapshots(page);
    return poses.some(
      (snapshot) => snapshot.playerId === 'offense-rb' && snapshot.intent === 'locomotion',
    );
  }).toBe(true);
  await page.keyboard.up('w');

  await page.goto('/?debug=1&readback=1&experience=performance&poseDebug=1&playerMotion=0');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  expect((await getPlayerPoseSnapshots(page)).every((snapshot) => snapshot.intent === 'neutral')).toBe(
    true,
  );
  await expect(page.locator('.pose-debug-overlay')).toContainText('neutral');
});

test('starts field and formation audit modes without render errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/?debug=1&readback=1&experience=performance&fieldAudit=1&formationAudit=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.debug-overlay')).toContainText('FPS');
  await expect(page.locator('.formation-audit-overlay')).toContainText('FORMATION AUDIT');
  await expect(page.locator('.formation-audit-overlay')).toContainText('PLAY Inside Zone 11');
  await expect(page.locator('.formation-audit-overlay')).toContainText('ISSUES none');
  await expectNonBlankCanvas(page);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('stages a static 7v7 formation preview across snap lanes and camera modes', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1&readback=1&experience=performance&camera=tactical&playbook=5v5&formationPreview=7v7&formationAudit=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.play-call-ui')).toBeHidden();
  await expect(page.locator('.play-call')).toHaveText('7v7 Formation Preview');
  await expect(page.locator('.formation-audit-overlay')).toContainText('PLAY 7v7 Formation Preview');
  await expect(page.locator('.formation-audit-overlay')).toContainText('ISSUES none');

  const initialPreview = await getFormationPreviewSnapshot(page);
  expect(initialPreview).toMatchObject({
    mode: '7v7',
    snapLane: 'middle',
    issues: [],
  });
  expect(initialPreview.players).toHaveLength(14);
  expect(initialPreview.players.filter((player) => player.team === 'offense')).toHaveLength(7);
  expect(initialPreview.players.filter((player) => player.team === 'defense')).toHaveLength(7);
  expect(initialPreview.players.every((player) => player.currentState === 'idle')).toBe(true);
  expect(new Set(initialPreview.players.map((player) => player.id)).size).toBe(14);

  await expect.poll(() => getHelmetAssetSnapshot(page), { timeout: 5000 }).toMatchObject({
    attachedPlayerIds: expect.arrayContaining([
      'defense-corner-left',
      'defense-corner-right',
      'defense-line-left',
      'defense-line-middle',
      'defense-line-right',
      'defense-linebacker',
      'defense-safety',
      'offense-center',
      'offense-line-left',
      'offense-line-right',
      'offense-qb',
      'offense-rb',
      'offense-wr-left',
      'offense-wr-right',
    ]),
    status: 'loaded',
  });
  expect(await getPlayerBodyVisualSnapshots(page)).toHaveLength(14);
  await expect.poll(() => getCameraFramingSnapshot(page)).toMatchObject({
    unframedPlayerIds: [],
  });

  await page.keyboard.press('1');
  await expect.poll(() => getFormationPreviewSnapshot(page)).toMatchObject({
    snapLane: 'leftHash',
    issues: [],
  });
  await page.keyboard.press('2');
  await expect.poll(() => getFormationPreviewSnapshot(page)).toMatchObject({
    snapLane: 'middle',
    issues: [],
  });
  await page.keyboard.press('3');
  await expect.poll(() => getFormationPreviewSnapshot(page)).toMatchObject({
    snapLane: 'rightHash',
    issues: [],
  });

  const beforeSpace = await getFormationPreviewSnapshot(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const afterSpace = await getFormationPreviewSnapshot(page);
  expect(afterSpace.snapLane).toBe(beforeSpace.snapLane);
  expect(afterSpace.players.every((player) => player.currentState === 'idle')).toBe(true);
  expect((await getGameplaySnapshot(page)).playState).toBe('preSnap');

  await expect(page.locator('.debug-overlay')).toContainText('FRAME_MS');
  await expect(page.locator('.debug-overlay')).toContainText('PLAYERS 14');
  const metrics = await getRenderMetrics(page);
  expect(metrics.playerCount).toBe(14);
  expect(metrics.calls).toBeGreaterThan(0);
  expect(metrics.calls).toBeLessThan(280);
  expect(metrics.frameTimeMs).toBeGreaterThan(0);
  expect(metrics.triangles).toBeGreaterThan(0);
  expect(metrics.sceneMeshCount).toBeGreaterThanOrEqual(metrics.playerBodyMeshCount);
  expect(metrics.sceneMaterialCount).toBeGreaterThan(0);

  await page.keyboard.press('c');
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
    state: 'preSnapFormation',
  });
  await expect.poll(() => getCameraFramingSnapshot(page)).toMatchObject({
    unframedPlayerIds: [],
  });
  await expectNonBlankCanvas(page);

  await page.keyboard.press('c');
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'cinematicBroadcast',
    presentationPhase: 'preSnapEstablish',
    state: 'cinematicBroadcast',
  });
  await expect(page.locator('.debug-overlay')).toContainText('PRESENT preSnapEstablish');
  await expect(page.locator('.debug-overlay')).toContainText('FORM_BOUNDS');
  await expect.poll(() => getCameraFramingSnapshot(page)).toMatchObject({
    unframedPlayerIds: [],
  });
  await expectNonBlankCanvas(page);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('stages a static 11v11 formation preview across snap lanes and camera modes', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const expectedPlayerIds = [
    'defense-corner-left',
    'defense-corner-right',
    'defense-line-left',
    'defense-line-middle',
    'defense-line-right',
    'defense-linebacker',
    'defense-linebacker-inside',
    'defense-linebacker-left',
    'defense-linebacker-right',
    'defense-safety',
    'defense-safety-strong',
    'offense-center',
    'offense-line-left',
    'offense-line-right',
    'offense-qb',
    'offense-rb',
    'offense-slot',
    'offense-tackle-left',
    'offense-tackle-right',
    'offense-tight-end',
    'offense-wr-left',
    'offense-wr-right',
  ];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1&readback=1&experience=performance&camera=tactical&formationPreview=11v11&formationAudit=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.play-call-ui')).toBeHidden();
  await expect(page.locator('.play-call')).toHaveText('11v11 Formation Preview');
  await expect(page.locator('.formation-audit-overlay')).toContainText('PLAY 11v11 Formation Preview');
  await expect(page.locator('.formation-audit-overlay')).toContainText('ISSUES none');
  await expect(page.locator('.formation-audit-overlay')).toContainText('offense-center offense/blocker');
  await expect(page.locator('.formation-audit-overlay')).toContainText('football C line ineligible');

  const initialPreview = await getFormationPreviewSnapshot(page);
  expect(initialPreview).toMatchObject({
    issues: [],
    mode: '11v11',
    preferredSide: 'right',
    snapLane: 'middle',
  });
  expect(initialPreview.players).toHaveLength(22);
  expect(initialPreview.players.filter((player) => player.team === 'offense')).toHaveLength(11);
  expect(initialPreview.players.filter((player) => player.team === 'defense')).toHaveLength(11);
  expect(initialPreview.players.map((player) => player.id).sort()).toEqual(expectedPlayerIds);
  expect(new Set(initialPreview.players.map((player) => player.id)).size).toBe(22);
  expect(initialPreview.players.every((player) => player.currentState === 'idle')).toBe(true);
  expect(initialPreview.labels.filter((label) => label.alignment === 'line')).toHaveLength(7);
  expect(initialPreview.labels.filter((label) => label.alignment === 'backfield')).toHaveLength(4);
  expect(initialPreview.labels.filter((label) => label.eligible)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'offense-rb', footballPosition: 'RB' }),
      expect.objectContaining({ id: 'offense-slot', footballPosition: 'SLOT' }),
      expect.objectContaining({ id: 'offense-tight-end', footballPosition: 'TE' }),
      expect.objectContaining({ id: 'offense-wr-left', footballPosition: 'WR' }),
      expect.objectContaining({ id: 'offense-wr-right', footballPosition: 'WR' }),
    ]),
  );

  await expect.poll(() => getHelmetAssetSnapshot(page), { timeout: 5000 }).toMatchObject({
    attachedPlayerIds: expect.arrayContaining(expectedPlayerIds),
    status: 'loaded',
  });
  expect(await getPlayerBodyVisualSnapshots(page)).toHaveLength(22);
  await expect.poll(() => getCameraFramingSnapshot(page)).toMatchObject({
    unframedPlayerIds: [],
  });

  await page.keyboard.press('1');
  await expect.poll(() => getFormationPreviewSnapshot(page)).toMatchObject({
    issues: [],
    snapLane: 'leftHash',
  });
  await page.keyboard.press('2');
  await expect.poll(() => getFormationPreviewSnapshot(page)).toMatchObject({
    issues: [],
    snapLane: 'middle',
  });
  const beforeMirror = await getFormationPreviewSnapshot(page);
  await page.keyboard.press('4');
  const afterMirror = await getFormationPreviewSnapshot(page);
  expect(afterMirror.preferredSide).toBe('left');
  expect(getPreviewPlayer(afterMirror, 'offense-tight-end').position.x).toBeCloseTo(
    -getPreviewPlayer(beforeMirror, 'offense-tight-end').position.x,
  );
  expect(afterMirror.players.every((player) => player.currentState === 'idle')).toBe(true);
  await page.keyboard.press('3');
  await expect.poll(() => getFormationPreviewSnapshot(page)).toMatchObject({
    issues: [],
    snapLane: 'rightHash',
  });

  const beforeSpace = await getFormationPreviewSnapshot(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const afterSpace = await getFormationPreviewSnapshot(page);
  expect(afterSpace.snapLane).toBe(beforeSpace.snapLane);
  expect(afterSpace.players.every((player) => player.currentState === 'idle')).toBe(true);
  expect((await getGameplaySnapshot(page)).playState).toBe('preSnap');

  await expect(page.locator('.debug-overlay')).toContainText('FRAME_MS');
  await expect(page.locator('.debug-overlay')).toContainText('PLAYERS 22');
  const metrics = await getRenderMetrics(page);
  expect(metrics).toMatchObject({
    playerCount: 22,
  });
  expect(metrics.calls).toBeGreaterThan(0);
  expect(metrics.calls).toBeLessThan(420);
  expect(metrics.triangles).toBeGreaterThan(0);
  expect(metrics.geometries).toBeGreaterThan(0);
  expect(metrics.sceneMaterialCount).toBeGreaterThan(0);

  await page.keyboard.press('c');
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
    state: 'preSnapFormation',
  });
  await expect.poll(() => getCameraFramingSnapshot(page)).toMatchObject({
    unframedPlayerIds: [],
  });
  await expectNonBlankCanvas(page);

  await page.keyboard.press('c');
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'cinematicBroadcast',
    presentationPhase: 'preSnapEstablish',
    state: 'cinematicBroadcast',
  });
  await expect(page.locator('.debug-overlay')).toContainText('FORM_BOUNDS');
  await expect.poll(() => getCameraFramingSnapshot(page)).toMatchObject({
    unframedPlayerIds: [],
  });
  await expectNonBlankCanvas(page);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('runs 7v7 presentation audit scenarios with screenshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?readback=1&experience=performance&formationPreview=7v7&presentationAudit=1&camera=tactical');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect.poll(() => getHelmetAssetSnapshot(page), { timeout: 5000 }).toMatchObject({
    assetId: 'low_poly_helmet',
    attachedPlayerIds: expect.arrayContaining([
      'defense-corner-left',
      'defense-corner-right',
      'defense-line-left',
      'defense-line-middle',
      'defense-line-right',
      'defense-linebacker',
      'defense-safety',
      'offense-center',
      'offense-line-left',
      'offense-line-right',
      'offense-qb',
      'offense-rb',
      'offense-wr-left',
      'offense-wr-right',
    ]),
    status: 'loaded',
  });
  await page.keyboard.press('2');

  await assertCleanPresentationAudit(page, {
    cameraMode: 'tacticalOrthographic',
    screenshotName: 'presentation-audit-middle-tactical-motionOn.png',
    snapLane: 'middle',
    state: 'preSnap',
    testInfo,
  });

  await page.keyboard.press('c');
  await assertCleanPresentationAudit(page, {
    cameraMode: 'offensePerspective',
    screenshotName: 'presentation-audit-middle-offense-motionOn.png',
    snapLane: 'middle',
    state: 'preSnap',
    testInfo,
  });

  await page.keyboard.press('c');
  await assertCleanPresentationAudit(page, {
    cameraMode: 'cinematicBroadcast',
    presentationPhase: 'preSnapEstablish',
    screenshotName: 'presentation-audit-middle-cinematic-motionOn.png',
    snapLane: 'middle',
    state: 'preSnap',
    testInfo,
  });

  await page.keyboard.press('1');
  await assertCleanPresentationAudit(page, {
    cameraMode: 'cinematicBroadcast',
    presentationPhase: 'preSnapEstablish',
    screenshotName: 'presentation-audit-leftHash-cinematic-motionOn.png',
    snapLane: 'leftHash',
    state: 'preSnap',
    testInfo,
  });

  await page.keyboard.press('3');
  await assertCleanPresentationAudit(page, {
    cameraMode: 'cinematicBroadcast',
    presentationPhase: 'preSnapEstablish',
    screenshotName: 'presentation-audit-rightHash-cinematic-motionOn.png',
    snapLane: 'rightHash',
    state: 'preSnap',
    testInfo,
  });

  await page.keyboard.press('2');
  await page.keyboard.press('l');
  await expect.poll(() => getPresentationAuditSnapshot(page)).toMatchObject({
    playerMotionEnabled: true,
    state: 'locomotionPreview',
  });
  await expect.poll(async () => {
    const poses = await getPlayerPoseSnapshots(page);
    return poses.length === 14 && poses.every((pose) => pose.intent === 'locomotion');
  }).toBe(true);
  await assertCleanPresentationAudit(page, {
    cameraMode: 'cinematicBroadcast',
    screenshotName: 'presentation-audit-middle-cinematic-locomotion-motionOn.png',
    snapLane: 'middle',
    state: 'locomotionPreview',
    testInfo,
  });

  await page.goto('/?readback=1&experience=performance&formationPreview=7v7&presentationAudit=1&presentationState=locomotion&playerMotion=0&camera=cinematic');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect.poll(async () => {
    const poses = await getPlayerPoseSnapshots(page);
    return poses.length === 14 && poses.every((pose) => pose.intent === 'neutral');
  }).toBe(true);
  await assertCleanPresentationAudit(page, {
    cameraMode: 'cinematicBroadcast',
    playerMotionEnabled: false,
    screenshotName: 'presentation-audit-middle-cinematic-locomotion-motionOff.png',
    snapLane: 'middle',
    state: 'locomotionPreview',
    testInfo,
  });
});

test('renders graphical play cards and selects plays through the shared request path', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=7v7');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const cards = page.locator('.play-card');
  await expect(page.locator('.play-call-ui')).toBeVisible();
  await expect(cards).toHaveCount(4);
  await expect(cards.locator('.play-card-title')).toHaveText([
    'Inside Zone 7',
    'Outside Zone 7',
    'Quick Pass 7',
    'Twin Slants Flat',
  ]);
  await expect(page.locator('.play-card[data-play-id="inside-zone-7"] .play-card-run-direction')).toHaveCount(1);
  await expect(page.locator('.play-card[data-play-id="outside-zone-7"] .play-card-run-direction')).toHaveCount(1);
  await expect(page.locator('.play-card[data-play-id="quick-pass-7"] .play-card-receiver-route')).toHaveCount(3);
  await expect(page.locator('.play-card[data-play-id="twin-slants-flat"] .play-card-receiver-route')).toHaveCount(3);
  await expect(page.locator('.play-card[data-play-id="inside-zone-7"]')).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('3');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'quick-pass-7', displayName: 'Quick Pass 7' },
  });
  await expect(page.locator('.play-card[data-play-id="quick-pass-7"]')).toHaveAttribute('data-selected', 'true');

  await page.locator('.play-card[data-play-id="outside-zone-7"]').click();
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'outside-zone-7', displayName: 'Outside Zone 7' },
  });
  await expect(page.locator('.play-card[data-play-id="outside-zone-7"]')).toHaveAttribute('data-selected', 'true');
  expect(await page.evaluate(() => document.activeElement?.classList.contains('play-card') ?? false)).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards).toHaveCount(4);
  await expect(page.locator('.play-call-ui')).toBeVisible();

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await expect(page.locator('.play-call-ui')).toBeHidden();

  await page.keyboard.press('1');
  await page.waitForTimeout(100);
  expect((await getGameplaySnapshot(page)).selectedPlay.id).toBe('outside-zone-7');
});

test('shows on-field receiver routes before snap and supports route audit mode', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&experience=performance&routeArt=1&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('4');
  await expect.poll(() => getRouteArtSnapshot(page)).toMatchObject({
    routeCount: 2,
    visible: true,
  });
  const preSnapRoutes = await getRouteArtSnapshot(page);
  expect(preSnapRoutes.routes.map((route) => route.receiverId)).toEqual(['offense-wr', 'offense-rb']);
  expect(preSnapRoutes.routes.every((route) => route.points.length >= 3)).toBe(true);
  expect(preSnapRoutes.routes.find((route) => route.receiverId === 'offense-wr')?.selected).toBe(true);

  await page.keyboard.press('e');
  await expect.poll(async () =>
    (await getRouteArtSnapshot(page)).routes.find((route) => route.receiverId === 'offense-rb')?.selected,
  ).toBe(true);

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await expect.poll(() => getRouteArtSnapshot(page)).toMatchObject({ visible: false });

  await page.goto('/?debug=1&readback=1&experience=performance&routeArt=0&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await page.keyboard.press('3');
  await expect.poll(() => getRouteArtSnapshot(page)).toMatchObject({
    enabled: false,
    visible: false,
  });

  await page.goto('/?debug=1&readback=1&experience=performance&routeAudit=1&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await page.keyboard.press('3');
  await expect.poll(() => getRouteArtSnapshot(page)).toMatchObject({
    auditEnabled: true,
    routeCount: 1,
    visible: true,
  });
  const auditRoutes = await getRouteArtSnapshot(page);
  expect(auditRoutes.routes[0].audit).not.toBeNull();
  await expect(page.locator('.route-audit-overlay')).toContainText('ROUTE AUDIT');
});

test('shows pass audit data for a route-aware throw', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&experience=performance&passAudit=1&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.pass-audit-overlay')).toContainText('no active pass');

  await page.keyboard.press('3');
  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { state: { kind: 'possessed' } },
    playState: 'live',
  });

  await page.keyboard.press('f');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    passAttempted: true,
  });
  await expect.poll(() => getPassAuditSnapshot(page)).toMatchObject({
    selectedReceiverId: 'offense-wr',
  });
  await expect(page.locator('.pass-audit-overlay')).toContainText('TARGET offense-wr');
  await expect(page.locator('.pass-audit-overlay')).toContainText('PRED_TARGET');

  await expect.poll(async () => (await getPassAuditSnapshot(page))?.actualClosestApproach).not.toBeNull();
  const audit = await getPassAuditSnapshot(page);
  expect(audit?.predictedFlightSeconds).toBeGreaterThan(0);
  expect(audit?.predictedReceiverRouteDistance).toBeGreaterThan(0);
});

test('starts playable 7v7 Twin Slants Flat and throws to the selected target', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=7v7');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const initial = await getGameplaySnapshot(page);
  expect(initial.playbookId).toBe('7v7');
  expect(initial.selectedPlay).toMatchObject({
    displayName: 'Inside Zone 7',
    id: 'inside-zone-7',
    kind: 'run',
  });
  expect(initial.players).toHaveLength(14);
  expect(initial.players.filter((player) => player.team === 'offense')).toHaveLength(7);
  expect(initial.players.filter((player) => player.team === 'defense')).toHaveLength(7);
  expect(initial.selectedReceiver).toBeNull();
  await expect(page.locator('.play-card')).toHaveCount(4);
  await expect(page.locator('.play-card-title')).toHaveText([
    'Inside Zone 7',
    'Outside Zone 7',
    'Quick Pass 7',
    'Twin Slants Flat',
  ]);
  await expect(page.locator('.play-card[data-play-id="twin-slants-flat"] .play-card-receiver-route')).toHaveCount(3);
  await expect(page.locator('.play-card[data-play-id="twin-slants-flat"] .play-card-blocker-assignment')).toHaveCount(3);

  await page.keyboard.press('4');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { displayName: 'Twin Slants Flat', id: 'twin-slants-flat' },
    selectedReceiver: {
      displayName: 'Receiver Left',
      id: 'offense-wr-left',
    },
  });
  expect((await getGameplaySnapshot(page)).selectedReceiver).toEqual({
    displayName: 'Receiver Left',
    id: 'offense-wr-left',
  });

  await page.keyboard.press('e');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedReceiver: { displayName: 'Receiver Right', id: 'offense-wr-right' },
  });
  await page.keyboard.press('e');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedReceiver: { displayName: 'Running Back', id: 'offense-rb' },
  });

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { state: { kind: 'possessed' } },
    playState: 'live',
  });
  await expect(page.locator('.play-call-ui')).toBeHidden();

  await page.keyboard.press('f');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    passAttempted: true,
    selectedReceiver: { id: 'offense-rb' },
  });
  expect(['inFlight', 'caught', 'incomplete', 'dead']).toContain(
    (await getGameplaySnapshot(page)).ball.state.kind,
  );
  await expectNonBlankCanvas(page);
});

test('starts playable 11v11 plays and throws Spread Quick to the selected target', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1&readback=1&experience=performance&camera=tactical&playbook=11v11&audio=0&crowdVisuals=0&cinematics=off');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const initial = await getGameplaySnapshot(page);
  expect(initial.playbookId).toBe('11v11');
  expect(initial.selectedPlay).toMatchObject({
    displayName: 'Inside Zone 11',
    id: 'inside-zone-11',
    kind: 'run',
  });
  expect(initial.players).toHaveLength(22);
  expect(initial.players.filter((player) => player.team === 'offense')).toHaveLength(11);
  expect(initial.players.filter((player) => player.team === 'defense')).toHaveLength(11);
  expect(getPlayer(initial, 'offense-rb')).toMatchObject({
    currentState: 'idle',
    role: 'runner',
  });
  expect(getPlayer(initial, 'offense-qb')).toMatchObject({
    currentState: 'idle',
    role: 'quarterback',
  });
  await expect(page.locator('.play-card')).toHaveCount(2);
  await expect(page.locator('.play-card-title')).toHaveText(['Inside Zone 11', 'Spread Quick 11']);
  await expect(page.locator('.play-card[data-play-id="inside-zone-11"] .play-card-run-direction')).toHaveCount(1);
  await expect(page.locator('.play-card[data-play-id="inside-zone-11"] .play-card-blocker-assignment')).toHaveCount(9);
  await expect(page.locator('.play-card[data-play-id="spread-quick-11"] .play-card-receiver-route')).toHaveCount(5);
  await expect(page.locator('.play-card[data-play-id="spread-quick-11"] .play-card-blocker-assignment')).toHaveCount(5);
  await expectNonBlankCanvas(page);

  await page.locator('.play-card[data-play-id="spread-quick-11"]').click();
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'spread-quick-11', displayName: 'Spread Quick 11' },
    selectedReceiver: { id: 'offense-wr-left', displayName: 'Receiver Left' },
  });
  await page.keyboard.press('e');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedReceiver: { id: 'offense-wr-right', displayName: 'Receiver Right' },
  });
  await page.keyboard.press('e');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedReceiver: { id: 'offense-slot', displayName: 'Slot' },
  });

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { state: { kind: 'possessed', playerId: 'offense-qb' } },
    playState: 'live',
  });
  await expect(page.locator('.play-call-ui')).toBeHidden();

  await page.keyboard.press('f');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    passAttempted: true,
    selectedReceiver: { id: 'offense-slot' },
  });
  expect(['inFlight', 'caught', 'incomplete', 'dead']).toContain(
    (await getGameplaySnapshot(page)).ball.state.kind,
  );
  await expectNonBlankCanvas(page);

  await page.keyboard.press('r');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    playState: 'preSnap',
    selectedPlay: { id: 'spread-quick-11' },
  });
  await expect(page.locator('.play-call-ui')).toBeVisible();

  await page.locator('.play-card[data-play-id="inside-zone-11"]').click();
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'inside-zone-11', displayName: 'Inside Zone 11' },
  });

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: {
      possession: {
        kind: 'player',
        playerId: 'offense-rb',
      },
      state: {
        kind: 'possessed',
        playerId: 'offense-rb',
      },
    },
    playState: 'live',
  });
  await expect(page.locator('.play-call-ui')).toBeHidden();

  const live = await getGameplaySnapshot(page);
  expect(getPlayer(live, 'offense-rb')).toMatchObject({
    currentState: 'userControlled',
    role: 'runner',
  });
  expect(getPlayer(live, 'offense-qb')).toMatchObject({
    currentState: 'idle',
    role: 'quarterback',
  });
  expect(live.blocking.engagements.length).toBeLessThanOrEqual(9);
  await expectNonBlankCanvas(page);
});

test('selects offense perspective camera and toggles modes without resetting gameplay', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&experience=performance&camera=offense&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
    state: 'preSnapFormation',
  });
  await expect(page.locator('.debug-overlay')).toContainText('CAM offensePerspective');
  await expectNonBlankCanvas(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const canvasElement = document.querySelector('canvas');
    return canvasElement?.clientWidth === window.innerWidth && canvasElement.clientHeight === window.innerHeight;
  });
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
  });
  await expectNonBlankCanvas(page);

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
    state: 'carrierFollow',
  });
  const beforeToggle = await getGameplaySnapshot(page);

  await page.keyboard.press('c');
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'cinematicBroadcast',
    state: 'cinematicBroadcast',
  });
  expect((await getGameplaySnapshot(page)).playState).toBe(beforeToggle.playState);
  expect((await getGameplaySnapshot(page)).score).toBe(beforeToggle.score);
  await expect(page.locator('.debug-overlay')).toContainText('PRESENT');
  await expectNonBlankCanvas(page);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForFunction(() => {
    const canvasElement = document.querySelector('canvas');
    return canvasElement?.clientWidth === window.innerWidth && canvasElement.clientHeight === window.innerHeight;
  });
  await expectNonBlankCanvas(page);

  await page.keyboard.press('c');
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'tacticalOrthographic',
    state: 'tacticalOverview',
  });
});

test('runs cinematic broadcast camera without delaying gameplay snap', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&experience=performance&camera=cinematic');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'cinematicBroadcast',
    presentationPhase: 'preSnapEstablish',
    state: 'cinematicBroadcast',
  });
  await expect(page.locator('.debug-overlay')).toContainText('CAM cinematicBroadcast');
  await expect(page.locator('.debug-overlay')).toContainText('PRESENT preSnapEstablish');
  await expect(page.locator('.debug-overlay')).toContainText('FORM_BOUNDS');
  await expectNonBlankCanvas(page);

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await expect.poll(async () => {
    const camera = await getCameraSnapshot(page);

    return (
      camera.mode === 'cinematicBroadcast' &&
      ['transitionToGameplay', 'liveCarrier'].includes(camera.presentationPhase ?? '')
    );
  }).toBe(true);
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'cinematicBroadcast',
    presentationPhase: 'liveCarrier',
  });

  await page.keyboard.down('w');
  await page.waitForTimeout(150);
  await page.keyboard.up('w');
  await expectNonBlankCanvas(page);
});

test('supports cinematic orbit shot settings without blocking gameplay input', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?cameraDebug=1&readback=1&experience=performance&camera=offense&cinematics=off');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.debug-overlay')).toContainText('CAM offensePerspective');
  expect((await getCameraSnapshot(page)).activeShotName).toBeUndefined();

  await page.goto('/?cameraDebug=1&readback=1&experience=performance&camera=offense&cinematics=brief&audioDebug=1&captions=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.audio-debug-overlay')).toContainText('AUDIO');
  expect((await getAudioSnapshot(page)).captionsEnabled).toBe(true);
  const briefShot = await getCameraSnapshot(page);
  expect(briefShot.activeShotName ?? null).toBeNull();
  expect(briefShot).toMatchObject({
    mode: 'offensePerspective',
    state: 'preSnapFormation',
  });

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
  });
  await expectNonBlankCanvas(page);

  await page.goto('/?cameraDebug=1&readback=1&experience=performance&cinematics=full&shotPreview=touchdownOrbit360');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.debug-overlay')).toContainText('SHOT touchdownOrbit360');
  const fullShot = await getCameraSnapshot(page);
  expect(fullShot.activeShotName).toBe('touchdownOrbit360');
  expect(fullShot.shotProgress).not.toBeNull();
  expect(fullShot.orbitCenter).not.toBeNull();
  expect(fullShot.orbitRadius).toBeGreaterThan(0);
  await expectNonBlankCanvas(page);
});

test('moves the placeholder player with WASD and arrow keys', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const movementCases = [
    { key: 'w', axis: 'z', sign: 1 },
    { key: 'ArrowUp', axis: 'z', sign: 1 },
    { key: 's', axis: 'z', sign: -1 },
    { key: 'ArrowDown', axis: 'z', sign: -1 },
    { key: 'a', axis: 'x', sign: 1 },
    { key: 'ArrowLeft', axis: 'x', sign: 1 },
    { key: 'd', axis: 'x', sign: -1 },
    { key: 'ArrowRight', axis: 'x', sign: -1 },
  ] as const;

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  for (const movementCase of movementCases) {
    await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
    await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
    await page.keyboard.press('Space');
    await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
    const before = await getPlayerSnapshot(page);

    await page.keyboard.down(movementCase.key);
    await page.waitForTimeout(350);
    await page.keyboard.up(movementCase.key);

    const after = await getPlayerSnapshot(page);
    const delta = after.position[movementCase.axis] - before.position[movementCase.axis];
    expect(Math.sign(delta), movementCase.key).toBe(movementCase.sign);
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('keeps D reserved for movement instead of debug toggling', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.debug-overlay')).toBeVisible();
  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  const before = await getPlayerSnapshot(page);

  await page.keyboard.down('d');
  await page.waitForTimeout(350);
  await page.keyboard.up('d');

  const after = await getPlayerSnapshot(page);
  expect(after.position.x).toBeLessThan(before.position.x);
  await expect(page.locator('.debug-overlay')).toBeVisible();
});

test('selects plays before snap and locks selection while live', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('2');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'outside-run', displayName: 'Outside Run' },
    playState: 'preSnap',
  });
  await expect(page.locator('.play-call')).toHaveText('Outside Run');
  const outside = await getGameplaySnapshot(page);
  expect(outside.player.position.x).toBeGreaterThan(0);

  await page.keyboard.press('1');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'inside-run', displayName: 'Inside Run' },
  });
  await expect(page.locator('.play-call')).toHaveText('Inside Run');
  const inside = await getGameplaySnapshot(page);
  expect(inside.player.position.x).toBeCloseTo(0);

  await page.keyboard.press('3');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'quick-pass', displayName: 'Quick Pass', kind: 'pass' },
  });
  await expect(page.locator('.play-call')).toHaveText('Quick Pass');
  const quickPass = await getGameplaySnapshot(page);
  expect(quickPass.player).toMatchObject({ id: 'offense-qb', role: 'quarterback' });
  expect(quickPass.players.find((player) => player.id === 'offense-wr')).toMatchObject({
    role: 'receiver',
  });
  expect(quickPass.selectedReceiver).toEqual({
    displayName: 'Receiver',
    id: 'offense-wr',
  });
  await expect(page.locator('.target-label')).toHaveText('Target #11 Silas Cross');

  await page.keyboard.press('4');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'slant-flat', displayName: 'Slant Flat', kind: 'pass' },
    selectedReceiver: { id: 'offense-wr', displayName: 'Slant' },
  });
  await expect(page.locator('.play-call')).toHaveText('Slant Flat');
  await expect(page.locator('.target-label')).toHaveText('Target #11 Silas Cross');
  const slantFlat = await getGameplaySnapshot(page);
  expect(slantFlat.player).toMatchObject({ id: 'offense-qb', role: 'quarterback' });
  expect(getPlayer(slantFlat, 'offense-wr')).toMatchObject({ role: 'receiver' });
  expect(getPlayer(slantFlat, 'offense-rb')).toMatchObject({ role: 'receiver' });
  expect(getPlayer(slantFlat, 'defense-cover-wr')).toMatchObject({ role: 'coverageDefender' });
  expect(getPlayer(slantFlat, 'defense-rusher-left')).toMatchObject({ role: 'defender' });
  expect(getPlayer(slantFlat, 'defense-cover-rb')).toMatchObject({ role: 'coverageDefender' });

  await page.keyboard.press('e');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedReceiver: { id: 'offense-rb', displayName: 'Flat' },
  });
  await expect(page.locator('.target-label')).toHaveText('Target #24 Miles Redd');

  await page.keyboard.press('1');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'inside-run', displayName: 'Inside Run' },
    selectedReceiver: null,
  });
  await expect(page.locator('.target-label')).toBeHidden();

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await page.keyboard.press('2');
  await page.keyboard.press('3');
  await page.waitForTimeout(100);

  expect((await getGameplaySnapshot(page)).selectedPlay.id).toBe('inside-run');
});

test('runs pre-snap, live, possession, and reset loop', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  const initial = await getGameplaySnapshot(page);

  expect(initial.playState).toBe('preSnap');
  expect(initial.ball.possession).toEqual({ kind: 'none' });
  expect(initial.drive).toMatchObject({
    currentDown: 1,
    firstDownMarker: { x: 0, z: -5 },
    lineOfScrimmage: { x: 0, z: -15 },
    yardsToFirstDown: 10,
  });
  expect(initial.players).toHaveLength(10);
  expect(initial.players.every((player) => player.currentState === 'idle')).toBe(true);
  expect(initial.selectedPlay.displayName).toBe('Inside Run');
  expect(initial.player.position).toEqual({ x: 0, z: -23 });

  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  await page.keyboard.up('w');
  const afterPreSnapMove = await getGameplaySnapshot(page);

  expect(afterPreSnapMove.playState).toBe('preSnap');
  expect(afterPreSnapMove.player.position.x).toBeCloseTo(initial.player.position.x);
  expect(afterPreSnapMove.player.position.z).toBeCloseTo(initial.player.position.z);

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { possession: { kind: 'player' } },
    playState: 'live',
  });

  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  await page.keyboard.up('w');
  const afterLiveMove = await getGameplaySnapshot(page);

  expect(afterLiveMove.player.position.z).toBeGreaterThan(initial.player.position.z);
  expect(afterLiveMove.ball.possession).toMatchObject({ kind: 'player' });
  expect(afterLiveMove.ball.position.z).toBeGreaterThan(initial.player.position.z);
  expect(afterLiveMove.player.currentState).toBe('userControlled');
  expect(afterLiveMove.players.some((player) => player.role === 'blocker' && player.currentState !== 'idle')).toBe(true);
  expect(afterLiveMove.players.some((player) => player.role === 'defender' && player.currentState !== 'idle')).toBe(true);

  await page.keyboard.press('r');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { possession: { kind: 'none' } },
    lastPlayResult: null,
    player: { position: { x: 0, z: -23 }, velocity: { x: 0, z: 0 } },
    playState: 'preSnap',
  });
  await expect(page.locator('.drive-status')).toHaveText('1st & 10 | Ball -15');
});

test('selects Quick Pass, starts the route after snap, and throws once', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('3');
  await expect(page.locator('.play-call')).toHaveText('Quick Pass');
  const preSnap = await getGameplaySnapshot(page);
  const receiverBeforeSnap = getPlayer(preSnap, 'offense-wr');

  expect(preSnap.selectedPlay).toMatchObject({ id: 'quick-pass', kind: 'pass' });
  expect(preSnap.player).toMatchObject({ id: 'offense-qb', role: 'quarterback' });
  expect(receiverBeforeSnap).toMatchObject({ role: 'receiver', currentState: 'idle' });
  expect(preSnap.ball.state).toEqual({ kind: 'dead' });

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { state: { kind: 'possessed' } },
    playState: 'live',
  });

  const live = await getGameplaySnapshot(page);
  expect(getPlayer(live, 'offense-wr').currentState).toBe('runningRoute');

  await page.keyboard.press('f');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    passAttempted: true,
  });
  const afterThrow = await getGameplaySnapshot(page);
  expect(['inFlight', 'caught', 'incomplete', 'dead']).toContain(afterThrow.ball.state.kind);

  await page.keyboard.press('f');
  await page.waitForTimeout(100);
  expect((await getGameplaySnapshot(page)).passAttempted).toBe(true);
});

test('selects Slant Flat, cycles the target, and throws to the selected receiver', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('4');
  await expect(page.locator('.play-call')).toHaveText('Slant Flat');
  await expect(page.locator('.target-label')).toHaveText('Target #11 Silas Cross');
  const preSnap = await getGameplaySnapshot(page);
  const leftReceiverBeforeSnap = getPlayer(preSnap, 'offense-wr');
  const rightReceiverBeforeSnap = getPlayer(preSnap, 'offense-rb');

  expect(preSnap.selectedReceiver).toEqual({ displayName: 'Slant', id: 'offense-wr' });
  expect(leftReceiverBeforeSnap).toMatchObject({ role: 'receiver', currentState: 'idle' });
  expect(rightReceiverBeforeSnap).toMatchObject({ role: 'receiver', currentState: 'idle' });

  await page.keyboard.press('e');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedReceiver: { displayName: 'Flat', id: 'offense-rb' },
  });
  await expect(page.locator('.target-label')).toHaveText('Target #24 Miles Redd');

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { state: { kind: 'possessed' } },
    playState: 'live',
    selectedReceiver: { id: 'offense-rb' },
  });
  const live = await getGameplaySnapshot(page);
  expect(getPlayer(live, 'offense-wr').currentState).toBe('runningRoute');
  expect(getPlayer(live, 'offense-rb').currentState).toBe('runningRoute');

  await page.keyboard.press('f');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    passAttempted: true,
    selectedReceiver: { id: 'offense-rb' },
  });
  const afterThrow = await getGameplaySnapshot(page);

  expect(['inFlight', 'caught', 'incomplete', 'dead']).toContain(afterThrow.ball.state.kind);
  if (afterThrow.ball.state.kind === 'inFlight') {
    expect(afterThrow.ball.state.target.x).toBeLessThan(0);
  }

  await page.keyboard.press('e');
  await page.waitForTimeout(100);
  expect((await getGameplaySnapshot(page)).selectedReceiver).toEqual({
    displayName: 'Flat',
    id: 'offense-rb',
  });
});

test('offense perspective tracks an in-flight pass', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&camera=offense&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('4');
  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { state: { kind: 'possessed' } },
    playState: 'live',
  });
  await page.keyboard.press('f');
  await expect.poll(() => getCameraSnapshot(page), { timeout: 1500 }).toMatchObject({
    mode: 'offensePerspective',
    state: 'passFlight',
  });
  await expectNonBlankCanvas(page);
});

test('rejects Quick Pass after the quarterback crosses the line of scrimmage', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&routeArt=0&playbook=5v5&playerMotion=0');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('3');
  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { state: { kind: 'possessed' } },
    forwardPassEligible: true,
    playState: 'live',
  });

  expect(await forceQuarterbackPastLineForTest(page)).toBe(true);
  await page.keyboard.press('f');

  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    passAttempted: false,
    passFeedback: 'pastLineOfScrimmage',
  });
  const afterPass = await getGameplaySnapshot(page);
  expect(afterPass.ball.state.kind).not.toBe('inFlight');
  expect(afterPass.lastPlayResult?.type).not.toBe('incomplete');
  await expect(page.locator('.pass-warning-message')).toHaveText('PAST LINE OF SCRIMMAGE');
  await expect(page.locator('.pass-warning-message')).toBeVisible();
});

test('scores touchdown by avoiding the defender and auto-resets', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.score-counter')).toHaveText('Score 0');

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(850);
  await page.keyboard.up('d');
  const touchdown = await waitForVisibleTouchdownResult(page, 9000);
  await page.keyboard.up('w');

  expect(touchdown.lastPlayResult?.type).toBe('touchdown');
  expect(touchdown.lastPlayResult?.scoringTeam).toBe('offense');
  expect(touchdown.drive.state).toBe('over');
  expect(touchdown.drive.lastDriveResult?.type).toBe('touchdown');
  expect(touchdown.score).toBe(6);
  await expect(page.locator('.score-counter')).toHaveText('Score 6');

  await page.keyboard.down('w');
  await page.waitForTimeout(250);
  await page.keyboard.up('w');
  const whileDead = await getGameplaySnapshot(page);
  if (whileDead.playState === 'dead') {
    expect(whileDead.player.position.z).toBeCloseTo(touchdown.player.position.z);
  }
  expect(whileDead.score).toBe(6);

  await expect.poll(() => getGameplaySnapshot(page), { timeout: 7000 }).toMatchObject({
    ball: { possession: { kind: 'none' } },
    currentBallSpot: { x: 0, z: -15 },
    drive: {
      currentDown: 1,
      lineOfScrimmage: { x: 0, z: -15 },
      state: 'active',
      yardsToFirstDown: 10,
    },
    lastPlayResult: null,
    player: { position: { x: 0, z: -23 }, velocity: { x: 0, z: 0 } },
    playState: 'preSnap',
    score: 6,
  });
  await expect(page.locator('.score-counter')).toHaveText('Score 6');
  await expect(page.locator('.touchdown-message')).toBeHidden();
});

test('defender tackles the ball carrier and auto-resets', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.score-counter')).toHaveText('Score 0');

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await page.keyboard.down('w');
  await expect.poll(async () => (await getGameplaySnapshot(page)).playState, {
    timeout: 5000,
  }).toBe('dead');
  await page.keyboard.up('w');

  const tackle = await getGameplaySnapshot(page);
  expect(tackle.lastPlayResult?.type).toBe('tackle');
  expect(tackle.lastPlayResult?.yardsGained).toEqual(expect.any(Number));
  expect(tackle.drive.currentDown).toBeGreaterThanOrEqual(1);
  expect(tackle.drive.lineOfScrimmage).toEqual(tackle.nextBallSpot);
  expect(tackle.score).toBe(0);
  await expect(page.locator('.score-counter')).toHaveText('Score 0');
  await expect(page.locator('.tackle-message')).toBeVisible();
  await expect(page.locator('.result-message')).toContainText('yards');

  await page.keyboard.down('w');
  await page.waitForTimeout(250);
  await page.keyboard.up('w');
  const whileDead = await getGameplaySnapshot(page);
  if (whileDead.playState === 'dead') {
    expect(whileDead.player.position.z).toBeCloseTo(tackle.player.position.z);
    expect(getDefenders(whileDead).some((defender) => vectorLength(defender.velocity) > 0)).toBe(false);
  }

  await expect.poll(() => getGameplaySnapshot(page), { timeout: 3000 }).toMatchObject({
    ball: { possession: { kind: 'none' } },
    currentBallSpot: tackle.nextBallSpot,
    lastPlayResult: null,
    player: {
      position: { x: tackle.nextBallSpot.x, z: tackle.nextBallSpot.z - 8 },
      velocity: { x: 0, z: 0 },
    },
    playState: 'preSnap',
    score: 0,
  });
  await expect(page.locator('.tackle-message')).toBeHidden();
});

test('going out of bounds ends the play and resets at the resolved snap spot', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await page.keyboard.down('d');
  const outOfBounds = await waitForDeadPlayResult(page, 'outOfBounds', 5000);
  await page.keyboard.up('d');
  expect(outOfBounds.lastPlayResult?.type).toBe('outOfBounds');
  expect(outOfBounds.lastPlayResult?.yardsGained).toEqual(expect.any(Number));
  expect(outOfBounds.drive.currentDown).toBe(2);
  expect(outOfBounds.drive.lineOfScrimmage).toEqual(outOfBounds.nextBallSpot);

  await expect.poll(() => getGameplaySnapshot(page), { timeout: 3000 }).toMatchObject({
    ball: { possession: { kind: 'none' } },
    currentBallSpot: outOfBounds.nextBallSpot,
    drive: {
      currentDown: 2,
      lineOfScrimmage: outOfBounds.nextBallSpot,
      state: 'active',
    },
    lastPlayResult: null,
    player: {
      position: { x: outOfBounds.nextBallSpot.x, z: outOfBounds.nextBallSpot.z - 8 },
      velocity: { x: 0, z: 0 },
    },
    playState: 'preSnap',
  });
  await expect(page.locator('.out-of-bounds-message')).toBeHidden();
});

test('failed fourth down shows turnover and starts a new drill', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&playbook=5v5');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const firstDownFailure = await runOutOfBoundsPlay(page);
  expect(firstDownFailure.drive.currentDown).toBe(2);
  await waitForPreSnap(page);
  await expect(page.locator('.drive-status')).toContainText('2nd &');

  const secondDownFailure = await runOutOfBoundsPlay(page);
  expect(secondDownFailure.drive.currentDown).toBe(3);
  await waitForPreSnap(page);
  await expect(page.locator('.drive-status')).toContainText('3rd &');

  const thirdDownFailure = await runOutOfBoundsPlay(page);
  expect(thirdDownFailure.drive.currentDown).toBe(4);
  await waitForPreSnap(page);
  await expect(page.locator('.drive-status')).toContainText('4th &');

  const fourthDownFailure = await runOutOfBoundsPlay(page);
  expect(fourthDownFailure.drive.state).toBe('over');
  expect(fourthDownFailure.drive.lastDriveResult?.type).toBe('turnoverOnDowns');
  expect(fourthDownFailure.nextBallSpot).toEqual({ x: 0, z: -15 });
  await expect(page.locator('.turnover-message')).toBeVisible();

  await expect.poll(() => getGameplaySnapshot(page), { timeout: 3000 }).toMatchObject({
    ball: { possession: { kind: 'none' } },
    currentBallSpot: { x: 0, z: -15 },
    drive: {
      currentDown: 1,
      lineOfScrimmage: { x: 0, z: -15 },
      state: 'active',
      yardsToFirstDown: 10,
    },
    lastPlayResult: null,
    player: { position: { x: 0, z: -23 }, velocity: { x: 0, z: 0 } },
    playState: 'preSnap',
  });
  await expect(page.locator('.turnover-message')).toBeHidden();
  await expect(page.locator('.drive-status')).toHaveText('1st & 10 | Ball -15');
});

async function assertCleanPresentationAudit(
  page: Page,
  options: {
    cameraMode: PresentationAuditSnapshot['cameraMode'];
    playerMotionEnabled?: boolean;
    presentationPhase?: PresentationAuditSnapshot['presentationPhase'];
    screenshotName: string;
    snapLane: PresentationAuditSnapshot['snapLane'];
    state: PresentationAuditSnapshot['state'];
    testInfo: TestInfo;
  },
): Promise<void> {
  await expect.poll(async () => {
    const audit = await getPresentationAuditSnapshot(page);

    return (
      audit.cameraMode === options.cameraMode &&
      audit.snapLane === options.snapLane &&
      audit.state === options.state &&
      audit.players.length === 14 &&
      audit.formationIssueCount === 0 &&
      audit.allFeetGrounded &&
      audit.allHelmetsAttached &&
      audit.stableHelmetGaps &&
      (options.state !== 'preSnap' || audit.allPlayersInsideFramingMargin) &&
      audit.issues.length === 0 &&
      (options.playerMotionEnabled === undefined ||
        audit.playerMotionEnabled === options.playerMotionEnabled) &&
      (options.presentationPhase === undefined ||
        audit.presentationPhase === options.presentationPhase)
    );
  }, {
    timeout: 2500,
  }).toBe(true);

  const audit = await getPresentationAuditSnapshot(page);
  expect(audit.renderMetrics).toMatchObject({
    playerCount: 14,
  });
  expect(audit.renderMetrics?.calls).toBeGreaterThan(0);
  expect(audit.renderMetrics?.triangles).toBeGreaterThan(0);
  expect(audit.players.every((player) => player.rootMatchesGameplay)).toBe(true);
  if (options.state === 'preSnap') {
    expect(audit.players.every((player) => player.withinFramingMargin)).toBe(true);
  }
  expect(audit.players.every((player) => !player.significantGeometryBelowField)).toBe(true);
  await expect(page.locator('.presentation-audit-overlay')).toContainText('PRESENTATION AUDIT');
  await expectNonBlankCanvas(page);
  await page.screenshot({ path: options.testInfo.outputPath(options.screenshotName), fullPage: true });
}

async function waitForVisibleTouchdownResult(
  page: Page,
  timeoutMs = 3000,
): Promise<GameplaySnapshot> {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot: GameplaySnapshot | null = null;

  while (Date.now() < deadline) {
    const snapshot = await getGameplaySnapshot(page);
    lastSnapshot = snapshot;
    const touchdownMessageVisible = await page
      .locator('.touchdown-message')
      .evaluate((element) => !element.hasAttribute('hidden'));

    if (
      snapshot.playState === 'dead' &&
      snapshot.lastPlayResult?.type === 'touchdown' &&
      snapshot.score === 6 &&
      touchdownMessageVisible
    ) {
      return snapshot;
    }

    await page.waitForTimeout(50);
  }

  throw new Error(
    `Timed out waiting for visible touchdown result; last snapshot ${JSON.stringify(
      lastSnapshot?.lastPlayResult ?? null,
    )}`,
  );
}

async function expectNonBlankCanvas(page: Page): Promise<void> {
  let renderState = await readCanvasState(page);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (renderState.nonBlankPixels > 100 && renderState.uniqueColors > 3) {
      break;
    }

    await page.waitForTimeout(50);
    renderState = await readCanvasState(page);
  }

  expect(renderState.hasCanvas).toBe(true);
  expect(renderState.width).toBeGreaterThan(0);
  expect(renderState.height).toBeGreaterThan(0);
  expect(renderState.nonBlankPixels).toBeGreaterThan(100);
  expect(renderState.uniqueColors).toBeGreaterThan(3);
}

async function readCanvasState(page: Page): Promise<{
  hasCanvas: boolean;
  height: number;
  nonBlankPixels: number;
  uniqueColors: number;
  width: number;
}> {
  return page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) {
      return { hasCanvas: false, nonBlankPixels: 0, uniqueColors: 0, width: 0, height: 0 };
    }

    const context = canvasElement.getContext('webgl2') ?? canvasElement.getContext('webgl');
    const width = canvasElement.width;
    const height = canvasElement.height;
    const sampleWidth = Math.min(96, width);
    const sampleHeight = Math.min(96, height);
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);

    context?.readPixels(
      Math.floor((width - sampleWidth) / 2),
      Math.floor((height - sampleHeight) / 2),
      sampleWidth,
      sampleHeight,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels,
    );

    let nonBlankPixels = 0;
    const uniqueColors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] !== 0 || pixels[index + 1] !== 0 || pixels[index + 2] !== 0) {
        nonBlankPixels += 1;
      }
      uniqueColors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
    }

    return { hasCanvas: true, nonBlankPixels, uniqueColors: uniqueColors.size, width, height };
  });
}

async function getDebugOverlayNumber(page: Page, label: string): Promise<number> {
  const text = await page.locator('.debug-overlay').textContent();
  const match = text?.match(new RegExp(`${label} ([0-9.]+)`));

  if (!match) {
    throw new Error(`Missing debug overlay metric ${label}`);
  }

  return Number(match[1]);
}

async function runOutOfBoundsPlay(page: Page): Promise<GameplaySnapshot> {
  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await page.keyboard.down('d');
  const snapshot = await waitForDeadPlayResult(page, 'outOfBounds', 5000);
  await page.keyboard.up('d');

  return snapshot;
}

async function waitForPreSnap(page: Page): Promise<GameplaySnapshot> {
  await expect.poll(async () => (await getGameplaySnapshot(page)).playState, {
    timeout: 3000,
  }).toBe('preSnap');

  return getGameplaySnapshot(page);
}

async function waitForDeadPlayResult(
  page: Page,
  resultType: PlayResultSnapshot['type'],
  timeoutMs = 3000,
): Promise<GameplaySnapshot> {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot: GameplaySnapshot | null = null;

  while (Date.now() < deadline) {
    const snapshot = await getGameplaySnapshot(page);
    lastSnapshot = snapshot;

    if (
      snapshot.playState === 'dead' &&
      snapshot.lastPlayResult?.type === resultType
    ) {
      return snapshot;
    }

    await page.waitForTimeout(25);
  }

  throw new Error(
    `Timed out waiting for ${resultType} result; last snapshot ${JSON.stringify(
      lastSnapshot?.lastPlayResult ?? null,
    )}`,
  );
}

function getDefenders(gameplay: GameplaySnapshot): PlayerSnapshot[] {
  return gameplay.players.filter((player) => player.role === 'defender');
}

function getPlayer(gameplay: GameplaySnapshot, playerId: string): PlayerSnapshot {
  const player = gameplay.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing player ${playerId}`);
  }

  return player;
}

function getPreviewPlayer(
  preview: FormationPreviewSnapshot,
  playerId: string,
): PlayerSnapshot {
  const player = preview.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing preview player ${playerId}`);
  }

  return player;
}

function vectorLength(vector: { x: number; z: number }): number {
  return Math.hypot(vector.x, vector.z);
}

function vector3Distance(first: Vector3Snapshot, second: Vector3Snapshot): number {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    first.z - second.z,
  );
}

async function getPlayerSnapshot(page: Page): Promise<PlayerSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPlayerSnapshot: () => PlayerSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getPlayerSnapshot();
  });
}

async function getGameplaySnapshot(page: Page): Promise<GameplaySnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getGameplaySnapshot: () => GameplaySnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getGameplaySnapshot();
  });
}

async function getGameExperienceSnapshot(page: Page): Promise<GameExperienceSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getGameExperienceSnapshot: () => GameExperienceSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getGameExperienceSnapshot();
  });
}

async function getMatchSnapshot(page: Page): Promise<MatchSnapshot | null> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getMatchSnapshot: () => MatchSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getMatchSnapshot();
  });
}

async function getKickoffSnapshot(page: Page): Promise<KickoffPresentationSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getKickoffSnapshot: () => KickoffPresentationSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getKickoffSnapshot();
  });
}

async function getStadiumSnapshot(page: Page): Promise<StadiumSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getStadiumSnapshot: () => StadiumSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getStadiumSnapshot();
  });
}

async function getQualityDebugSnapshot(page: Page): Promise<QualityDebugSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getQualityDebugSnapshot: () => QualityDebugSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getQualityDebugSnapshot();
  });
}

async function getPassAuditSnapshot(page: Page): Promise<PassAuditSnapshot | null> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPassAuditSnapshot: () => PassAuditSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getPassAuditSnapshot();
  });
}

async function forceQuarterbackPastLineForTest(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          forceQuarterbackPastLineForTest: () => boolean;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.forceQuarterbackPastLineForTest();
  });
}

async function getCameraSnapshot(page: Page): Promise<CameraSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getCameraSnapshot: () => CameraSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getCameraSnapshot();
  });
}

async function getHelmetAssetSnapshot(page: Page): Promise<HelmetAssetSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getHelmetAssetSnapshot: () => HelmetAssetSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getHelmetAssetSnapshot();
  });
}

async function getBallVisualSnapshot(page: Page): Promise<BallVisualSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getBallVisualSnapshot: () => BallVisualSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getBallVisualSnapshot();
  });
}

async function getAppearanceAuditSnapshot(page: Page): Promise<AppearanceAuditSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getAppearanceAuditSnapshot: () => AppearanceAuditSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getAppearanceAuditSnapshot();
  });
}

async function getPlayerBodyVisualSnapshots(page: Page): Promise<PlayerBodyVisualSnapshot[]> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPlayerBodyVisualSnapshots: () => PlayerBodyVisualSnapshot[];
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getPlayerBodyVisualSnapshots();
  });
}

async function getPlayerPoseSnapshots(page: Page): Promise<PlayerPoseSnapshot[]> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPlayerPoseSnapshots: () => PlayerPoseSnapshot[];
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getPlayerPoseSnapshots();
  });
}

async function getFormationPreviewSnapshot(page: Page): Promise<FormationPreviewSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getFormationPreviewSnapshot: () => FormationPreviewSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const snapshot = debugApi.getFormationPreviewSnapshot();

    if (!snapshot) {
      throw new Error('Missing formation preview snapshot');
    }

    return snapshot;
  });
}

async function getPresentationAuditSnapshot(page: Page): Promise<PresentationAuditSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPresentationAuditSnapshot: () => PresentationAuditSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const snapshot = debugApi.getPresentationAuditSnapshot();

    if (!snapshot) {
      throw new Error('Missing presentation audit snapshot');
    }

    return snapshot;
  });
}

async function getRouteArtSnapshot(page: Page): Promise<RouteArtRendererSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getRouteArtSnapshot: () => RouteArtRendererSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getRouteArtSnapshot();
  });
}

async function getAudioSnapshot(page: Page): Promise<AudioRuntimeSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getAudioSnapshot: () => AudioRuntimeSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getAudioSnapshot();
  });
}

async function getCrowdPreviewSnapshot(page: Page): Promise<CrowdPreviewSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getCrowdPreviewSnapshot: () => CrowdPreviewSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const snapshot = debugApi.getCrowdPreviewSnapshot();

    if (!snapshot) {
      throw new Error('Missing crowd preview snapshot');
    }

    return snapshot;
  });
}

async function getCrowdPresentationSnapshot(page: Page): Promise<CrowdPresentationSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getCrowdPresentationSnapshot: () => CrowdPresentationSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const snapshot = debugApi.getCrowdPresentationSnapshot();

    if (!snapshot) {
      throw new Error('Missing crowd presentation snapshot');
    }

    return snapshot;
  });
}

async function getOfficialsSnapshot(page: Page): Promise<OfficialsPresentationSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getOfficialsSnapshot: () => OfficialsPresentationSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getOfficialsSnapshot();
  });
}

async function getControlledPlayerLabelSnapshot(page: Page): Promise<ControlledPlayerLabelSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getControlledPlayerLabelSnapshot: () => ControlledPlayerLabelSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getControlledPlayerLabelSnapshot();
  });
}

async function getOptionalCrowdPresentationSnapshot(
  page: Page,
): Promise<CrowdPresentationSnapshot | null> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getCrowdPresentationSnapshot: () => CrowdPresentationSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getCrowdPresentationSnapshot();
  });
}

async function getPresentationHoldSnapshot(page: Page): Promise<PresentationHoldSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPresentationHoldSnapshot: () => PresentationHoldSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getPresentationHoldSnapshot();
  });
}

async function getGamePresentationRuntimeSnapshot(page: Page): Promise<GamePresentationRuntimeSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getGamePresentationRuntimeSnapshot: () => GamePresentationRuntimeSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getGamePresentationRuntimeSnapshot();
  });
}

async function getPregamePresentationSnapshot(page: Page): Promise<PregamePresentationSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPregamePresentationSnapshot: () => PregamePresentationSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getPregamePresentationSnapshot();
  });
}

async function expectNoDebugHelpers(page: Page): Promise<void> {
  const visibleDebugHelpers = await page.evaluate(() => {
    const selectors = [
      '.debug-panel',
      '.debug-overlay',
      '.officials-debug-overlay',
      '.field-audit-overlay',
      '.formation-audit-overlay',
      '.route-audit-overlay',
      '.pass-audit-overlay',
      '.memory-debug-panel',
      '.presentation-audit-overlay',
      '.presentation-hardening-audit-overlay',
      '.pregame-debug-overlay',
      '.camera-debug-overlay',
    ];

    return selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((element) => {
          const style = window.getComputedStyle(element);
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            element.getClientRects().length > 0
          );
        })
        .map((element) => ({
          className: element.className,
          selector,
          text: element.textContent?.trim().slice(0, 80) ?? '',
        })),
    );
  });

  expect(visibleDebugHelpers).toEqual([]);
}

async function getSevenAuditSnapshot(page: Page): Promise<SevenAuditSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getSevenAuditSnapshot: () => SevenAuditSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const snapshot = debugApi.getSevenAuditSnapshot();

    if (!snapshot) {
      throw new Error('Missing seven audit snapshot');
    }

    return snapshot;
  });
}

async function getElevenAuditSnapshot(page: Page): Promise<ElevenAuditSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getElevenAuditSnapshot: () => ElevenAuditSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const snapshot = debugApi.getElevenAuditSnapshot();

    if (!snapshot) {
      throw new Error('Missing eleven audit snapshot');
    }

    return snapshot;
  });
}

async function runSevenAuditResetCycles(
  page: Page,
  cycles: number,
): Promise<SevenAuditResetCycleResult> {
  return page.evaluate((cycleCount) => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          runSevenAuditResetCycles: (cycles?: number) => SevenAuditResetCycleResult | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const result = debugApi.runSevenAuditResetCycles(cycleCount);

    if (!result) {
      throw new Error('Missing seven audit reset-cycle result');
    }

    return result;
  }, cycles);
}

async function runElevenAuditResetCycles(
  page: Page,
  cycles: number,
): Promise<ElevenAuditResetCycleResult> {
  return page.evaluate((cycleCount) => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          runElevenAuditResetCycles: (cycles?: number) => ElevenAuditResetCycleResult | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const result = debugApi.runElevenAuditResetCycles(cycleCount);

    if (!result) {
      throw new Error('Missing eleven audit reset-cycle result');
    }

    return result;
  }, cycles);
}

async function getPresentationHardeningAuditSnapshot(page: Page): Promise<PresentationHardeningAuditSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPresentationHardeningAuditSnapshot: () => PresentationHardeningAuditSnapshot | null;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    const snapshot = debugApi.getPresentationHardeningAuditSnapshot();

    if (!snapshot) {
      throw new Error('Missing presentation hardening audit snapshot');
    }

    return snapshot;
  });
}

async function playAudioTestOneShot(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          playAudioTestOneShot: () => Promise<boolean>;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.playAudioTestOneShot();
  });
}

async function startAudioTestLoop(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          startAudioTestLoop: () => Promise<boolean>;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.startAudioTestLoop();
  });
}

async function stopAudioTestLoop(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          stopAudioTestLoop: () => boolean;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.stopAudioTestLoop();
  });
}

async function setAudioMuted(page: Page, muted: boolean): Promise<void> {
  return page.evaluate((nextMuted) => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          setAudioMuted: (muted: boolean) => void;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    debugApi.setAudioMuted(nextMuted);
  }, muted);
}

async function setAudioPageActiveForTest(page: Page, active: boolean): Promise<void> {
  return page.evaluate((nextActive) => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          setAudioPageActiveForTest: (active: boolean) => void;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    debugApi.setAudioPageActiveForTest(nextActive);
  }, active);
}

async function getRenderMetrics(page: Page): Promise<RenderMetricsSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getRenderMetrics: () => RenderMetricsSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getRenderMetrics();
  });
}

async function getCameraFramingSnapshot(page: Page): Promise<CameraFramingSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getCameraFramingSnapshot: () => CameraFramingSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getCameraFramingSnapshot();
  });
}
