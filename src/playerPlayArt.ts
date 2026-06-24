import type { SnapPlacement } from './ballSpotting';
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

  return {
    formation,
    playerPositions,
    receiverRoutes,
  };
}
