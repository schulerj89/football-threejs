import * as THREE from 'three';
import {
  attachHelmetsToPlayerVisuals,
  syncHelmetTeamMaterials,
} from '../helmetVisual';
import type { PlayerModel } from '../playerModel';
import {
  createPlaceholderPlayerVisual,
  getPlayerBodyVisualSnapshot,
  syncPlayerVisual,
  type PlayerBodyVisualSnapshot,
  type PlayerTeamUniforms,
  type PlayerVisualOptions,
} from '../playerVisual';

export class PlayerVisualRegistry {
  readonly visuals = new Map<string, THREE.Group>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly options: PlayerVisualOptions,
  ) {}

  get size(): number {
    return this.visuals.size;
  }

  get(playerId: string): THREE.Group | undefined {
    return this.visuals.get(playerId);
  }

  has(playerId: string): boolean {
    return this.visuals.has(playerId);
  }

  values(): IterableIterator<THREE.Group> {
    return this.visuals.values();
  }

  setTeamUniforms(teamUniforms: PlayerTeamUniforms): void {
    this.options.teamUniforms = teamUniforms;
  }

  reconcile(players: readonly PlayerModel[]): void {
    const activeIds = new Set(players.map((player) => player.id));

    for (const [playerId, playerVisual] of [...this.visuals.entries()]) {
      if (activeIds.has(playerId)) {
        continue;
      }

      this.scene.remove(playerVisual);
      this.visuals.delete(playerId);
    }

    for (const player of players) {
      let playerVisual = this.visuals.get(player.id);
      if (!playerVisual) {
        playerVisual = createPlaceholderPlayerVisual(player, this.options);
        this.visuals.set(player.id, playerVisual);
        this.scene.add(playerVisual);
      }

      syncPlayerVisual(playerVisual, player, this.options);
      syncHelmetTeamMaterials(playerVisual, player, this.options.teamUniforms);
    }

    attachHelmetsToPlayerVisuals(this.visuals, [...players], this.options.teamUniforms);
  }

  sync(players: readonly PlayerModel[]): void {
    for (const player of players) {
      const playerVisual = this.visuals.get(player.id);
      if (playerVisual) {
        syncPlayerVisual(playerVisual, player, this.options);
        syncHelmetTeamMaterials(playerVisual, player, this.options.teamUniforms);
      }
    }
  }

  getBodySnapshots(): PlayerBodyVisualSnapshot[] {
    return [...this.visuals.values()].map((playerVisual) =>
      getPlayerBodyVisualSnapshot(playerVisual),
    );
  }

  dispose(): void {
    for (const playerVisual of this.visuals.values()) {
      this.scene.remove(playerVisual);
    }
    this.visuals.clear();
  }
}
