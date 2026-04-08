export type ReadinessStatus = "done" | "pending";

export type MvpReadinessEntry = {
  id: string;
  titleZh: string;
  status: ReadinessStatus;
  noteZh: string;
};

export const MVP_READINESS_MATRIX: MvpReadinessEntry[] = [
  {
    id: "actor-identity",
    titleZh: "actor identity / join / seat / reconnect 閉環",
    status: "done",
    noteZh: "已有 create / bootstrap / leave / resolve actor / observer block / forged seat block。",
  },
  {
    id: "snapshot-schema",
    titleZh: "snapshot schema / blocking windows / revision 基礎",
    status: "done",
    noteZh: "blockingWindow、pendingLossQueue、pendingCampfireResolution、roomRevision 等基礎已在。",
  },
  {
    id: "minimum-seeds",
    titleZh: "最小正式資料包（角色、地圖、事件、任務、行動卡）",
    status: "done",
    noteZh: "seed 與初始化基礎已進 repo，能支撐最小正式流程。",
  },
  {
    id: "core-actions",
    titleZh: "核心正式 action（move / invest / help / end_turn / discard / loss / campfire）",
    status: "done",
    noteZh: "主鏈 action 與 discard / loss / campfire 核心鏈已接。",
  },
  {
    id: "play-action-card",
    titleZh: "play_action_card 正式入口",
    status: "done",
    noteZh: "核心 6 張行動卡已有最小正式 effect resolution。",
  },
  {
    id: "task-review",
    titleZh: "任務 verifier + host review",
    status: "done",
    noteZh: "declare_task verifier 與 approve / reject 流程已接上。",
  },
  {
    id: "role-abilities",
    titleZh: "角色能力第一版已掛進正式節點",
    status: "done",
    noteZh: "6 名角色能力已接入 move / invest_event / adjacent_help / finalize_pending_loss / campfire 等主要節點。",
  },
  {
    id: "observer-guide-ui",
    titleZh: "observer / newcomer guide / 中文 UI 最低版",
    status: "done",
    noteZh: "最低版已可用，但仍可再補強。",
  },
  {
    id: "action-log-persist",
    titleZh: "action log 持久化第一版",
    status: "done",
    noteZh: "已有 room_action_logs repository、API、migration 與房間頁同步狀態。",
  },
  {
    id: "realtime-push",
    titleZh: "server push + version gating + fallback refresh",
    status: "done",
    noteZh: "已有 SSE push、state_updated payload、version gating 與 latest refresh。",
  },
  {
    id: "local-install-smoke",
    titleZh: "本機安裝、migration 與端到端 smoke test",
    status: "pending",
    noteZh: "這是目前唯一最核心的未完成項，需在真實環境驗證。",
  },
  {
    id: "smoke-runner",
    titleZh: "smoke test runner",
    status: "pending",
    noteZh: "目前仍是 checklist + typed cases，尚未有 runner。",
  },
];
