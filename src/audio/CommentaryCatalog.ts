export type CommentaryCategory =
  | 'bigGain'
  | 'challengeEnding'
  | 'firstDown'
  | 'gameOpening'
  | 'incomplete'
  | 'outOfBounds'
  | 'playReady'
  | 'sack'
  | 'tackleForLoss'
  | 'touchdown'
  | 'turnoverOnDowns';

export type CommentaryIntensity = 'high' | 'low' | 'medium' | 'peak';

export interface CommentaryClip {
  assetId: string;
  caption: string;
  category: CommentaryCategory;
  durationSeconds: number;
  intensity: CommentaryIntensity;
  priority: number;
  scriptId: string;
  variant: number;
}

export interface CommentaryCategoryRule {
  cooldownSeconds: number;
  priority: number;
}

export const COMMENTARY_CATEGORY_RULES: Readonly<Record<CommentaryCategory, CommentaryCategoryRule>> = {
  touchdown: { cooldownSeconds: 0, priority: 100 },
  challengeEnding: { cooldownSeconds: 12, priority: 96 },
  turnoverOnDowns: { cooldownSeconds: 5, priority: 90 },
  sack: { cooldownSeconds: 6, priority: 80 },
  firstDown: { cooldownSeconds: 7, priority: 70 },
  bigGain: { cooldownSeconds: 8, priority: 60 },
  tackleForLoss: { cooldownSeconds: 8, priority: 56 },
  incomplete: { cooldownSeconds: 5, priority: 50 },
  outOfBounds: { cooldownSeconds: 7, priority: 44 },
  gameOpening: { cooldownSeconds: 60, priority: 20 },
  playReady: { cooldownSeconds: 18, priority: 10 },
};

export const COMMENTARY_CATALOG: readonly CommentaryClip[] = [
  clip('ann_game_opening_01', 'gameOpening', 1, 'low', 'Settle in. The offense has a short field and a ticking clock.', 3.5),
  clip('ann_game_opening_02', 'gameOpening', 2, 'low', 'Here we go. Clean execution is the whole story on this drive.', 3.5),
  clip('ann_play_ready_01', 'playReady', 1, 'low', 'Fresh snap coming. The offense is set.', 2.4),
  clip('ann_play_ready_02', 'playReady', 2, 'low', 'Quiet at the line. The play call is in.', 2.5),
  clip('ann_first_down_01', 'firstDown', 1, 'medium', 'That keeps the drive moving. The offense earns a fresh set.', 3.4),
  clip('ann_first_down_02', 'firstDown', 2, 'medium', 'They needed the marker, and they got there.', 2.8),
  clip('ann_first_down_03', 'firstDown', 3, 'medium', 'Good push after the snap. The chains move again.', 3),
  clip('ann_touchdown_01', 'touchdown', 1, 'peak', 'He breaks through and finishes it. Touchdown.', 2.9),
  clip('ann_touchdown_02', 'touchdown', 2, 'peak', 'Into the paint. The offense cashes in.', 2.7),
  clip('ann_touchdown_03', 'touchdown', 3, 'peak', 'That run finds daylight all the way home.', 2.7),
  clip('ann_sack_01', 'sack', 1, 'high', 'Pressure gets there. The quarterback is wrapped up behind the line.', 3.7),
  clip('ann_sack_02', 'sack', 2, 'high', 'The pocket closes fast, and the defense wins the down.', 3.3),
  clip('ann_sack_03', 'sack', 3, 'high', 'Nowhere to go. The rush drops him before the throw.', 3.2),
  clip('ann_tackle_for_loss_01', 'tackleForLoss', 1, 'high', 'Hit in the backfield. That one moves the wrong way.', 3),
  clip('ann_tackle_for_loss_02', 'tackleForLoss', 2, 'high', 'The defense knifes through and shuts it down early.', 3),
  clip('ann_big_gain_01', 'bigGain', 1, 'high', 'Big lane, big burst. The offense flips the field.', 3),
  clip('ann_big_gain_02', 'bigGain', 2, 'high', 'He found space and turned it into a chunk.', 2.7),
  clip('ann_big_gain_03', 'bigGain', 3, 'high', 'That is the kind of gain that changes the drive.', 3),
  clip('ann_incomplete_01', 'incomplete', 1, 'medium', 'The throw is there late, and it falls away.', 2.6),
  clip('ann_incomplete_02', 'incomplete', 2, 'medium', 'Close window, no connection.', 1.8),
  clip('ann_incomplete_03', 'incomplete', 3, 'medium', 'The pass misses the mark. The drive moves to the next down.', 3.4),
  clip('ann_out_of_bounds_01', 'outOfBounds', 1, 'medium', 'Forced to the sideline, and the spot comes back in.', 3),
  clip('ann_out_of_bounds_02', 'outOfBounds', 2, 'medium', 'He steps out before the defense can finish the hit.', 3),
  clip('ann_turnover_on_downs_01', 'turnoverOnDowns', 1, 'high', 'The stop holds. The drive ends on downs.', 2.6),
  clip('ann_turnover_on_downs_02', 'turnoverOnDowns', 2, 'high', 'Fourth down comes up short, and the drill resets.', 3),
  clip('ann_challenge_ending_01', 'challengeEnding', 1, 'medium', 'That is the horn. Final score is on the board.', 3),
  clip('ann_challenge_ending_02', 'challengeEnding', 2, 'medium', 'Time runs out, and the offense has its number.', 3),
] as const;

export function getCommentaryClipsForCategory(
  category: CommentaryCategory,
  catalog: readonly CommentaryClip[] = COMMENTARY_CATALOG,
): readonly CommentaryClip[] {
  return catalog.filter((clip) => clip.category === category);
}

function clip(
  scriptId: string,
  category: CommentaryCategory,
  variant: number,
  intensity: CommentaryIntensity,
  caption: string,
  durationSeconds: number,
): CommentaryClip {
  return {
    assetId: scriptId,
    caption,
    category,
    durationSeconds,
    intensity,
    priority: COMMENTARY_CATEGORY_RULES[category].priority,
    scriptId,
    variant,
  };
}
