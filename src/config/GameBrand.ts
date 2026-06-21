export interface GameBrand {
  readonly announcerName: string;
  readonly emblemImageUrl: string;
  readonly heroImageUrl: string;
  readonly shortTitle: string;
  readonly tagline: string;
  readonly title: string;
  readonly titleMusicId: string;
}

export const GAME_BRAND: GameBrand = {
  announcerName: 'Gridiron Local Prototype Announcer',
  emblemImageUrl: '/branding/football-js-emblem.webp',
  heroImageUrl: '/branding/football-js-title.webp',
  shortTitle: 'Football JS',
  tagline: '',
  title: 'Football JS',
  titleMusicId: 'football-js-title',
} as const;
