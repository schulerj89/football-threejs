import * as THREE from 'three';
import {
  attachHelmetToPlayerVisual,
  syncHelmetTeamMaterials,
} from '../../helmetVisual';
import { type FootballPosition as FormationFootballPosition } from '../../elevenOnElevenFormation';
import type { FootballSpot } from '../../fieldScale';
import type { FootballPosition as RosterFootballPosition } from '../../roster/RosterPlayer';
import {
  HELMET_ASSET_ID,
  findHelmetPartMeshes,
  getHelmetAssetLoadSnapshot,
  loadHelmetTemplate,
} from '../helmet/HelmetAssetLibrary';
import {
  getRiggedPlayerAssetSnapshot,
  loadRiggedPlayerTemplate,
} from './RiggedPlayerAssetLibrary';
import {
  createRiggedPlayerVisual,
  type RiggedPlayerVisualController,
} from './RiggedPlayerVisualFactory';
import {
  DEFAULT_PLAYER_VISUAL_MODE,
  type PlayerVisualMode,
} from './PlayerVisualMode';
import {
  createPlayerModel,
  type PlayerModel,
  type PlayerRole,
  type PlayerTeam,
} from '../../playerModel';
import {
  DEFAULT_PLAYER_TEAM_UNIFORMS,
  createPlaceholderPlayerVisual,
  getPlayerBodyVisualSnapshot,
  syncPlayerVisual,
  type PlayerBodyVisualSnapshot,
  type PlayerVisualBoundsSnapshot,
  type PlayerTeamUniforms,
  type PlayerVisualOptions,
} from '../../playerVisual';
import type { UniformPalette } from '../../teams/UniformPalette';
import type { PlayerPoseIntent } from '../PlayerPoseController';
import {
  attachJerseyNumberVisual,
  type JerseyNumberVisualSnapshot,
} from './JerseyNumberVisual';

export type FootballPlayerVisualTeamSide = 'opponent' | 'user';
export type FootballPlayerVisualPosition = FormationFootballPosition | RosterFootballPosition | 'UNKNOWN';
export type FootballPlayerHelmetRequirement = 'disabled' | 'required';
export const FOOTBALL_PLAYER_VISUAL_PROFILE_ID = 'football-player-v1';

export interface FootballPlayerVisualDescriptor {
  appearanceId: string;
  footballPosition: FootballPlayerVisualPosition;
  gameplayPlayerId?: string;
  gameplayTeam: PlayerTeam;
  presentationOnly: boolean;
  role: PlayerRole;
  jerseyNumber?: number | null;
  rosterPlayerId: string;
  teamSide: FootballPlayerVisualTeamSide;
  uniform: UniformPalette;
  visualId: string;
}

export interface FootballPlayerVisualFactoryOptions {
  attachHelmet?: typeof attachHelmetToPlayerVisual;
  helmet?: FootballPlayerHelmetRequirement;
  playerVisualOptions?: PlayerVisualOptions;
  teamUniforms?: PlayerTeamUniforms;
}

export interface FootballPlayerVisualSnapshot {
  appearanceId: string;
  body: PlayerBodyVisualSnapshot;
  facingRadians: number;
  footballPosition: FootballPlayerVisualPosition;
  gameplayPlayerId: string | null;
  gameplayTeam: PlayerTeam;
  helmetConfigured: FootballPlayerHelmetRequirement;
  helmetAttached: boolean;
  jerseyNumber: JerseyNumberVisualSnapshot;
  poseIntent: PlayerPoseIntent | null;
  presentationOnly: boolean;
  rosterPlayerId: string;
  rootPosition: { x: number; y: number; z: number };
  role: PlayerRole;
  teamSide: FootballPlayerVisualTeamSide;
  visible: boolean;
  visualProfileId: typeof FOOTBALL_PLAYER_VISUAL_PROFILE_ID;
  visualId: string;
  visualMode: PlayerVisualMode;
}

export interface FootballPlayerVisualReadiness {
  bodyReady: boolean;
  faceguardMaterialName: string | null;
  fallbackReason: 'bodyMissing' | 'helmetFailed' | 'helmetLoading' | null;
  headBounds: PlayerVisualBoundsSnapshot | null;
  helmetAssetId: string;
  helmetBounds: PlayerVisualBoundsSnapshot | null;
  helmetReady: boolean;
  playerAssetStatus: ReturnType<typeof getRiggedPlayerAssetSnapshot>['status'];
  shellMaterialName: string | null;
  subjectReady: boolean;
  subjectVisible: boolean;
}

export interface FootballPlayerVisualResources {
  dispose: () => void;
  getReadiness: () => FootballPlayerVisualReadiness;
  getSnapshot: () => FootballPlayerVisualSnapshot;
  ready: Promise<void>;
  root: THREE.Group;
  setPose: (intent: PlayerPoseIntent) => void;
  setVisible: (visible: boolean) => void;
  syncTransform: (position: FootballSpot, facingRadians: number) => void;
  syncUniform: (uniform: UniformPalette, teamUniforms?: PlayerTeamUniforms) => void;
  syncWithPlayerModel: (
    player: PlayerModel,
    teamUniforms?: PlayerTeamUniforms,
    jerseyNumber?: number | null,
    rosterPlayerId?: string | null,
    appearanceId?: string | null,
  ) => void;
}

export function preloadFootballPlayerVisualAssets(
  visualMode: PlayerVisualMode = DEFAULT_PLAYER_VISUAL_MODE,
): Promise<void> {
  const requests = [loadHelmetTemplate().then(() => undefined)];
  if (visualMode === 'meshyRigged') {
    requests.push(loadRiggedPlayerTemplate().then(() => undefined));
  }
  return Promise.all(requests).then(() => undefined);
}

export function createFootballPlayerVisual(
  descriptor: FootballPlayerVisualDescriptor,
  options: FootballPlayerVisualFactoryOptions = {},
): FootballPlayerVisualResources {
  const helmetRequirement = options.helmet ?? 'required';
  const requestedVisualMode =
    options.playerVisualOptions?.visualMode ?? DEFAULT_PLAYER_VISUAL_MODE;
  let activeDescriptor = { ...descriptor };
  let teamUniforms = createDescriptorTeamUniforms(
    activeDescriptor.gameplayTeam,
    activeDescriptor.uniform,
    options.teamUniforms ?? options.playerVisualOptions?.teamUniforms,
  );
  const model = createPlayerModel(undefined, {
    id: resolveVisualAppearanceIdentity(activeDescriptor),
    role: activeDescriptor.role,
    state: 'idle',
    team: activeDescriptor.gameplayTeam,
  });
  const visualOptions: PlayerVisualOptions = {
    ...options.playerVisualOptions,
    teamUniforms,
  };
  let activeVisualMode: PlayerVisualMode = 'procedural';
  let riggedVisual: RiggedPlayerVisualController | null = null;
  if (requestedVisualMode === 'meshyRigged') {
    riggedVisual = createRiggedPlayerVisual(model, activeDescriptor, teamUniforms);
    if (riggedVisual?.fallbackReason) {
      riggedVisual = null;
    }
  }
  const root = riggedVisual?.root ?? createPlaceholderPlayerVisual(model, visualOptions);
  if (riggedVisual) {
    activeVisualMode = 'meshyRigged';
  }
  root.name = `football-player-visual-${activeDescriptor.visualId}`;
  root.userData.visualId = activeDescriptor.visualId;
  root.userData.rosterPlayerId = activeDescriptor.rosterPlayerId;
  root.userData.jerseyNumber = activeDescriptor.jerseyNumber ?? null;
  root.userData.gameplayPlayerId = activeDescriptor.gameplayPlayerId ?? null;
  root.userData.teamSide = activeDescriptor.teamSide;
  root.userData.gameplayTeam = activeDescriptor.gameplayTeam;
  root.userData.footballPosition = activeDescriptor.footballPosition;
  root.userData.appearanceId = activeDescriptor.appearanceId;
  root.userData.presentationOnly = activeDescriptor.presentationOnly;
  root.userData.fullFootballPlayerVisual = true;
  root.userData.visualProfileId = FOOTBALL_PLAYER_VISUAL_PROFILE_ID;
  root.userData.playerVisualMode = activeVisualMode;
  root.userData.requestedPlayerVisualMode = requestedVisualMode;

  syncBodyVisual(root, model, visualOptions, activeDescriptor, riggedVisual, teamUniforms);
  const jerseyNumberVisual = attachJerseyNumberVisual(root, {
    jerseyNumber: activeDescriptor.jerseyNumber ?? null,
    rosterPlayerId: activeDescriptor.rosterPlayerId,
    uniform: activeDescriptor.uniform,
    visualId: activeDescriptor.visualId,
  });

  let helmetReady = helmetRequirement === 'disabled';
  let helmetErrorMessage: string | null = null;
  const ready = createReadyPromise(
    root,
    model,
    teamUniforms,
    helmetRequirement,
    options.attachHelmet ?? attachHelmetToPlayerVisual,
  );
  void ready
    .then(() => {
      helmetReady = true;
      helmetErrorMessage = null;
    })
    .catch((error: unknown) => {
      helmetReady = false;
      helmetErrorMessage = error instanceof Error ? error.message : String(error);
    });

  function syncTransform(position: FootballSpot, facingRadians: number): void {
    model.position.x = position.x;
    model.position.z = position.z;
    model.facingRadians = facingRadians;
    syncBodyVisual(
      root,
      model,
      { ...visualOptions, teamUniforms },
      activeDescriptor,
      riggedVisual,
      teamUniforms,
    );
    syncHelmetTeamMaterials(root, model, teamUniforms);
    jerseyNumberVisual.sync(
      activeDescriptor.jerseyNumber ?? null,
      activeDescriptor.uniform,
      activeDescriptor.rosterPlayerId,
    );
  }

  function syncUniform(uniform: UniformPalette, nextTeamUniforms?: PlayerTeamUniforms): void {
    activeDescriptor = { ...activeDescriptor, uniform };
    teamUniforms = createDescriptorTeamUniforms(
      activeDescriptor.gameplayTeam,
      uniform,
      nextTeamUniforms ?? teamUniforms,
    );
    visualOptions.teamUniforms = teamUniforms;
    syncBodyVisual(root, model, visualOptions, activeDescriptor, riggedVisual, teamUniforms);
    syncHelmetTeamMaterials(root, model, teamUniforms);
    jerseyNumberVisual.sync(
      activeDescriptor.jerseyNumber ?? null,
      uniform,
      activeDescriptor.rosterPlayerId,
    );
  }

  function syncWithPlayerModel(
    player: PlayerModel,
    nextTeamUniforms?: PlayerTeamUniforms,
    jerseyNumber?: number | null,
    rosterPlayerId?: string | null,
    appearanceId?: string | null,
  ): void {
    model.id = appearanceId ?? activeDescriptor.appearanceId;
    model.position.x = player.position.x;
    model.position.z = player.position.z;
    model.facingRadians = player.facingRadians;
    model.currentState = player.currentState;
    model.role = player.role;
    model.team = player.team;
    model.velocity.x = player.velocity.x;
    model.velocity.z = player.velocity.z;
    model.collisionRadius = player.collisionRadius;
    activeDescriptor = {
      ...activeDescriptor,
      gameplayPlayerId: player.id,
      gameplayTeam: player.team,
      appearanceId: appearanceId ?? activeDescriptor.appearanceId,
      jerseyNumber: jerseyNumber ?? activeDescriptor.jerseyNumber ?? null,
      rosterPlayerId: rosterPlayerId ?? activeDescriptor.rosterPlayerId,
      role: player.role,
      uniform: (nextTeamUniforms ?? teamUniforms)[player.team] ?? activeDescriptor.uniform,
    };
    root.userData.gameplayPlayerId = player.id;
    root.userData.gameplayTeam = player.team;
    root.userData.appearanceId = activeDescriptor.appearanceId;
    root.userData.jerseyNumber = activeDescriptor.jerseyNumber ?? null;
    root.userData.rosterPlayerId = activeDescriptor.rosterPlayerId;
    root.userData.role = player.role;
    if (nextTeamUniforms) {
      teamUniforms = nextTeamUniforms;
      visualOptions.teamUniforms = teamUniforms;
    }
    syncBodyVisual(root, model, visualOptions, activeDescriptor, riggedVisual, teamUniforms);
    syncHelmetTeamMaterials(root, model, teamUniforms);
    jerseyNumberVisual.sync(
      activeDescriptor.jerseyNumber ?? null,
      activeDescriptor.uniform,
      activeDescriptor.rosterPlayerId,
    );
  }

  return {
    dispose: () => {
      jerseyNumberVisual.dispose();
      root.removeFromParent();
    },
    getReadiness: () => createReadinessSnapshot(root, helmetRequirement, helmetReady, helmetErrorMessage),
    getSnapshot: () => ({
      appearanceId: activeDescriptor.appearanceId,
      body: getPlayerBodyVisualSnapshot(root),
      facingRadians: root.rotation.y,
      footballPosition: activeDescriptor.footballPosition,
      gameplayPlayerId: activeDescriptor.gameplayPlayerId ?? null,
      gameplayTeam: activeDescriptor.gameplayTeam,
      helmetAttached: Boolean(root.getObjectByName('low-poly-helmet')),
      helmetConfigured: helmetRequirement,
      jerseyNumber: jerseyNumberVisual.getSnapshot(),
      poseIntent: typeof root.userData.poseIntent === 'string'
        ? root.userData.poseIntent as PlayerPoseIntent
        : null,
      presentationOnly: activeDescriptor.presentationOnly,
      rosterPlayerId: activeDescriptor.rosterPlayerId,
      rootPosition: {
        x: root.position.x,
        y: root.position.y,
        z: root.position.z,
      },
      role: activeDescriptor.role,
      teamSide: activeDescriptor.teamSide,
      visible: root.visible,
      visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
      visualId: activeDescriptor.visualId,
      visualMode: activeVisualMode,
    }),
    ready,
    root,
    setPose: (intent: PlayerPoseIntent) => {
      root.userData.poseIntent = intent;
    },
    setVisible: (visible: boolean) => {
      root.visible = visible;
    },
    syncTransform,
    syncUniform,
    syncWithPlayerModel,
  };
}

function syncBodyVisual(
  root: THREE.Group,
  model: PlayerModel,
  visualOptions: PlayerVisualOptions,
  descriptor: FootballPlayerVisualDescriptor,
  riggedVisual: RiggedPlayerVisualController | null,
  teamUniforms: PlayerTeamUniforms,
): void {
  if (riggedVisual) {
    riggedVisual.sync(model, descriptor, teamUniforms);
    return;
  }

  syncPlayerVisual(root, model, visualOptions);
}

function createReadinessSnapshot(
  root: THREE.Group,
  helmetRequirement: FootballPlayerHelmetRequirement,
  helmetReady: boolean,
  helmetErrorMessage: string | null,
): FootballPlayerVisualReadiness {
  const bodySnapshot = getPlayerBodyVisualSnapshot(root);
  const bodyReady = Boolean(root.getObjectByName('bodyRoot'));
  const helmet = root.getObjectByName('low-poly-helmet');
  const actualHelmetReady = helmetRequirement === 'disabled' || (helmetReady && Boolean(helmet));
  const helmetMaterials = helmet ? resolveHelmetMaterialNames(helmet) : {
    faceguardMaterialName: null,
    shellMaterialName: null,
  };
  const loadSnapshot = getHelmetAssetLoadSnapshot();
  const fallbackReason = resolveReadinessFallbackReason(
    bodyReady,
    helmetRequirement,
    actualHelmetReady,
    helmetErrorMessage,
    loadSnapshot.status,
  );

  return {
    bodyReady,
    faceguardMaterialName: helmetMaterials.faceguardMaterialName,
    fallbackReason,
    headBounds: bodySnapshot.headBounds,
    helmetAssetId: HELMET_ASSET_ID,
    helmetBounds: bodySnapshot.helmetBounds,
    helmetReady: actualHelmetReady,
    playerAssetStatus: getRiggedPlayerAssetSnapshot().status,
    shellMaterialName: helmetMaterials.shellMaterialName,
    subjectReady: bodyReady && actualHelmetReady && !fallbackReason,
    subjectVisible: root.visible,
  };
}

function resolveReadinessFallbackReason(
  bodyReady: boolean,
  helmetRequirement: FootballPlayerHelmetRequirement,
  helmetReady: boolean,
  helmetErrorMessage: string | null,
  loadStatus: ReturnType<typeof getHelmetAssetLoadSnapshot>['status'],
): FootballPlayerVisualReadiness['fallbackReason'] {
  if (!bodyReady) {
    return 'bodyMissing';
  }

  if (helmetRequirement === 'disabled') {
    return null;
  }

  if (helmetReady) {
    return null;
  }

  if (helmetErrorMessage || loadStatus === 'error') {
    return 'helmetFailed';
  }

  return 'helmetLoading';
}

function resolveHelmetMaterialNames(helmet: THREE.Object3D): {
  faceguardMaterialName: string | null;
  shellMaterialName: string | null;
} {
  const parts = findHelmetPartMeshes(helmet);
  return {
    faceguardMaterialName: getFirstMaterialName(parts.faceguardMeshes),
    shellMaterialName: getFirstMaterialName(parts.shellMeshes),
  };
}

function getFirstMaterialName(meshes: readonly THREE.Mesh[]): string | null {
  for (const mesh of meshes) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const material = materials.find((candidate) => candidate.name.length > 0);
    if (material) {
      return material.name;
    }
  }
  return null;
}

function createReadyPromise(
  root: THREE.Group,
  model: PlayerModel,
  teamUniforms: PlayerTeamUniforms,
  helmetRequirement: FootballPlayerHelmetRequirement,
  attachHelmet: typeof attachHelmetToPlayerVisual,
): Promise<void> {
  if (helmetRequirement === 'disabled') {
    return Promise.resolve();
  }

  return attachHelmet(root, model, teamUniforms).then((attached) => {
    if (!attached) {
      throw new Error(`Helmet attachment failed for ${model.id}`);
    }
  });
}

function createDescriptorTeamUniforms(
  team: PlayerTeam,
  uniform: UniformPalette,
  baseUniforms: PlayerTeamUniforms = DEFAULT_PLAYER_TEAM_UNIFORMS,
): PlayerTeamUniforms {
  return {
    defense: team === 'defense' ? uniform : baseUniforms.defense,
    offense: team === 'offense' ? uniform : baseUniforms.offense,
  };
}

function resolveVisualAppearanceIdentity(descriptor: FootballPlayerVisualDescriptor): string {
  return descriptor.appearanceId ||
    descriptor.rosterPlayerId ||
    descriptor.gameplayPlayerId ||
    descriptor.visualId;
}
