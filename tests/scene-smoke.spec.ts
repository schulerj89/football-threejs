import { expect, test, type Page, type TestInfo } from '@playwright/test';

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
  playbookId: '5v5' | '7v7';
  selectedPlay: {
    displayName: string;
    id: 'inside-run' | 'outside-run' | 'quick-pass' | 'slant-flat' | 'twin-slants-flat';
    kind: 'run' | 'pass';
    initialMovementDirection: FootballSpot;
  };
  selectedReceiver: { displayName: string; id: string } | null;
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
  presentationPhase?:
    | 'deadBallResult'
    | 'liveCarrier'
    | 'passFlight'
    | 'preSnapEstablish'
    | 'returnToPreSnap'
    | 'touchdownResult'
    | 'transitionToGameplay';
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
  helmetBounds: null | {
    center: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    min: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  helmetShoulderVerticalGap: number | null;
  meshesPerPlayer: number;
  minimumBodyY: number;
  playerId: string;
  shoulderWidth: number;
  totalHeight: number;
  uniqueBodyGeometryCount: number;
  uniqueBodyMaterialCount: number;
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
  mode: '7v7';
  players: PlayerSnapshot[];
  snapLane: 'leftHash' | 'middle' | 'rightHash';
  snapPlacement: { lane: 'leftHash' | 'middle' | 'rightHash'; spot: FootballSpot };
}

interface RenderMetricsSnapshot {
  calls: number;
  frameTimeMs: number;
  geometries: number;
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
  await page.goto('/?debug=1&readback=1');
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
  expect(bodySnapshots.every((snapshot) => snapshot.meshesPerPlayer === 8)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.uniqueBodyGeometryCount === 5)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.uniqueBodyMaterialCount === 4)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyTriangleCount >= 300)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyTriangleCount <= 700)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyBounds.min.y >= -0.001)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.minimumBodyY >= -0.001)).toBe(true);
  expect(bodySnapshots.every((snapshot) => snapshot.helmetBounds !== null)).toBe(true);
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
  await expect.poll(() => getDebugOverlayNumber(page, 'CALLS')).toBeLessThan(190);
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

test('supports the box player body comparison URL option', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&playerBody=box');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const bodySnapshots = await getPlayerBodyVisualSnapshots(page);

  expect(bodySnapshots).toHaveLength(10);
  expect(bodySnapshots.every((snapshot) => snapshot.bodyStyle === 'box')).toBe(true);
  await expect(page.locator('.debug-overlay')).toContainText('BODY box');
  await expectNonBlankCanvas(page);
});

test('supports procedural player motion debug and comparison modes', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&poseDebug=1');
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

  await page.goto('/?debug=1&readback=1&poseDebug=1&playerMotion=0');
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

  await page.goto('/?debug=1&readback=1&fieldAudit=1&formationAudit=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.debug-overlay')).toContainText('FPS');
  await expect(page.locator('.formation-audit-overlay')).toContainText('FORMATION AUDIT');
  await expect(page.locator('.formation-audit-overlay')).toContainText('PLAY Inside Run');
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
  await page.goto('/?debug=1&readback=1&formationPreview=7v7&formationAudit=1');
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
  expect(metrics.calls).toBeLessThan(260);
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

test('runs 7v7 presentation audit scenarios with screenshots', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?readback=1&formationPreview=7v7&presentationAudit=1&camera=tactical');
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

  await page.goto('/?readback=1&formationPreview=7v7&presentationAudit=1&presentationState=locomotion&playerMotion=0&camera=cinematic');
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
  await page.goto('/?debug=1&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const cards = page.locator('.play-card');
  await expect(page.locator('.play-call-ui')).toBeVisible();
  await expect(cards).toHaveCount(4);
  await expect(cards.locator('.play-card-title')).toHaveText([
    'Inside Run',
    'Outside Run',
    'Quick Pass',
    'Slant Flat',
  ]);
  await expect(page.locator('.play-card[data-play-id="inside-run"] .play-card-run-direction')).toHaveCount(1);
  await expect(page.locator('.play-card[data-play-id="outside-run"] .play-card-run-direction')).toHaveCount(1);
  await expect(page.locator('.play-card[data-play-id="quick-pass"] .play-card-receiver-route')).toHaveCount(1);
  await expect(page.locator('.play-card[data-play-id="slant-flat"] .play-card-receiver-route')).toHaveCount(2);
  await expect(page.locator('.play-card[data-play-id="inside-run"]')).toHaveAttribute('data-selected', 'true');

  await page.locator('.play-card[data-play-id="outside-run"]').click();
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'outside-run', displayName: 'Outside Run' },
  });
  await expect(page.locator('.play-card[data-play-id="outside-run"]')).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('3');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'quick-pass', displayName: 'Quick Pass' },
  });
  await expect(page.locator('.play-card[data-play-id="quick-pass"]')).toHaveAttribute('data-selected', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards).toHaveCount(4);
  await expect(page.locator('.play-call-ui')).toBeVisible();

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await expect(page.locator('.play-call-ui')).toBeHidden();

  await page.keyboard.press('1');
  await page.waitForTimeout(100);
  expect((await getGameplaySnapshot(page)).selectedPlay.id).toBe('quick-pass');
});

test('starts playable 7v7 Twin Slants Flat and throws to the selected target', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&playbook=7v7');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const initial = await getGameplaySnapshot(page);
  expect(initial.playbookId).toBe('7v7');
  expect(initial.selectedPlay).toMatchObject({
    displayName: 'Twin Slants Flat',
    id: 'twin-slants-flat',
    kind: 'pass',
  });
  expect(initial.players).toHaveLength(14);
  expect(initial.players.filter((player) => player.team === 'offense')).toHaveLength(7);
  expect(initial.players.filter((player) => player.team === 'defense')).toHaveLength(7);
  expect(initial.selectedReceiver).toEqual({
    displayName: 'Receiver Left',
    id: 'offense-wr-left',
  });
  await expect(page.locator('.play-card')).toHaveCount(1);
  await expect(page.locator('.play-card-title')).toHaveText('Twin Slants Flat');
  await expect(page.locator('.play-card[data-play-id="twin-slants-flat"] .play-card-receiver-route')).toHaveCount(3);
  await expect(page.locator('.play-card[data-play-id="twin-slants-flat"] .play-card-blocker-assignment')).toHaveCount(3);

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

test('selects offense perspective camera and toggles modes without resetting gameplay', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1&readback=1&camera=offense');
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
  await page.keyboard.down('w');
  await page.waitForTimeout(250);
  await page.keyboard.up('w');
  const beforeToggle = await getGameplaySnapshot(page);
  await expect.poll(() => getCameraSnapshot(page)).toMatchObject({
    mode: 'offensePerspective',
    state: 'carrierFollow',
  });

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
  await page.goto('/?debug=1&readback=1&camera=cinematic');
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
    await page.goto('/?debug=1&readback=1');
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
  await page.goto('/?debug=1&readback=1');
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
  await page.goto('/?debug=1&readback=1');
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
  await expect(page.locator('.target-label')).toHaveText('Target Receiver');

  await page.keyboard.press('4');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    selectedPlay: { id: 'slant-flat', displayName: 'Slant Flat', kind: 'pass' },
    selectedReceiver: { id: 'offense-wr', displayName: 'Slant' },
  });
  await expect(page.locator('.play-call')).toHaveText('Slant Flat');
  await expect(page.locator('.target-label')).toHaveText('Target Slant');
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
  await expect(page.locator('.target-label')).toHaveText('Target Flat');

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
  await page.goto('/?debug=1&readback=1');
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
  await page.waitForTimeout(350);
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
  await page.waitForTimeout(350);
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
  await page.goto('/?debug=1&readback=1');
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
  await page.goto('/?debug=1&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('4');
  await expect(page.locator('.play-call')).toHaveText('Slant Flat');
  await expect(page.locator('.target-label')).toHaveText('Target Slant');
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
  await expect(page.locator('.target-label')).toHaveText('Target Flat');

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
  await page.goto('/?debug=1&readback=1&camera=offense');
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
  await page.goto('/?debug=1&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('3');
  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { state: { kind: 'possessed' } },
    forwardPassEligible: true,
    playState: 'live',
  });

  await page.keyboard.down('w');
  await page.waitForFunction(() => {
    const debugApi = (
      window as Window & {
        __footballDebug?: {
          getGameplaySnapshot: () => GameplaySnapshot;
        };
      }
    ).__footballDebug;
    const snapshot = debugApi?.getGameplaySnapshot();

    if (snapshot?.playState === 'live' && !snapshot.forwardPassEligible) {
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyF', key: 'f' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, code: 'KeyF', key: 'f' }));
      return true;
    }

    return false;
  }, undefined, {
    polling: 'raf',
    timeout: 3500,
  });
  await page.keyboard.up('w');

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
  await page.goto('/?debug=1&readback=1');
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
    score: 6,
  });
  await expect(page.locator('.score-counter')).toHaveText('Score 6');
  await expect(page.locator('.touchdown-message')).toBeHidden();
});

test('defender tackles the ball carrier and auto-resets', async ({ page }) => {
  await page.goto('/?debug=1&readback=1');
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
  await page.goto('/?debug=1&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await page.keyboard.down('d');
  await expect.poll(async () => (await getGameplaySnapshot(page)).playState, {
    timeout: 5000,
  }).toBe('dead');
  await page.keyboard.up('d');

  const outOfBounds = await getGameplaySnapshot(page);
  expect(outOfBounds.lastPlayResult?.type).toBe('outOfBounds');
  expect(outOfBounds.lastPlayResult?.yardsGained).toEqual(expect.any(Number));
  expect(outOfBounds.drive.currentDown).toBe(2);
  expect(outOfBounds.drive.lineOfScrimmage).toEqual(outOfBounds.nextBallSpot);
  await expect(page.locator('.out-of-bounds-message')).toBeVisible();
  await expect(page.locator('.result-message')).toContainText('yards');

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
  await page.goto('/?debug=1&readback=1');
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
  await expect.poll(async () => (await getGameplaySnapshot(page)).playState, {
    timeout: 5000,
  }).toBe('dead');
  await page.keyboard.up('d');

  return getGameplaySnapshot(page);
}

async function waitForPreSnap(page: Page): Promise<GameplaySnapshot> {
  await expect.poll(async () => (await getGameplaySnapshot(page)).playState, {
    timeout: 3000,
  }).toBe('preSnap');

  return getGameplaySnapshot(page);
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

function vectorLength(vector: { x: number; z: number }): number {
  return Math.hypot(vector.x, vector.z);
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
