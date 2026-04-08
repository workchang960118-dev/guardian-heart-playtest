export type EventPoolProfile = {
  profileId: string;
  nameZh: string;
  cardIds: string[];
};

export const EVENT_POOL_PROFILE_MAP: Record<string, EventPoolProfile> = {
  first_round_full_8: {
    profileId: "first_round_full_8",
    nameZh: "首輪事件全 8 張",
    cardIds: [
      "event_1_rockfall",
      "event_2_lost_child",
      "event_3_food_anxiety",
      "event_4_rescue_fatigue",
      "event_5_isolation_night",
      "event_6_blame",
      "event_7_long_night",
      "event_8_chain_disaster",
    ],
  },
  core_mixed_4: {
    profileId: "core_mixed_4",
    nameZh: "混合核心事件 4 張",
    cardIds: [
      "event_1_rockfall",
      "event_3_food_anxiety",
      "event_5_isolation_night",
      "event_8_chain_disaster",
    ],
  },
};
