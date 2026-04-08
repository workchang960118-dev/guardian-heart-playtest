export type MvpGapPriority = "P0" | "P1" | "P2";
export type MvpGapArea =
  | "actions"
  | "tasks"
  | "realtime"
  | "log"
  | "testing"
  | "roles"
  | "observer"
  | "ui"
  | "toggle"
  | "release";

export type MvpGapStatus = "open" | "done";

export type MvpGapEntry = {
  id: string;
  priority: MvpGapPriority;
  area: MvpGapArea;
  status: MvpGapStatus;
  titleZh: string;
  summaryZh: string;
  blocksMvp: boolean;
  blocksAiSimulation: boolean;
  suggestedNextStepZh: string;
};

export const MVP_GAP_REGISTRY: MvpGapEntry[] = [
  {
    id: "DONE-P0-PLAY-ACTION-CARD",
    priority: "P0",
    area: "actions",
    status: "done",
    titleZh: "play_action_card 正式入口已接線",
    summaryZh:
      "核心 6 張行動卡已有最小 effect resolution，手牌、AP、棄牌堆與卡牌開關皆已接入正式流程。",
    blocksMvp: false,
    blocksAiSimulation: false,
    suggestedNextStepZh: "後續只需在總回歸時驗證各張卡的實際手感與邏輯一致性。",
  },
  {
    id: "DONE-P0-TASK-REVIEW",
    priority: "P0",
    area: "tasks",
    status: "done",
    titleZh: "任務 verifier 與 host review 最小正式流程已接線",
    summaryZh:
      "declare_task 已走 verifier，壓力 6 限制與 host approve / reject 流程都已進 snapshot 與 action log。",
    blocksMvp: false,
    blocksAiSimulation: false,
    suggestedNextStepZh: "後續在總回歸時驗證 6 張任務的條件與 review 流程是否都能正確跑通。",
  },
  {
    id: "DONE-P0-REALTIME-PUSH",
    priority: "P0",
    area: "realtime",
    status: "done",
    titleZh: "server push 型 realtime 最小正式接線已完成",
    summaryZh:
      "已有 state_updated payload、server broadcast、SSE 訂閱、client version gating 與 fallback refresh。",
    blocksMvp: false,
    blocksAiSimulation: false,
    suggestedNextStepZh: "後續在整體 smoke test 時驗證多視角同步、斷線恢復與舊 revision 丟棄是否穩定。",
  },
  {
    id: "DONE-P0-ACTION-LOG-PERSIST",
    priority: "P0",
    area: "log",
    status: "done",
    titleZh: "正式 action log 持久化第一版已完成",
    summaryZh:
      "snapshot.actionLog 之外，已有 room_action_logs repository、route、service 與 migration，可依 room / revision 拉出正式紀錄。",
    blocksMvp: false,
    blocksAiSimulation: false,
    suggestedNextStepZh: "後續可再補更細的 before/after diff 與 replay runner，但已不再阻斷 MVP。",
  },
  {
    id: "GAP-P0-FINAL-INSTALL-SMOKE",
    priority: "P0",
    area: "release",
    status: "open",
    titleZh: "尚未完成一次真正的本機安裝、migration 與端到端 smoke test",
    summaryZh:
      "目前 repo 與批次 zip 已補到接近 MVP，但還沒有在你實際環境完成『安裝 -> migration -> create room -> gameover/crisis』總驗證。",
    blocksMvp: true,
    blocksAiSimulation: true,
    suggestedNextStepZh: "先做 10B：本機安裝、執行 migration、跑 A–F 全鏈 smoke test，並記錄第一輪阻斷點。",
  },
  {
    id: "GAP-P0-SMOKE-RUNNER",
    priority: "P0",
    area: "testing",
    status: "open",
    titleZh: "smoke test 仍以 checklist 為主，尚未有 runner",
    summaryZh:
      "docs 與 typed smoke test case 已存在，但還沒有真正的半自動或自動執行器來收斂 pass / partial / fail。",
    blocksMvp: true,
    blocksAiSimulation: false,
    suggestedNextStepZh: "在 10B 跑完第一輪總回歸後，再決定是否補最小 smoke runner，或先用 checklist + gap register 收斂阻斷點。",
  },
  {
    id: "GAP-P1-ROLE-ABILITIES",
    priority: "P1",
    area: "roles",
    status: "done",
    titleZh: "角色能力第一版已正式掛進主要節點",
    summaryZh:
      "巡林探路者、白衣見習生、鐘樓觀測員、街巷信使、商會護衛、廣場說書人等能力，已正式接入 move / invest_event / adjacent_help / finalize_pending_loss / campfire status confirmation。",
    blocksMvp: false,
    blocksAiSimulation: false,
    suggestedNextStepZh: "在 10B 總回歸時逐一驗證 6 名角色能力是否與規則文字完全一致。",
  },
  {
    id: "GAP-P1-OBSERVER-GUIDE",
    priority: "P1",
    area: "observer",
    status: "open",
    titleZh: "observer / newcomer guide / 中文提示仍屬最低版",
    summaryZh:
      "主要流程已有顯示，但對桌測與督導觀看仍可補強摘要、等待原因與 room state 可讀性。",
    blocksMvp: false,
    blocksAiSimulation: false,
    suggestedNextStepZh: "在主鏈驗證通過後，再補 observer 摘要層與更穩定的 blocking window / campfire 提示。",
  },
  {
    id: "GAP-P1-TOGGLE-WIRING",
    priority: "P1",
    area: "toggle",
    status: "open",
    titleZh: "toggle config 尚未 fully 驅動全部功能",
    summaryZh:
      "roomConfig 已有基礎，但 card / role / AI simulation mode 還未完全進入所有正式流程控制。",
    blocksMvp: false,
    blocksAiSimulation: true,
    suggestedNextStepZh: "把 card / role / AI simulation toggle 接進正式 validator 與 handler。",
  },
  {
    id: "GAP-P2-UI-REFACTOR",
    priority: "P2",
    area: "ui",
    status: "open",
    titleZh: "room page 與摘要 helper 仍可再整理",
    summaryZh:
      "目前主畫面可用，但 component 與 selector 還有收斂空間。",
    blocksMvp: false,
    blocksAiSimulation: false,
    suggestedNextStepZh: "在主鏈穩定後再做 component / selector refactor。",
  },
];
