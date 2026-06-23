export type PlayerVisualMode = 'meshyRigged' | 'procedural';

export const DEFAULT_PLAYER_VISUAL_MODE: PlayerVisualMode = 'procedural';

export function resolvePlayerVisualMode(value: string | null | undefined): PlayerVisualMode {
  return value === 'meshyRigged' ? 'meshyRigged' : DEFAULT_PLAYER_VISUAL_MODE;
}
