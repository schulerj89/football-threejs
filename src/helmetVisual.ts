import * as THREE from 'three';
import type { PlayerModel, PlayerTeam } from './playerModel';
import {
  HELMET_ASSET_CONFIG,
  HELMET_ASSET_ID,
  applyHelmetOffset,
  applyHelmetTeamMaterialsForUniforms,
  cloneHelmetAsset,
  createHelmetMaterialScope,
  ensureHelmetFaceguard,
  findHelmetPartMeshes,
  getHelmetAssetLoadSnapshot,
  type HelmetAssetStatus,
  type HelmetPartMeshes,
} from './presentation/helmet/HelmetAssetLibrary';
import {
  DEFAULT_PLAYER_TEAM_UNIFORMS,
  PLAYER_BODY_DIMENSIONS,
  getPlayerVisualHeadAnchor,
  type PlayerTeamUniforms,
} from './playerVisual';

type AttachedHelmetReferences = {
  helmet: THREE.Object3D;
  materialKey: string;
  parts: HelmetPartMeshes;
  team: PlayerTeam | null;
};

export interface HelmetAssetSnapshot {
  assetId: string;
  attachedPlayerIds: string[];
  errorMessage: string | null;
  faceguardMeshNames: string[];
  shellMeshNames: string[];
  status: HelmetAssetStatus;
}

export { HELMET_ASSET_ID, findHelmetPartMeshes, type HelmetPartMeshes };

export const HELMET_VISUAL_CONFIG = {
  assetUrl: HELMET_ASSET_CONFIG.assetUrl,
  faceguardMeshNames: HELMET_ASSET_CONFIG.faceguardMeshNames,
  faceguardOffset: HELMET_ASSET_CONFIG.faceguardOffset,
  helmetOffset: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: {
      x: PLAYER_BODY_DIMENSIONS.helmetScale,
      y: PLAYER_BODY_DIMENSIONS.helmetScale,
      z: PLAYER_BODY_DIMENSIONS.helmetScale,
    },
  },
  shellMeshNames: HELMET_ASSET_CONFIG.shellMeshNames,
  teamColors: HELMET_ASSET_CONFIG.teamColors,
} as const;

const helmetAssetState: HelmetAssetSnapshot = {
  assetId: HELMET_ASSET_ID,
  attachedPlayerIds: [],
  errorMessage: null,
  faceguardMeshNames: [],
  shellMeshNames: [],
  status: 'idle',
};

const attachedHelmetReferences = new WeakMap<THREE.Object3D, AttachedHelmetReferences>();

export async function attachHelmetToPlayerVisual(
  playerVisual: THREE.Object3D,
  player: PlayerModel,
  teamUniforms: PlayerTeamUniforms = DEFAULT_PLAYER_TEAM_UNIFORMS,
): Promise<boolean> {
  const headAnchor = getPlayerVisualHeadAnchor(playerVisual);

  if (!headAnchor) {
    return false;
  }

  const existingReferences = getAttachedHelmetReferences(playerVisual);
  if (existingReferences ?? headAnchor.getObjectByName('low-poly-helmet')) {
    syncHelmetTeamMaterials(playerVisual, player, teamUniforms);
    return true;
  }

  const helmet = await cloneHelmetAsset();
  helmet.name = 'low-poly-helmet';
  helmet.userData.assetId = HELMET_ASSET_ID;
  applyHelmetOffset(helmet, HELMET_VISUAL_CONFIG.helmetOffset);

  const helmetParts = ensureHelmetFaceguard(helmet);

  applyHelmetTeamMaterials(helmetParts, player.team, teamUniforms);
  cacheAttachedHelmetReferences(
    playerVisual,
    helmet,
    helmetParts,
    player.team,
    createHelmetMaterialKey(player.team, teamUniforms),
  );
  headAnchor.add(helmet);
  recordAttachedPlayer(player.id);
  return true;
}

export function attachHelmetsToPlayerVisuals(
  playerVisuals: Map<string, THREE.Group>,
  players: PlayerModel[],
  teamUniforms: PlayerTeamUniforms = DEFAULT_PLAYER_TEAM_UNIFORMS,
): void {
  for (const player of players) {
    const playerVisual = playerVisuals.get(player.id);

    if (!playerVisual) {
      continue;
    }

    void attachHelmetToPlayerVisual(playerVisual, player, teamUniforms).catch((error: unknown) => {
      helmetAssetState.status = 'error';
      helmetAssetState.errorMessage = error instanceof Error ? error.message : String(error);
    });
  }
}

export function syncHelmetTeamMaterials(
  playerVisual: THREE.Object3D,
  player: PlayerModel,
  teamUniforms: PlayerTeamUniforms = DEFAULT_PLAYER_TEAM_UNIFORMS,
): void {
  const references = getOrCreateAttachedHelmetReferences(playerVisual);
  if (!references) {
    return;
  }

  const materialKey = createHelmetMaterialKey(player.team, teamUniforms);
  if (references.team === player.team && references.materialKey === materialKey) {
    return;
  }

  applyHelmetTeamMaterials(references.parts, player.team, teamUniforms);
  references.team = player.team;
  references.materialKey = materialKey;
}

export function getHelmetAssetSnapshot(): HelmetAssetSnapshot {
  const loadSnapshot = getHelmetAssetLoadSnapshot();
  return {
    assetId: loadSnapshot.assetId,
    attachedPlayerIds: [...helmetAssetState.attachedPlayerIds],
    errorMessage: helmetAssetState.errorMessage ?? loadSnapshot.errorMessage,
    faceguardMeshNames: [...loadSnapshot.faceguardMeshNames],
    shellMeshNames: [...loadSnapshot.shellMeshNames],
    status: helmetAssetState.status === 'error' ? helmetAssetState.status : loadSnapshot.status,
  };
}

export function applyHelmetTeamMaterials(
  parts: HelmetPartMeshes,
  team: PlayerTeam,
  teamUniforms: PlayerTeamUniforms = DEFAULT_PLAYER_TEAM_UNIFORMS,
): void {
  applyHelmetTeamMaterialsForUniforms(parts, team, teamUniforms);
}

function getOrCreateAttachedHelmetReferences(
  playerVisual: THREE.Object3D,
): AttachedHelmetReferences | null {
  const cachedReferences = getAttachedHelmetReferences(playerVisual);

  if (cachedReferences) {
    return cachedReferences;
  }

  const helmet = playerVisual.getObjectByName('low-poly-helmet');

  if (!helmet) {
    return null;
  }

  return cacheAttachedHelmetReferences(
    playerVisual,
    helmet,
    findHelmetPartMeshes(helmet),
    null,
    '',
  );
}

function getAttachedHelmetReferences(playerVisual: THREE.Object3D): AttachedHelmetReferences | null {
  const references = attachedHelmetReferences.get(playerVisual);

  if (!references || references.helmet.parent === null) {
    return null;
  }

  return references;
}

function cacheAttachedHelmetReferences(
  playerVisual: THREE.Object3D,
  helmet: THREE.Object3D,
  parts: HelmetPartMeshes,
  team: PlayerTeam | null,
  materialKey: string,
): AttachedHelmetReferences {
  const references = { helmet, materialKey, parts, team };
  attachedHelmetReferences.set(playerVisual, references);
  return references;
}

function createHelmetMaterialKey(
  team: PlayerTeam,
  teamUniforms: PlayerTeamUniforms,
): string {
  return createHelmetMaterialScope(team, teamUniforms);
}

function recordAttachedPlayer(playerId: string): void {
  if (helmetAssetState.attachedPlayerIds.includes(playerId)) {
    return;
  }

  helmetAssetState.attachedPlayerIds.push(playerId);
  helmetAssetState.attachedPlayerIds.sort();
}
