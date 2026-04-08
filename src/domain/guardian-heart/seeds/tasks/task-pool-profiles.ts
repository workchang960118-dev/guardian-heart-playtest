export type TaskPoolProfile = {
  profileId: string;
  nameZh: string;
  taskIds: string[];
};

export const TASK_POOL_PROFILE_MAP: Record<string, TaskPoolProfile> = {
  first_round_full_6: {
    profileId: "first_round_full_6",
    nameZh: "首輪任務全 6 張",
    taskIds: [
      "task_temporary_supply_line",
      "task_comfort_circle",
      "task_neighborhood_relay",
      "task_crisis_control",
      "task_small_gathering_point",
      "task_support_network_formed",
    ],
  },
  core_mixed_4: {
    profileId: "core_mixed_4",
    nameZh: "混合核心任務 4 張",
    taskIds: [
      "task_temporary_supply_line",
      "task_neighborhood_relay",
      "task_crisis_control",
      "task_support_network_formed",
    ],
  },
};
