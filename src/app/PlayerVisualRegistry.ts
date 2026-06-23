import * as THREE from 'three';
import type { PlayerModel } from '../playerModel';
import {
  getRosterPlayerForGameplayId,
  type GameplayRosterBinding,
} from '../roster/GameplayRosterBinding';
import type { RosterPlayer } from '../roster/RosterPlayer';
import {
  DEFAULT_PLAYER_TEAM_UNIFORMS,
  getPlayerBodyVisualSnapshot,
  type PlayerBodyVisualSnapshot,
  type PlayerTeamUniforms,
  type PlayerVisualOptions,
} from '../playerVisual';
import {
  createFootballPlayerVisual,
  type FootballPlayerVisualResources,
} from '../presentation/players/FootballPlayerVisualFactory';

export class PlayerVisualRegistry {
  readonly visuals = new Map<string, THREE.Group>();
  private readonly resources = new Map<string, FootballPlayerVisualResources>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly options: PlayerVisualOptions,
    private rosterBinding: GameplayRosterBinding | null = null,
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

  setVisualMode(visualMode: NonNullable<PlayerVisualOptions['visualMode']>): void {
    if (this.options.visualMode === visualMode) {
      return;
    }

    this.options.visualMode = visualMode;
    this.clear();
  }

  setRosterBinding(rosterBinding: GameplayRosterBinding): void {
    this.rosterBinding = rosterBinding;
  }

  setVisible(visible: boolean): void {
    for (const resource of this.resources.values()) {
      resource.setVisible(visible);
    }
  }

  reconcile(players: readonly PlayerModel[]): void {
    const activeIds = new Set(players.map((player) => player.id));

    for (const [playerId, playerVisual] of [...this.visuals.entries()]) {
      if (activeIds.has(playerId)) {
        continue;
      }

      this.resources.get(playerId)?.dispose();
      this.scene.remove(playerVisual);
      this.resources.delete(playerId);
      this.visuals.delete(playerId);
    }

    for (const player of players) {
      let resource = this.resources.get(player.id);
      const rosterPlayer = this.resolveRosterPlayer(player);
      if (!resource) {
        resource = createFootballPlayerVisual(
          {
            appearanceId: rosterPlayer?.appearanceId ?? player.id,
            footballPosition: 'UNKNOWN',
            gameplayPlayerId: player.id,
            gameplayTeam: player.team,
            presentationOnly: false,
            role: player.role,
            jerseyNumber: rosterPlayer?.jerseyNumber ?? null,
            rosterPlayerId: rosterPlayer?.id ?? player.id,
            teamSide: player.team === 'offense' ? 'user' : 'opponent',
            uniform: this.options.teamUniforms?.[player.team] ?? DEFAULT_PLAYER_TEAM_UNIFORMS[player.team],
            visualId: player.id,
          },
          {
            playerVisualOptions: this.options,
            teamUniforms: this.options.teamUniforms,
          },
        );
        this.resources.set(player.id, resource);
        this.visuals.set(player.id, resource.root);
        this.scene.add(resource.root);
      }

      resource.syncWithPlayerModel(
        player,
        this.options.teamUniforms,
        rosterPlayer?.jerseyNumber ?? null,
        rosterPlayer?.id ?? player.id,
        rosterPlayer?.appearanceId ?? player.id,
      );
    }
  }

  sync(players: readonly PlayerModel[]): void {
    for (const player of players) {
      const rosterPlayer = this.resolveRosterPlayer(player);
      this.resources.get(player.id)?.syncWithPlayerModel(
        player,
        this.options.teamUniforms,
        rosterPlayer?.jerseyNumber ?? null,
        rosterPlayer?.id ?? player.id,
        rosterPlayer?.appearanceId ?? player.id,
      );
    }
  }

  getBodySnapshots(): PlayerBodyVisualSnapshot[] {
    return [...this.visuals.values()].map((playerVisual) =>
      getPlayerBodyVisualSnapshot(playerVisual),
    );
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    for (const [playerId, playerVisual] of this.visuals.entries()) {
      this.resources.get(playerId)?.dispose();
      this.scene.remove(playerVisual);
    }
    this.resources.clear();
    this.visuals.clear();
  }

  private resolveRosterPlayer(player: PlayerModel): RosterPlayer | null {
    return this.rosterBinding
      ? getRosterPlayerForGameplayId(this.rosterBinding, player.id)
      : null;
  }
}
