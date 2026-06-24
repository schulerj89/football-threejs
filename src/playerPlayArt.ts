import type { SnapPlacement } from './ballSpotting';
import {
  resolveCoverageZones,
  type CoverageZone,
} from './coverageShell';
import type { FootballSpot } from './fieldScale';
import {
  resolveFormation,
  type ResolvedFormation,
} from './formationLayout';
import type { PlayDefinition } from './playbook';
import {
  resolveEligibleReceiverRoutes,
  type ResolvedReceiverRoute,
} from './receiverRoutes';

export interface PlayerPlayArtInput {
  playerPositions?: ReadonlyArray<{
    id: string;
    position: FootballSpot;
  }>;
}

export interface PlayerPlayArtModel {
  coverageZones: CoverageZone[];
  formation: ResolvedFormation;
  playerPositions: ReadonlyMap<string, FootballSpot>;
  receiverRoutes: ResolvedReceiverRoute[];
}

export function createPlayerPlayArtModel(
  play: PlayDefinition,
  snapPlacement: SnapPlacement,
  input: PlayerPlayArtInput = {},
): PlayerPlayArtModel {
  const formation = resolveFormation(play, snapPlacement);
  const playerPositions = new Map(
    (input.playerPositions ?? []).map((player) => [
      player.id,
      { ...player.position },
    ]),
  );
  const receiverRoutes = resolveEligibleReceiverRoutes(play, snapPlacement, {
    formation,
    playerPositions,
  });
  const coverageZones = resolveCoverageZones(play, snapPlacement, {
    formation,
    playerPositions,
  });

  return {
    coverageZones,
    formation,
    playerPositions,
    receiverRoutes,
  };
}
