import type { ActionCardDefinition } from "@/domain/guardian-heart/types/game";

/**
 * 3A：先把規則母本中的 6 張核心 / 測試牌 formalize。
 * actionDeck 目前仍只吃 cardId 陣列；真正牌效在後續批次接 handler。
 */
export const ACTION_CARD_DEFINITIONS: ActionCardDefinition[] = [
  {
    cardId: "card_pull_you_a_bit",
    nameZh: "拉你一把",
    category: "mobility",
    apCost: 1,
    rulesTextZh: "指定 1 名相鄰或同格隊友，該隊友可選擇立即合法移動 1 格。",
    noteZh: "救援與補位。",
    enabledByDefault: true,
  },
  {
    cardId: "card_dash_to_goal",
    nameZh: "直奔目標",
    category: "mobility",
    apCost: 1,
    rulesTextZh: "若本次移動目的地是物資站、庇護所或中央大道，你可移動 2 格。",
    noteZh: "服務外圈站點與 regroup。",
    enabledByDefault: true,
  },
  {
    cardId: "card_same_tile_care",
    nameZh: "同格照應",
    category: "support",
    apCost: 1,
    rulesTextZh: "指定 1 名同格隊友，使其回復 1 SR 或 1 SP；你不需扣除自身資源。",
    noteZh: "快速同格支援。",
    enabledByDefault: true,
  },
  {
    cardId: "card_hold_together",
    nameZh: "一起穩住",
    category: "support",
    apCost: 1,
    rulesTextZh: "你與 1 名同格隊友各回復 1 SP。",
    noteZh: "同格共好型支援。",
    enabledByDefault: true,
  },
  {
    cardId: "card_focus_the_point",
    nameZh: "看準重點",
    category: "event_response",
    apCost: 1,
    rulesTextZh: "本輪事件的一項資源需求 -1，最低仍須至少 1 點資源。",
    noteZh: "減少事件壓力，但不直接取消事件。",
    enabledByDefault: true,
  },
  {
    cardId: "card_respond_together",
    nameZh: "攜手應對",
    category: "event_response",
    apCost: 1,
    rulesTextZh: "你先投入 1 點資源，再指定 1 名相鄰或同格且本輪尚未投入過的隊友，立即投入 1 點資源；此投入仍算來自該隊友本人。",
    noteZh: "測試牌／擴充牌；預設可由 experimental toggle 控制。",
    enabledByDefault: true,
  },
];

export const MINIMAL_ACTION_CARDS: string[] = ACTION_CARD_DEFINITIONS.map((card) => card.cardId);

export const ACTION_CARD_DEFINITION_MAP: Record<string, ActionCardDefinition> =
  Object.fromEntries(ACTION_CARD_DEFINITIONS.map((card) => [card.cardId, card]));
