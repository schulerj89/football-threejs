export type PlayerVisualMode = 'meshyRigged' | 'procedural';

export const DEFAULT_PLAYER_VISUAL_MODE: PlayerVisualMode = 'meshyRigged';

export function resolvePlayerVisualMode(value: string | null | undefined): PlayerVisualMode {
  if (value === 'procedural' || value === 'meshyRigged') {
    return value;
  }
  return DEFAULT_PLAYER_VISUAL_MODE;
}
