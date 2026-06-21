export type SkinToneId =
  | 'skin-tone-1'
  | 'skin-tone-2'
  | 'skin-tone-3'
  | 'skin-tone-4'
  | 'skin-tone-5'
  | 'skin-tone-6';

export interface PlayerAppearance {
  skinColor: number;
  skinToneId: SkinToneId;
}

export const SKIN_TONE_PALETTE: readonly PlayerAppearance[] = [
  { skinColor: 0xf1c7a0, skinToneId: 'skin-tone-1' },
  { skinColor: 0xd9a47c, skinToneId: 'skin-tone-2' },
  { skinColor: 0xbd7d55, skinToneId: 'skin-tone-3' },
  { skinColor: 0x98613f, skinToneId: 'skin-tone-4' },
  { skinColor: 0x70412c, skinToneId: 'skin-tone-5' },
  { skinColor: 0x4b2a1d, skinToneId: 'skin-tone-6' },
];

export function resolvePlayerAppearance(playerId: string): PlayerAppearance {
  const index = calculateStableIndex(playerId, SKIN_TONE_PALETTE.length);
  return SKIN_TONE_PALETTE[index];
}

function calculateStableIndex(value: string, bucketCount: number): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % bucketCount;
}
