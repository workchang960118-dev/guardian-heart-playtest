export type ActionDeckProfile = {
  profileId: string;
  nameZh: string;
  cardCounts: Record<string, number>;
};

export const ACTION_DECK_PROFILE_MAP: Record<string, ActionDeckProfile> = {
  core_baseline: {
    profileId: "core_baseline",
    nameZh: "核心基線牌池",
    cardCounts: {
      card_pull_you_a_bit: 3,
      card_dash_to_goal: 3,
      card_same_tile_care: 3,
      card_hold_together: 3,
      card_focus_the_point: 3,
      card_respond_together: 0,
    },
  },
  core_plus_response: {
    profileId: "core_plus_response",
    nameZh: "核心＋攜手應對測試牌池",
    cardCounts: {
      card_pull_you_a_bit: 3,
      card_dash_to_goal: 3,
      card_same_tile_care: 3,
      card_hold_together: 3,
      card_focus_the_point: 3,
      card_respond_together: 2,
    },
  },
  support_heavy: {
    profileId: "support_heavy",
    nameZh: "支援偏重牌池",
    cardCounts: {
      card_pull_you_a_bit: 2,
      card_dash_to_goal: 2,
      card_same_tile_care: 4,
      card_hold_together: 4,
      card_focus_the_point: 3,
      card_respond_together: 1,
    },
  },
};
