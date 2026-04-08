import { createInitialGameSnapshot } from "@/domain/guardian-heart/helpers/setup/create-initial-game-snapshot";
import { getTileById } from "@/domain/guardian-heart/helpers/map/tile-lookup";
import { MINIMAL_EVENTS } from "@/domain/guardian-heart/seeds/events/minimal-events";
import { MINIMAL_TASKS } from "@/domain/guardian-heart/seeds/tasks/minimal-tasks";
import { AI_ROLE_ASSIGNMENT_ORDER } from "@/domain/guardian-heart/helpers/roles/role-loadout";
import { buildCustomAiPolicy, chooseAiStep, type CustomAiPolicyInput } from "@/domain/guardian-heart/helpers/ai/ai-turn-driver";
import { verifyTaskDeclaration } from "@/domain/guardian-heart/helpers/tasks/task-verifier";
import { DEFAULT_ROOM_CONFIG } from "@/domain/guardian-heart/seeds/config/default-room-config";
import { PYTHON_MAINLINE_BENCHMARK } from "@/domain/guardian-heart/seeds/simulation/python-mainline-benchmark";
import { recoverResource } from "@/domain/guardian-heart/helpers/resources/resource-policy";
import type { GameSnapshot, RoomConfig, SeatId, TaskState } from "@/domain/guardian-heart/types/game";
import { applyRoomActionReducer } from "@/server/rooms/services/apply-room-action-service";

export type SimulationFailureReason = "pressure_overflow" | "sr_zero" | "sp_zero" | "task_shortfall" | "unknown";

export type SimulationTuningAxes = {
  eventImmediateSrDelta: number;
  eventImmediateSpDelta: number;
  eventUnresolvedSrDelta: number;
  eventUnresolvedSpDelta: number;
  eventDemandSrDelta: number;
  eventDemandSpDelta: number;
  stationRecoveryDelta: number;
  shelterRecoveryDelta: number;
  supportCardRecoveryDelta: number;
  focusDemandReductionDelta: number;
  riskStaySrPenaltyDelta: number;
  riskStaySpPenaltyDelta: number;
  companionPreventDelta: number;
  companionComfortSpDelta: number;
};

export type SimulationVariantInput = {
  variantId: string;
  labelZh: string;
  runCount: number;
  seed?: number;
  tuningAxes?: Partial<SimulationTuningAxes>;
  customAiPolicy?: CustomAiPolicyInput;
  roomConfigPatch?: Partial<RoomConfig> & {
    cardToggles?: Record<string, boolean>;
    roleAbilityToggles?: Record<string, boolean>;
    experimentalRuleToggles?: Partial<RoomConfig["experimentalRuleToggles"]>;
  };
};

export type SimulationEventDebugAggregate = {
  cardId: string;
  nameZh: string;
  seenCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  resolvedRate: number;
};

export type SimulationHistogramRow = {
  round: number;
  count: number;
};

export type SimulationAxisBrinkRow = {
  axis: "SR" | "SP" | "both";
  count: number;
};

export type SimulationActionFrequencyRow = {
  key: string;
  count: number;
  rate: number;
};

export type SimulationTaskDeclarationRow = {
  taskId: string;
  nameZh: string;
  count: number;
  ratePerGame: number;
};

export type SimulationRoundCadenceRow = {
  round: number;
  survivalRate: number;
  avgResolvedEventsByEnd: number;
  avgEventCountByEnd: number;
  avgResolvedRateByEnd: number;
  avgResolvedThisRound: number;
  avgEventResolvedRateThisRound: number;
  avgSrTotalAtEnd: number;
  avgSpTotalAtEnd: number;
};

export type SimulationBenchmarkGapRow = {
  metricId: string;
  labelZh: string;
  pythonValue: number;
  webValue: number;
  delta: number;
  deltaZh: string;
};

export type SimulationBenchmarkAlignment = {
  baselineVariantId: string;
  baselineLabelZh: string;
  pythonVariantId: string;
  pythonLabelZh: string;
  closestPythonVariantId: string;
  closestPythonLabelZh: string;
  gapScore: number;
  rows: SimulationBenchmarkGapRow[];
  summaryZh: string[];
};

export type SimulationPlaytestFitStatus = "pass" | "near" | "miss";

export type SimulationPlaytestFitRow = {
  metricId: string;
  labelZh: string;
  targetZh: string;
  value: number | null;
  valueZh: string;
  status: SimulationPlaytestFitStatus;
  noteZh: string;
};

export type SimulationPlaytestAlignment = {
  baselineVariantId: string;
  baselineLabelZh: string;
  fitScore: number;
  rows: SimulationPlaytestFitRow[];
  summaryZh: string[];
};

export type SimulationGapDiagnosisVariantImpact = {
  variantId: string;
  labelZh: string;
  winRateDelta: number;
  totalResolvedDelta: number;
  survivalRoundsDelta: number;
  throughputDelta: number;
  r5ResolvedByEndDelta: number | null;
  primaryAxis: "survival_cadence" | "per_round_resolution" | "mixed";
};

export type SimulationGapDiagnosis = {
  baselineVariantId: string;
  baselineLabelZh: string;
  dominantAxis: "survival_cadence" | "per_round_resolution" | "mixed" | "insufficient_signal";
  dominantAxisLabelZh: string;
  confidence: number;
  evidenceZh: string[];
  nextStepsZh: string[];
  variantImpacts: SimulationGapDiagnosisVariantImpact[];
};

export type SimulationVariantAggregate = {
  variantId: string;
  labelZh: string;
  runCount: number;
  seed: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgCompletedTasks: number;
  avgDeclaredTasks: number;
  avgFinalPressure: number;
  avgResolvedEventRate: number;
  avgResolvedEventCount: number;
  avgEventCount: number;
  avgSurvivalRounds: number;
  avgResolvedEventsPerSurvivalRound: number;
  avgAdjacentHelpCount: number;
  avgCompanionUseCount: number;
  avgMultiContributorEvents: number;
  avgPressure3MultiContributorRate: number;
  avgPressure6DeclareRate: number;
  avgFinalSrTotal: number;
  avgFinalSpTotal: number;
  avgPeakSrTotal: number;
  avgPeakSpTotal: number;
  avgFailureRound: number | null;
  avgFirstDangerRound: number | null;
  avgFirstPressure6Round: number | null;
  earlyLossRate: number | null;
  lateLossR57Rate: number | null;
  lateLossR67Rate: number | null;
  winResourceTensionRate: number | null;
  playtestFitScore: number;
  avgMovedIntoRiskPerRound: number;
  avgRiskCampersPerRound: number;
  failureReasons: Record<SimulationFailureReason, number>;
  failureRoundHistogram: SimulationHistogramRow[];
  firstDangerRoundHistogram: SimulationHistogramRow[];
  firstPressure6RoundHistogram: SimulationHistogramRow[];
  firstAxisBrinkCounts: SimulationAxisBrinkRow[];
  taskDeclarationCounts: SimulationTaskDeclarationRow[];
  preLossActionPresenceTop: SimulationActionFrequencyRow[];
  preLossStrategicTop: SimulationActionFrequencyRow[];
  topLikelyOverstableCausesZh: string[];
  eventDebug: SimulationEventDebugAggregate[];
  avgRoundResourceTotals: Array<{ round: number; avgSrTotal: number; avgSpTotal: number }>;
  roundCadenceRows: SimulationRoundCadenceRow[];
};

export type SimulationComparePresetDefinition = {
  presetId: string;
  labelZh: string;
  descriptionZh: string;
  variantLabelsZh: string[];
};

export type SimulationCompareReport = {
  generatedAt: string;
  seed: number;
  presetId: string;
  presetLabelZh: string;
  presetDescriptionZh: string;
  availablePresets: SimulationComparePresetDefinition[];
  baselineVariantId: string;
  reportFormatZh: string[];
  summaryZh: string[];
  variants: SimulationVariantAggregate[];
  playtestAlignment: SimulationPlaytestAlignment;
  comparisonTable: Array<{
    variantId: string;
    labelZh: string;
    winRate: number;
    avgCompletedTasks: number;
    avgFinalPressure: number;
    avgResolvedEventRate: number;
    avgResolvedEventCount: number;
    avgEventCount: number;
    avgSurvivalRounds: number;
    avgResolvedEventsPerSurvivalRound: number;
    avgAdjacentHelpCount: number;
    avgPressure3MultiContributorRate: number;
    avgPressure6DeclareRate: number;
    avgCompanionUseCount: number;
    avgFinalSrTotal: number;
    avgFinalSpTotal: number;
    avgPeakSrTotal: number;
    avgPeakSpTotal: number;
    avgFailureRound: number | null;
    avgFirstDangerRound: number | null;
    avgFirstPressure6Round: number | null;
    earlyLossRate: number | null;
    lateLossR57Rate: number | null;
    lateLossR67Rate: number | null;
    winResourceTensionRate: number | null;
    playtestFitScore: number;
    avgMovedIntoRiskPerRound: number;
    avgRiskCampersPerRound: number;
  }>;
  gapDiagnosis: SimulationGapDiagnosis;
  benchmarkAlignment: SimulationBenchmarkAlignment;
  deltasFromFirstVariant: Array<{
    variantId: string;
    labelZh: string;
    winRateDelta: number;
    completedTasksDelta: number;
    finalPressureDelta: number;
    resolvedEventRateDelta: number;
    resolvedEventCountDelta: number;
    eventCountDelta: number;
    survivalRoundsDelta: number;
    resolvedEventsPerSurvivalRoundDelta: number;
    adjacentHelpDelta: number;
    pressure3MultiContributorDelta: number;
    pressure6DeclareDelta: number;
    companionUseDelta: number;
    finalSrDelta: number;
    finalSpDelta: number;
    peakSrDelta: number;
    peakSpDelta: number;
  }>;
};

export type SimulationBranchVerificationStatus = "pass" | "near" | "miss";

export type SimulationBranchVerificationRow = {
  presetId: string;
  presetLabelZh: string;
  baselineVariantId: string;
  baselineLabelZh: string;
  status: SimulationBranchVerificationStatus;
  playtestFitScore: number;
  benchmarkGapScore: number;
  dominantAxisLabelZh: string;
  winRate: number;
  completedTaskAvg: number;
  passCount: number;
  nearCount: number;
  missCount: number;
  summaryZh: string[];
};

export type SimulationBranchVerificationReport = {
  generatedAt: string;
  runCount: number;
  seed: number;
  rows: SimulationBranchVerificationRow[];
  summaryZh: string[];
};


export const DEFAULT_SIMULATION_COMPARE_PRESET_ID = "tuning_axes_v7";
export const DEFAULT_SIMULATION_BRANCH_PRESET_IDS = [
  "ai_policy_alignment",
  "event_resolution_alignment",
  "survival_cadence_alignment",
  "action_profile_response",
  "pool_profile_compact",
  "cap_mode_baseline",
] as const;

export const SIMULATION_COMPARE_PRESETS: SimulationComparePresetDefinition[] = [
  {
    presetId: "custom_ai_builder",
    labelZh: "自定義 AI 試跑",
    descriptionZh: "用白話順序建立一個自定義 AI，直接和現行主線 AI 並排比較，先回答它的勝率、任務完成數與事件處理節奏。",
    variantLabelsZh: ["現行主線 AI", "你的自定義 AI"],
  },
  {
    presetId: "cap_mode_baseline",
    labelZh: "資源上限比較",
    descriptionZh: "直接比較無上限基線與有上限參照，先驗證是否出現資源雪球或合作需求下降。",
    variantLabelsZh: ["無上限基線", "有上限參照"],
  },
  {
    presetId: "action_profile_response",
    labelZh: "行動牌池比較",
    descriptionZh: "在同樣無上限規則下，比較核心基線牌池與加入攜手應對後的牌池差異。",
    variantLabelsZh: ["核心基線牌池", "核心＋攜手應對"],
  },
  {
    presetId: "pool_profile_compact",
    labelZh: "事件／任務池比較",
    descriptionZh: "比較首輪全牌池與精簡 4 張混合池，檢查牌池密度與重複輪替是否改變整體壓力。",
    variantLabelsZh: ["全事件 8＋全任務 6", "混合核心事件 4＋任務 4"],
  },
  {
    presetId: "tuning_axes_v1",
    labelZh: "參數軸掃描 v1",
    descriptionZh: "固定 Canonical v2f AI 主線後，直接掃描事件層、survival economy、support 卡效與風險懲罰的全域參數軸，快速判斷哪一類規則最敏感。",
    variantLabelsZh: ["Canonical v2f 主線", "事件需求 +1", "事件懲罰 +1", "回復經濟 -1", "陪伴更嚴", "風險停留 +1", "支援牌效 -1"],
  },
  {
    presetId: "tuning_axes_v2",
    labelZh: "參數軸掃描 v2",
    descriptionZh: "把 v1 的粗軸拆成事件 SR/SP、庇護所/物資站、陪伴防損三組子軸，並加入兩個最有價值的組合軸，檢查哪一條最接近 Python benchmark。",
    variantLabelsZh: ["Canonical v2f 主線", "事件需求 SR +1", "事件需求 SP +1", "庇護所回復 -1", "物資站回復 -1", "陪伴防損更嚴", "庇護所 -1＋事件 SR 需求 +1", "物資站 -1＋陪伴防損更嚴"],
  },
  {
    presetId: "tuning_axes_v3",
    labelZh: "參數軸掃描 v3",
    descriptionZh: "把事件需求 SP 側當主嫌，去跟 survival economy 做交叉驗證，看它是單獨成立，還是要和 companion / recovery 一起收才有效。",
    variantLabelsZh: ["Canonical v2f 主線", "事件需求 SP +1", "事件需求 SR +1", "事件需求 SP +1＋陪伴防損更嚴", "事件需求 SP +1＋物資站 -1", "事件需求 SP +1＋庇護所 -1", "事件未解懲罰 SP +1", "事件立即懲罰 SP +1"],
  },
  {
    presetId: "tuning_axes_v4",
    labelZh: "參數軸掃描 v4",
    descriptionZh: "以事件 SP 需求側為核心懷疑點，驗證它到底是單獨就夠，還是必須與未解 SP 懲罰或 survival economy 一起收才最接近 Python。",
    variantLabelsZh: ["Canonical v2f 主線", "事件需求 SP +1", "事件需求 SP +2", "事件需求 SP +1＋陪伴防損更嚴", "事件需求 SP +1＋物資站 -1", "事件需求 SP +1＋庇護所 -1", "事件需求 SP +1＋事件未解懲罰 SP +1", "事件未解懲罰 SP +1"],
  },
  {
    presetId: "tuning_axes_v5",
    labelZh: "參數軸掃描 v5",
    descriptionZh: "直接裁定事件 SP 壓力結構：把事件需求 SP、未解 SP、立即 SP 與物資站 -1 放進同一輪 compare，主評分改看首玩體驗基準，Python 只保留為次級校正。",
    variantLabelsZh: ["Canonical v2f 主線", "事件需求 SP +1", "事件未解懲罰 SP +1", "事件需求 SP +1＋事件未解懲罰 SP +1", "事件需求 SP +1＋事件立即懲罰 SP +1", "事件未解懲罰 SP +1＋物資站 -1", "事件需求 SP +1＋事件未解懲罰 SP +1＋物資站 -1"],
  },
  {
    presetId: "tuning_axes_v6",
    labelZh: "參數軸掃描 v6",
    descriptionZh: "固定事件未解懲罰 SP +1 為事件主嫌基線，再掃 survival cadence：陪伴收緊、相鄰互助收緊、風險暴露提高、庇護所／物資站回復微收，以及一條二階組合軸。主評分仍以首玩體驗 fit score 為主。",
    variantLabelsZh: ["A2 基線：事件未解懲罰 SP +1", "A2＋陪伴更嚴", "A2＋相鄰互助更保守", "A2＋風險暴露提高", "A2＋庇護所 -1", "A2＋物資站 -1", "A2＋陪伴更嚴＋物資站 -1"],
  },
  {
    presetId: "tuning_axes_v7",
    labelZh: "參數軸掃描 v7",
    descriptionZh: "把 AI 基底拉回較寬的 Canonical Humanized，重新驗 A2 是否足以把勝率壓進首玩帶，再用 risk / help / station / companion 這幾條第二刀檢查哪些能改善敗局後移與惜敗感，而不是單純前置爆打。",
    variantLabelsZh: ["Canonical Humanized 主線", "Canonical Humanized＋A2", "Canonical Humanized＋A2＋風險暴露提高", "Canonical Humanized＋A2＋相鄰互助更保守", "Canonical Humanized＋A2＋物資站 -1", "Canonical Humanized＋A2＋陪伴更嚴"],
  },
  {
    presetId: "gap_root_cause_alignment",
    labelZh: "gap 主因拆解比較",
    descriptionZh: "以 Canonical v2f 為正式候選基線，再把 v2e、SP 回復更保守、陪伴更保守、互助門檻與事件 throughput 線放進同一組 compare，直接判斷 web 對 Python 的剩餘差距更像 survival cadence，還是 per-round resolution。",
    variantLabelsZh: ["Canonical v2f 主線", "Canonical v2e 主線", "v2f 陪伴再細收", "v2f SP 回復＋陪伴更保守", "只改互助門檻", "只改事件投入／打牌時機"],
  },
  {
    presetId: "canonical_v2b_refinement",
    labelZh: "Canonical v2b 收斂比較",
    descriptionZh: "以 v2 先收陪伴為底，補兩條較輕的互助／風險收法，找出比 companion-only 更接近 Python、但又不會像 full v2 收過頭的中間點。",
    variantLabelsZh: ["Canonical v1 主線", "v2 先收陪伴", "v2b 陪伴＋輕收互助", "Canonical v2b 候選", "Canonical v2 候選（重收版）"],
  },
  {
    presetId: "canonical_v2c_refinement",
    labelZh: "Canonical v2c 收斂比較",
    descriptionZh: "沿著 v2b 繼續往 survival cadence 微調，但第二刀不再押風險，而是改試 companion-first + tighter recovery，檢查它能不能比 v2b 更穩定地靠近 Python。",
    variantLabelsZh: ["Canonical v1 主線", "v2 先收陪伴", "Canonical v2b 候選", "v2c 陪伴＋保守站點", "Canonical v2c 候選"],
  },
  {
    presetId: "canonical_v2e_refinement",
    labelZh: "Canonical v2e 微調比較",
    descriptionZh: "沿著 v2d 繼續只做 survival cadence 內的細修，不再擴到 throughput。這組把 companion-first + 保守庇護所再往下拆成雙站點更保守與更保守 companion，找出比 v2d 更接近 Python、並可正式升格的 v2e 主線。",
    variantLabelsZh: ["Canonical v2d 主線", "v2e 雙站點更保守", "v2e SP 互助微放鬆", "v2e 陪伴更保守", "Canonical v2e 主線"],
  },
  {
    presetId: "canonical_v2f_refinement",
    labelZh: "Canonical v2f 微調比較",
    descriptionZh: "沿著 v2e 繼續只在 survival cadence 內做最後一輪窄微調：不再碰 help 或 risk，只比較 companion 再細收與 shelter / SP recovery 再細收，找出是否還有比 v2e 更接近 Python 的 v2f 主線。",
    variantLabelsZh: ["Canonical v2e 主線", "Canonical v2f 主線", "v2f SP 回復＋陪伴更保守", "v2f 陪伴再細收"],
  },
  {
    presetId: "canonical_v2d_refinement",
    labelZh: "Canonical v2d 微調比較",
    descriptionZh: "沿著 v2c 繼續只做 survival cadence 內的微調，不再擴到 event throughput。這組把 companion-first + tighter recovery 再拆成偏 SP 回復、偏 SR 回復與更保守 companion，找出比 v2c 更接近 Python、並可正式升格的 v2d 主線。",
    variantLabelsZh: ["Canonical v2c 主線", "v2d 陪伴＋保守庇護所", "v2d 陪伴更保守", "Canonical v2d 主線"],
  },
  {
    presetId: "canonical_v2_refinement",
    labelZh: "Canonical v2 收斂比較",
    descriptionZh: "直接沿著 survival cadence 主因往下收：先收 companion，再收互助門檻，最後再收風險暴露，檢查哪一階最接近 Python benchmark，同時避免把每存活回合解題能力一起砍壞。",
    variantLabelsZh: ["Canonical v2 候選", "Canonical v1 主線", "v2 先收陪伴", "v2 收陪伴＋互助"],
  },
  {
    presetId: "ai_policy_alignment",
    labelZh: "AI policy 主線候選比較",
    descriptionZh: "以 Canonical Humanized 為正式候選口徑，對照 Solver 基線與各子因子，檢查 web simulation 要採哪條主線最可信。",
    variantLabelsZh: ["Solver 基線", "只加任務漏宣告", "只改風險移動", "只改互助門檻", "只改事件投入／打牌時機", "Canonical Humanized 候選", "全部都加"],
  },
  {
    presetId: "event_resolution_alignment",
    labelZh: "事件解決數收斂比較",
    descriptionZh: "以 Canonical Humanized 為主線，直接拆看事件為何仍比 Python 更容易解掉，優先檢查〈看準重點〉與投入門檻。",
    variantLabelsZh: ["Canonical 主線", "停用〈看準重點〉", "提高投入保守度", "兩者都加"],
  },
  {
    presetId: "survival_cadence_alignment",
    labelZh: "生存節奏收斂比較",
    descriptionZh: "以 Canonical Humanized 為主線，拆看陪伴標記介入、站點回復門檻與風險暴露是否讓 web 主線活得太久。",
    variantLabelsZh: ["Canonical 主線", "陪伴標記更保守", "站點回復更保守", "風險暴露提高", "三者都加"],
  },
];

const ZERO_TUNING_AXES: SimulationTuningAxes = {
  eventImmediateSrDelta: 0,
  eventImmediateSpDelta: 0,
  eventUnresolvedSrDelta: 0,
  eventUnresolvedSpDelta: 0,
  eventDemandSrDelta: 0,
  eventDemandSpDelta: 0,
  stationRecoveryDelta: 0,
  shelterRecoveryDelta: 0,
  supportCardRecoveryDelta: 0,
  focusDemandReductionDelta: 0,
  riskStaySrPenaltyDelta: 0,
  riskStaySpPenaltyDelta: 0,
  companionPreventDelta: 0,
  companionComfortSpDelta: 0,
};

function normalizeTuningAxes(tuningAxes?: Partial<SimulationTuningAxes>): SimulationTuningAxes {
  return { ...ZERO_TUNING_AXES, ...(tuningAxes ?? {}) };
}

function clampLossDelta(value: number) {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function buildEligibleCompanionSeatIdsForSimulation(players: GameSnapshot["players"], targetSeat: SeatId) {
  return players.filter((player) => player.seatId !== targetSeat && player.companionTokensRemaining > 0).map((player) => player.seatId);
}

function areTilesSameOrAdjacentForSimulation(mapTiles: GameSnapshot["mapTiles"], fromTileId: string, toTileId: string) {
  if (fromTileId === toTileId) return true;
  const fromTile = getTileById(mapTiles, fromTileId);
  return fromTile?.adjacentTileIds.includes(toTileId) ?? false;
}

function buildLossWindowFromQueueForSimulation(snapshot: GameSnapshot) {
  const next = snapshot.pendingLossQueue.shift();
  if (!next) {
    snapshot.blockingWindow = null;
    return false;
  }
  snapshot.blockingWindow = {
    kind: "loss",
    lossChainId: next.lossChainId,
    targetSeat: next.targetSeat,
    srLoss: next.srLoss,
    spLoss: next.spLoss,
    eligibleCompanionSeatIds: next.eligibleCompanionSeatIds,
    companionUsed: false,
    companionReaction: null,
    sourceType: next.sourceType,
    sourceLabelZh: next.sourceLabelZh,
    merchantGuardSeat: null,
  };
  return true;
}

function adjustLossWindowAmounts(window: NonNullable<GameSnapshot["blockingWindow"]>, srDelta: number, spDelta: number) {
  if (window.kind !== "loss") return;
  window.srLoss = Math.max(0, window.srLoss + clampLossDelta(srDelta));
  window.spLoss = Math.max(0, window.spLoss + clampLossDelta(spDelta));
}

function adjustPendingLossEntries(snapshot: GameSnapshot, predicate: (entry: { sourceLabelZh: string; sourceType: string }) => boolean, srDelta: number, spDelta: number) {
  if (snapshot.blockingWindow?.kind === "loss" && predicate(snapshot.blockingWindow)) adjustLossWindowAmounts(snapshot.blockingWindow, srDelta, spDelta);
  snapshot.pendingLossQueue = snapshot.pendingLossQueue.map((entry) => predicate(entry)
    ? { ...entry, srLoss: Math.max(0, entry.srLoss + clampLossDelta(srDelta)), spLoss: Math.max(0, entry.spLoss + clampLossDelta(spDelta)) }
    : entry);
}

function buildImmediateEffectLossesForSimulation(snapshot: GameSnapshot, srLoss: number, spLoss: number) {
  const event = snapshot.currentEvent;
  const effect = event?.immediateEffect;
  if (!event || !effect || (srLoss <= 0 && spLoss <= 0)) return [] as GameSnapshot["pendingLossQueue"];
  const losses: GameSnapshot["pendingLossQueue"] = [];
  const sourceLabelZh = `事件翻開立即效果：${event.nameZh}`;
  if (effect.mode === "each_player") {
    for (const player of snapshot.players) {
      losses.push({
        lossChainId: `${event.cardId}-sim-immediate-${player.seatId}-${snapshot.round}-${Math.random().toString(36).slice(2,5)}`,
        targetSeat: player.seatId,
        srLoss,
        spLoss,
        eligibleCompanionSeatIds: buildEligibleCompanionSeatIdsForSimulation(snapshot.players, player.seatId),
        sourceType: "event_penalty",
        sourceLabelZh,
      });
    }
    return losses;
  }
  for (const player of snapshot.players) {
    if (!player.positionTileId) continue;
    const hasAdjacentTeammate = snapshot.players.some((other) => {
      if (other.seatId === player.seatId || !other.positionTileId) return false;
      return areTilesSameOrAdjacentForSimulation(snapshot.mapTiles, player.positionTileId!, other.positionTileId);
    });
    if (hasAdjacentTeammate) continue;
    losses.push({
      lossChainId: `${event.cardId}-sim-immediate-${player.seatId}-${snapshot.round}-${Math.random().toString(36).slice(2,5)}`,
      targetSeat: player.seatId,
      srLoss,
      spLoss,
      eligibleCompanionSeatIds: buildEligibleCompanionSeatIdsForSimulation(snapshot.players, player.seatId),
      sourceType: "event_penalty",
      sourceLabelZh,
    });
  }
  return losses;
}

function applyTuningBeforeAction(snapshot: GameSnapshot, action: { type: string }, tuningAxes: SimulationTuningAxes) {
  if (action.type === "resolve_campfire" && snapshot.currentEvent) {
    snapshot.currentEvent.penalty.srLoss = Math.max(0, (snapshot.currentEvent.penalty.srLoss ?? 0) + tuningAxes.eventUnresolvedSrDelta);
    snapshot.currentEvent.penalty.spLoss = Math.max(0, (snapshot.currentEvent.penalty.spLoss ?? 0) + tuningAxes.eventUnresolvedSpDelta);
  }
}

function applyTuningAfterAction(before: GameSnapshot, after: GameSnapshot, action: { type: string; [key: string]: unknown }, tuningAxes: SimulationTuningAxes) {
  if (action.type === "start_round" && after.currentEvent) {
    after.currentEvent.requirement.srRequired = Math.max(0, after.currentEvent.requirement.srRequired + tuningAxes.eventDemandSrDelta);
    after.currentEvent.requirement.spRequired = Math.max(0, after.currentEvent.requirement.spRequired + tuningAxes.eventDemandSpDelta);
    const sourceLabelZh = `事件翻開立即效果：${after.currentEvent.nameZh}`;
    if (tuningAxes.eventImmediateSrDelta < 0 || tuningAxes.eventImmediateSpDelta < 0) {
      adjustPendingLossEntries(after, (entry) => entry.sourceLabelZh === sourceLabelZh, tuningAxes.eventImmediateSrDelta, tuningAxes.eventImmediateSpDelta);
    }
    if (tuningAxes.eventImmediateSrDelta > 0 || tuningAxes.eventImmediateSpDelta > 0) {
      after.pendingLossQueue.push(...buildImmediateEffectLossesForSimulation(after, Math.max(0, tuningAxes.eventImmediateSrDelta), Math.max(0, tuningAxes.eventImmediateSpDelta)));
      if (!after.blockingWindow && after.pendingLossQueue.length > 0) buildLossWindowFromQueueForSimulation(after);
    }
    return;
  }

  if (action.type === "resolve_campfire") {
    if (tuningAxes.riskStaySrPenaltyDelta !== 0 || tuningAxes.riskStaySpPenaltyDelta !== 0) {
      adjustPendingLossEntries(after, (entry) => entry.sourceType === "risk_tile", tuningAxes.riskStaySrPenaltyDelta, tuningAxes.riskStaySpPenaltyDelta);
    }
    return;
  }

  if (action.type === "use_station_or_shelter") {
    const actorSeat = String(action.actorSeat);
    const beforeActor = before.players.find((player) => player.seatId === actorSeat);
    const afterActor = after.players.find((player) => player.seatId === actorSeat);
    if (!beforeActor || !afterActor || !beforeActor.positionTileId) return;
    const tile = getTileById(before.mapTiles, beforeActor.positionTileId);
    if (!tile) return;
    if (tile.kind === "station" && tuningAxes.stationRecoveryDelta !== 0) {
      if (tuningAxes.stationRecoveryDelta > 0) recoverResource(afterActor, "SR", tuningAxes.stationRecoveryDelta, after.roomConfig);
      else afterActor.currentSr = Math.max(0, afterActor.currentSr + tuningAxes.stationRecoveryDelta);
    }
    if (tile.kind === "shelter" && tuningAxes.shelterRecoveryDelta !== 0) {
      if (tuningAxes.shelterRecoveryDelta > 0) recoverResource(afterActor, "SP", tuningAxes.shelterRecoveryDelta, after.roomConfig);
      else afterActor.currentSp = Math.max(0, afterActor.currentSp + tuningAxes.shelterRecoveryDelta);
    }
    return;
  }

  if (action.type === "play_action_card") {
    const cardId = String(action.cardId ?? "");
    const actorSeat = String(action.actorSeat ?? "");
    if (cardId === "card_same_tile_care" && action.targetSeat && action.resourceType && tuningAxes.supportCardRecoveryDelta !== 0) {
      const target = after.players.find((player) => player.seatId === String(action.targetSeat));
      if (target) {
        if (action.resourceType === "SR") {
          if (tuningAxes.supportCardRecoveryDelta > 0) recoverResource(target, "SR", tuningAxes.supportCardRecoveryDelta, after.roomConfig);
          else target.currentSr = Math.max(0, target.currentSr + tuningAxes.supportCardRecoveryDelta);
        } else {
          if (tuningAxes.supportCardRecoveryDelta > 0) recoverResource(target, "SP", tuningAxes.supportCardRecoveryDelta, after.roomConfig);
          else target.currentSp = Math.max(0, target.currentSp + tuningAxes.supportCardRecoveryDelta);
        }
      }
    }
    if (cardId === "card_hold_together" && action.targetSeat && tuningAxes.supportCardRecoveryDelta !== 0) {
      const actor = after.players.find((player) => player.seatId === actorSeat);
      const target = after.players.find((player) => player.seatId === String(action.targetSeat));
      for (const player of [actor, target]) {
        if (!player) continue;
        if (tuningAxes.supportCardRecoveryDelta > 0) recoverResource(player, "SP", tuningAxes.supportCardRecoveryDelta, after.roomConfig);
        else player.currentSp = Math.max(0, player.currentSp + tuningAxes.supportCardRecoveryDelta);
      }
    }
    if (cardId === "card_focus_the_point" && after.currentEvent && action.resourceType && tuningAxes.focusDemandReductionDelta !== 0) {
      const adjust = tuningAxes.focusDemandReductionDelta;
      if (action.resourceType === "SR") after.currentEvent.requirement.srRequired = Math.max(0, after.currentEvent.requirement.srRequired - adjust);
      else after.currentEvent.requirement.spRequired = Math.max(0, after.currentEvent.requirement.spRequired - adjust);
    }
    return;
  }

  if (action.type === "finalize_pending_loss" && before.blockingWindow?.kind === "loss") {
    const beforeWindow = before.blockingWindow;
    const target = after.players.find((player) => player.seatId === beforeWindow.targetSeat);
    if (!target) return;
    if (beforeWindow.companionReaction?.type === "prevent" && tuningAxes.companionPreventDelta !== 0) {
      const resource = beforeWindow.companionReaction.preventResource;
      if (resource === "SR") {
        if (tuningAxes.companionPreventDelta > 0) recoverResource(target, "SR", tuningAxes.companionPreventDelta, after.roomConfig);
        else target.currentSr = Math.max(0, target.currentSr + tuningAxes.companionPreventDelta);
      } else {
        if (tuningAxes.companionPreventDelta > 0) recoverResource(target, "SP", tuningAxes.companionPreventDelta, after.roomConfig);
        else target.currentSp = Math.max(0, target.currentSp + tuningAxes.companionPreventDelta);
      }
    }
    if (beforeWindow.companionReaction?.type === "comfort" && tuningAxes.companionComfortSpDelta !== 0) {
      if (tuningAxes.companionComfortSpDelta > 0) recoverResource(target, "SP", tuningAxes.companionComfortSpDelta, after.roomConfig);
      else target.currentSp = Math.max(0, target.currentSp + tuningAxes.companionComfortSpDelta);
    }
  }
}

export const DEFAULT_SIMULATION_COMPARE_VARIANTS: SimulationVariantInput[] = buildPresetVariants(DEFAULT_SIMULATION_COMPARE_PRESET_ID, 50);

export function getSimulationComparePresetDefinitions() {
  return structuredClone(SIMULATION_COMPARE_PRESETS);
}

export function getSimulationComparePreset(presetId?: string) {
  return SIMULATION_COMPARE_PRESETS.find((preset) => preset.presetId === presetId) ?? SIMULATION_COMPARE_PRESETS[0];
}

export function buildPresetVariants(presetId: string, runCount: number): SimulationVariantInput[] {
  const resolvedRunCount = normalizeRunCount(runCount);

  switch (presetId) {
    case "custom_ai_builder":
      return [
        {
          variantId: "current_mainline_ai",
          labelZh: "現行主線 AI",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
          },
        },
        {
          variantId: "custom_ai_candidate",
          labelZh: "自定義 AI",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
          },
          customAiPolicy: {
            labelZh: "自定義 AI",
            priorityOrder: ["stabilize_self", "stabilize_team", "resolve_event"],
            selfSafetyLine: 1,
            teamSafetyLine: 1,
            eventContributionBuffer: 1,
          },
        },
      ];
    case "action_profile_response":
      return [
        {
          variantId: "core_action_baseline",
          labelZh: "核心基線牌池",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            actionDeckProfileId: "core_baseline",
            experimentalRuleToggles: { respondTogetherEnabled: false },
          },
        },
        {
          variantId: "core_plus_response",
          labelZh: "核心＋攜手應對",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            actionDeckProfileId: "core_plus_response",
            experimentalRuleToggles: { respondTogetherEnabled: true },
          },
        },
      ];
    case "pool_profile_compact":
      return [
        {
          variantId: "full_pool_reference",
          labelZh: "全事件 8＋全任務 6",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            eventPoolProfileId: "first_round_full_8",
            taskPoolProfileId: "first_round_full_6",
          },
        },
        {
          variantId: "compact_pool_variant",
          labelZh: "混合核心事件 4＋任務 4",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            eventPoolProfileId: "core_mixed_4",
            taskPoolProfileId: "core_mixed_4",
          },
        },
      ];
    case "tuning_axes_v1":
      return [
        {
          variantId: "tuning_axes_v1_baseline",
          labelZh: "Canonical v2f 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2f",
          },
        },
        {
          variantId: "tuning_axes_v1_event_demand_plus_1",
          labelZh: "事件需求 +1",
          runCount: resolvedRunCount,
          tuningAxes: { eventDemandSrDelta: 1, eventDemandSpDelta: 1 },
          roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" },
        },
        {
          variantId: "tuning_axes_v1_event_penalty_plus_1",
          labelZh: "事件懲罰 +1",
          runCount: resolvedRunCount,
          tuningAxes: { eventImmediateSrDelta: 1, eventImmediateSpDelta: 1, eventUnresolvedSrDelta: 1, eventUnresolvedSpDelta: 1 },
          roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" },
        },
        {
          variantId: "tuning_axes_v1_recovery_minus_1",
          labelZh: "回復經濟 -1",
          runCount: resolvedRunCount,
          tuningAxes: { shelterRecoveryDelta: -1, stationRecoveryDelta: -1 },
          roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" },
        },
        {
          variantId: "tuning_axes_v1_companion_stricter",
          labelZh: "陪伴更嚴",
          runCount: resolvedRunCount,
          tuningAxes: { companionPreventDelta: -1, companionComfortSpDelta: -1 },
          roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" },
        },
        {
          variantId: "tuning_axes_v1_risk_penalty_plus_1",
          labelZh: "風險停留 +1",
          runCount: resolvedRunCount,
          tuningAxes: { riskStaySrPenaltyDelta: 1 },
          roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" },
        },
        {
          variantId: "tuning_axes_v1_support_minus_1",
          labelZh: "支援牌效 -1",
          runCount: resolvedRunCount,
          tuningAxes: { supportCardRecoveryDelta: -1, focusDemandReductionDelta: -1 },
          roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" },
        },
      ];
    case "tuning_axes_v2":
      return [
        { variantId: "tuning_axes_v2_baseline", labelZh: "Canonical v2f 主線", runCount: resolvedRunCount, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v2_event_demand_sr_plus_1", labelZh: "事件需求 SR +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSrDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v2_event_demand_sp_plus_1", labelZh: "事件需求 SP +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v2_shelter_minus_1", labelZh: "庇護所回復 -1", runCount: resolvedRunCount, tuningAxes: { shelterRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v2_station_minus_1", labelZh: "物資站回復 -1", runCount: resolvedRunCount, tuningAxes: { stationRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v2_companion_prevent_stricter", labelZh: "陪伴防損更嚴", runCount: resolvedRunCount, tuningAxes: { companionPreventDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v2_shelter_minus_1_event_sr_plus_1", labelZh: "庇護所 -1＋事件 SR 需求 +1", runCount: resolvedRunCount, tuningAxes: { shelterRecoveryDelta: -1, eventDemandSrDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v2_station_minus_1_companion_stricter", labelZh: "物資站 -1＋陪伴防損更嚴", runCount: resolvedRunCount, tuningAxes: { stationRecoveryDelta: -1, companionPreventDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
      ];
    case "tuning_axes_v3":
      return [
        { variantId: "tuning_axes_v3_baseline", labelZh: "Canonical v2f 主線", runCount: resolvedRunCount, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v3_event_demand_sp_plus_1", labelZh: "事件需求 SP +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v3_event_demand_sr_plus_1", labelZh: "事件需求 SR +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSrDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v3_event_sp_plus_1_companion_stricter", labelZh: "事件需求 SP +1＋陪伴防損更嚴", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, companionPreventDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v3_event_sp_plus_1_station_minus_1", labelZh: "事件需求 SP +1＋物資站 -1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, stationRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v3_event_sp_plus_1_shelter_minus_1", labelZh: "事件需求 SP +1＋庇護所 -1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, shelterRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v3_event_unresolved_sp_plus_1", labelZh: "事件未解懲罰 SP +1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v3_event_immediate_sp_plus_1", labelZh: "事件立即懲罰 SP +1", runCount: resolvedRunCount, tuningAxes: { eventImmediateSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
      ];
    case "tuning_axes_v4":
      return [
        { variantId: "tuning_axes_v4_baseline", labelZh: "Canonical v2f 主線", runCount: resolvedRunCount, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v4_event_demand_sp_plus_1", labelZh: "事件需求 SP +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v4_event_demand_sp_plus_2", labelZh: "事件需求 SP +2", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 2 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v4_event_sp_plus_1_companion_stricter", labelZh: "事件需求 SP +1＋陪伴防損更嚴", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, companionPreventDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v4_event_sp_plus_1_station_minus_1", labelZh: "事件需求 SP +1＋物資站 -1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, stationRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v4_event_sp_plus_1_shelter_minus_1", labelZh: "事件需求 SP +1＋庇護所 -1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, shelterRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v4_event_sp_plus_1_unresolved_sp_plus_1", labelZh: "事件需求 SP +1＋事件未解懲罰 SP +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v4_event_unresolved_sp_plus_1", labelZh: "事件未解懲罰 SP +1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
      ];
    case "tuning_axes_v5":
      return [
        { variantId: "tuning_axes_v5_baseline", labelZh: "Canonical v2f 主線", runCount: resolvedRunCount, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v5_event_demand_sp_plus_1", labelZh: "事件需求 SP +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v5_event_unresolved_sp_plus_1", labelZh: "事件未解懲罰 SP +1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v5_event_demand_sp_plus_1_unresolved_sp_plus_1", labelZh: "事件需求 SP +1＋事件未解懲罰 SP +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v5_event_demand_sp_plus_1_immediate_sp_plus_1", labelZh: "事件需求 SP +1＋事件立即懲罰 SP +1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, eventImmediateSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v5_event_unresolved_sp_plus_1_station_minus_1", labelZh: "事件未解懲罰 SP +1＋物資站 -1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1, stationRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v5_event_demand_sp_plus_1_unresolved_sp_plus_1_station_minus_1", labelZh: "事件需求 SP +1＋事件未解懲罰 SP +1＋物資站 -1", runCount: resolvedRunCount, tuningAxes: { eventDemandSpDelta: 1, eventUnresolvedSpDelta: 1, stationRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
      ];
    case "tuning_axes_v6":
      return [
        { variantId: "tuning_axes_v6_baseline_a2", labelZh: "A2 基線：事件未解懲罰 SP +1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v6_a2_companion_stricter", labelZh: "A2＋陪伴更嚴", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1, companionPreventDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v6_a2_help_gate", labelZh: "A2＋相鄰互助更保守", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_v2f_help_gate" } },
        { variantId: "tuning_axes_v6_a2_risk_exposure", labelZh: "A2＋風險暴露提高", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_v2f_risk_exposure" } },
        { variantId: "tuning_axes_v6_a2_shelter_minus_1", labelZh: "A2＋庇護所 -1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1, shelterRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v6_a2_station_minus_1", labelZh: "A2＋物資站 -1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1, stationRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
        { variantId: "tuning_axes_v6_a2_companion_station_combo", labelZh: "A2＋陪伴更嚴＋物資站 -1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1, companionPreventDelta: -1, stationRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_v2f" } },
      ];
    case "tuning_axes_v7":
      return [
        { variantId: "tuning_axes_v7_baseline", labelZh: "Canonical Humanized 主線", runCount: resolvedRunCount, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized" } },
        { variantId: "tuning_axes_v7_a2", labelZh: "Canonical Humanized＋A2", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized" } },
        { variantId: "tuning_axes_v7_a2_risk_exposure", labelZh: "Canonical Humanized＋A2＋風險暴露提高", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_risk_exposure" } },
        { variantId: "tuning_axes_v7_a2_help_gate", labelZh: "Canonical Humanized＋A2＋相鄰互助更保守", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized_help_gate" } },
        { variantId: "tuning_axes_v7_a2_station_minus_1", labelZh: "Canonical Humanized＋A2＋物資站 -1", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1, stationRecoveryDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized" } },
        { variantId: "tuning_axes_v7_a2_companion_stricter", labelZh: "Canonical Humanized＋A2＋陪伴更嚴", runCount: resolvedRunCount, tuningAxes: { eventUnresolvedSpDelta: 1, companionPreventDelta: -1 }, roomConfigPatch: { resourceCapMode: "uncapped", aiPolicyProfileId: "canonical_humanized" } },
      ];
    case "gap_root_cause_alignment":
      return [
        {
          variantId: "canonical_gap_root_v2f_baseline",
          labelZh: "Canonical v2f 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2f_sp_recovery_companion",
          },
        },
        {
          variantId: "canonical_gap_root_v2e_reference",
          labelZh: "Canonical v2e 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2d_sp_recovery_companion",
          },
        },
        {
          variantId: "gap_root_v2f_companion_variant",
          labelZh: "v2f 陪伴再細收",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2f",
          },
        },
        {
          variantId: "gap_root_v2f_guarded_variant",
          labelZh: "v2f SP 回復＋陪伴更保守",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2f_sp_recovery_guarded",
          },
        },
        {
          variantId: "gap_root_help_gate_only",
          labelZh: "只改互助門檻",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "help_gate_only",
          },
        },
        {
          variantId: "gap_root_invest_timing_only",
          labelZh: "只改事件投入／打牌時機",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "invest_timing_only",
          },
        },
      ];
    case "canonical_v2b_refinement":
      return [
        {
          variantId: "canonical_v1_reference",
          labelZh: "Canonical v1 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
          },
        },
        {
          variantId: "canonical_v2_companion_first_variant",
          labelZh: "v2 先收陪伴",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2_companion_first",
          },
        },
        {
          variantId: "canonical_v2b_help_light_variant",
          labelZh: "v2b 陪伴＋輕收互助",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2b_help_light",
          },
        },
        {
          variantId: "canonical_humanized_v2b_candidate",
          labelZh: "Canonical v2b 候選",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2b",
          },
        },
        {
          variantId: "canonical_humanized_v2_candidate",
          labelZh: "Canonical v2 候選（重收版）",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2",
          },
        },
      ];
    case "canonical_v2c_refinement":
      return [
        {
          variantId: "canonical_v1_reference",
          labelZh: "Canonical v1 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
          },
        },
        {
          variantId: "canonical_v2_companion_first_variant",
          labelZh: "v2 先收陪伴",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2_companion_first",
          },
        },
        {
          variantId: "canonical_humanized_v2b_candidate",
          labelZh: "Canonical v2b 候選",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2b",
          },
        },
        {
          variantId: "canonical_v2c_recovery_variant",
          labelZh: "v2c 陪伴＋保守站點",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2c_recovery_companion",
          },
        },
        {
          variantId: "canonical_humanized_v2c_candidate",
          labelZh: "Canonical v2c 候選",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2c",
          },
        },
      ];
    case "canonical_v2d_refinement":
      return [
        {
          variantId: "canonical_v2c_baseline",
          labelZh: "Canonical v2c 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2c_recovery_companion",
          },
        },
        {
          variantId: "canonical_v2d_mainline",
          labelZh: "Canonical v2d 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2d_sp_recovery_companion",
          },
        },
        {
          variantId: "canonical_humanized_v2d_candidate",
          labelZh: "v2d 陪伴更保守",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2d",
          },
        },
        {
          variantId: "canonical_v2d_sr_recovery_variant",
          labelZh: "v2d 偏 SR 保守物資站",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2d_sr_recovery_companion",
          },
        },
      ];
    case "canonical_v2e_refinement":
      return [
        {
          variantId: "canonical_v2d_baseline",
          labelZh: "Canonical v2d 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2d_sp_recovery_companion",
          },
        },
        {
          variantId: "canonical_v2e_mainline",
          labelZh: "Canonical v2e 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2e_dual_recovery_companion",
          },
        },
        {
          variantId: "canonical_v2e_soft_sp_help_variant",
          labelZh: "v2e SP 互助微放鬆",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2e_soft_sp_help",
          },
        },
        {
          variantId: "canonical_v2e_companion_guarded_variant",
          labelZh: "v2e 陪伴更保守",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2e_companion_guarded",
          },
        },
        {
          variantId: "canonical_humanized_v2e_candidate",
          labelZh: "v2e 雙站點＋陪伴更保守",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2e",
          },
        },
      ];
    case "canonical_v2f_refinement":
      return [
        {
          variantId: "canonical_v2e_baseline",
          labelZh: "Canonical v2e 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2e_dual_recovery_companion",
          },
        },
        {
          variantId: "canonical_v2f_mainline",
          labelZh: "Canonical v2f 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2f_sp_recovery_companion",
          },
        },
        {
          variantId: "canonical_v2f_guarded_variant",
          labelZh: "v2f SP 回復＋陪伴更保守",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2f_sp_recovery_guarded",
          },
        },
        {
          variantId: "canonical_v2f_companion_variant",
          labelZh: "v2f 陪伴再細收",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2f",
          },
        },
      ];
    case "canonical_v2_refinement":
      return [
        {
          variantId: "canonical_v1_reference",
          labelZh: "Canonical v1 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
          },
        },
        {
          variantId: "canonical_v2_companion_first_variant",
          labelZh: "v2 先收陪伴",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2_companion_first",
          },
        },
        {
          variantId: "canonical_v2_help_companion_variant",
          labelZh: "v2 收陪伴＋互助",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_v2_help_companion",
          },
        },
        {
          variantId: "canonical_humanized_v2_candidate",
          labelZh: "Canonical v2 候選",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized_v2",
          },
        },
      ];
    case "ai_policy_alignment":
      return [
        {
          variantId: "solver_baseline_policy",
          labelZh: "Solver 基線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "solver_baseline",
          },
        },
        {
          variantId: "task_noise_only_policy",
          labelZh: "只加任務漏宣告",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "task_noise_only",
          },
        },
        {
          variantId: "risk_move_only_policy",
          labelZh: "只改風險移動",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "risk_move_only",
          },
        },
        {
          variantId: "help_gate_only_policy",
          labelZh: "只改互助門檻",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "help_gate_only",
          },
        },
        {
          variantId: "invest_timing_only_policy",
          labelZh: "只改事件投入／打牌時機",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "invest_timing_only",
          },
        },
        {
          variantId: "canonical_humanized_policy",
          labelZh: "Canonical Humanized 候選",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
          },
        },
        {
          variantId: "humanized_policy_v1",
          labelZh: "全部都加",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "humanized_v1",
          },
        },
      ];
    case "event_resolution_alignment":
      return [
        {
          variantId: "canonical_event_baseline",
          labelZh: "Canonical 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
          },
        },
        {
          variantId: "canonical_no_focus_point",
          labelZh: "停用〈看準重點〉",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
            cardToggles: { card_focus_the_point: false },
          },
        },
        {
          variantId: "canonical_stricter_invest",
          labelZh: "提高投入保守度",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "event_invest_harder",
          },
        },
        {
          variantId: "canonical_event_combo",
          labelZh: "兩者都加",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "event_alignment_combo",
            cardToggles: { card_focus_the_point: false },
          },
        },
      ];
    case "survival_cadence_alignment":
      return [
        {
          variantId: "canonical_survival_baseline",
          labelZh: "Canonical 主線",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "canonical_humanized",
          },
        },
        {
          variantId: "survival_companion_guarded_variant",
          labelZh: "陪伴標記更保守",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "survival_companion_guarded",
          },
        },
        {
          variantId: "survival_recovery_tighter_variant",
          labelZh: "站點回復更保守",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "survival_recovery_tighter",
          },
        },
        {
          variantId: "survival_risk_exposure_variant",
          labelZh: "風險暴露提高",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "survival_risk_exposure",
          },
        },
        {
          variantId: "survival_cadence_combo_variant",
          labelZh: "三者都加",
          runCount: resolvedRunCount,
          roomConfigPatch: {
            resourceCapMode: "uncapped",
            aiPolicyProfileId: "survival_cadence_combo",
          },
        },
      ];
    case "cap_mode_baseline":
    default:
      return [
        {
          variantId: "uncapped_baseline",
          labelZh: "無上限基線",
          runCount: resolvedRunCount,
          roomConfigPatch: { resourceCapMode: "uncapped" },
        },
        {
          variantId: "capped_reference",
          labelZh: "有上限參照",
          runCount: resolvedRunCount,
          roomConfigPatch: { resourceCapMode: "capped" },
        },
      ];
  }
}


function createSeededRandom(seed: number) {
  let t = seed >>> 0;
  return function seededRandom() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeededRandom<T>(seed: number, fn: () => T): T {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function normalizeRunCount(runCount: number) {
  if (!Number.isFinite(runCount)) return 100;
  return Math.max(1, Math.min(1000, Math.floor(runCount)));
}

function mergeRoomConfig(base: RoomConfig, patch?: SimulationVariantInput["roomConfigPatch"]): RoomConfig {
  if (!patch) return structuredClone(base);
  return {
    ...base,
    ...patch,
    cardToggles: { ...base.cardToggles, ...(patch.cardToggles ?? {}) },
    roleAbilityToggles: { ...base.roleAbilityToggles, ...(patch.roleAbilityToggles ?? {}) },
    experimentalRuleToggles: { ...base.experimentalRuleToggles, ...(patch.experimentalRuleToggles ?? {}) },
  };
}

function createSimulationPlayers() {
  const seats: SeatId[] = ["P1", "P2", "P3", "P4"];
  return seats.map((seatId, index) => ({
    seatId,
    displayName: `AI ${seatId}`,
    roleId: AI_ROLE_ASSIGNMENT_ORDER[index],
    isAi: true,
  }));
}

function describeCustomAiPolicy(policy?: CustomAiPolicyInput) {
  if (!policy) return "自定義 AI";
  return policy.labelZh?.trim() || "自定義 AI";
}

const TASK_NAME_MAP = Object.fromEntries(MINIMAL_TASKS.map((task) => [task.taskId, task.nameZh]));

function minSr(snapshot: GameSnapshot) {
  return Math.min(...snapshot.players.map((player) => player.currentSr));
}

function minSp(snapshot: GameSnapshot) {
  return Math.min(...snapshot.players.map((player) => player.currentSp));
}

function riskTileIdSet(snapshot: GameSnapshot) {
  return new Set(snapshot.mapTiles.filter((tile) => tile.kind === "risk").map((tile) => tile.tileId));
}

function riskCampers(snapshot: GameSnapshot) {
  const riskIds = riskTileIdSet(snapshot);
  return snapshot.players.filter((player) => player.positionTileId && riskIds.has(player.positionTileId)).length;
}

function normalizeActionLabel(action: Parameters<typeof applyRoomActionReducer>[0]["action"]) {
  if (action.type === "play_action_card") return `play_action_card:${action.cardId}`;
  if (action.type === "adjacent_help") return `adjacent_help:${action.resourceType}`;
  if (action.type === "invest_event") {
    const parts = [`sr${action.srPaid}`, `sp${action.spPaid}`];
    if (action.convertOne) parts.push(String(action.convertOne));
    return `invest_event:${parts.join("_")}`;
  }
  if (action.type === "declare_task") return `declare_task:${action.taskId}`;
  return action.type;
}

function toSortedHistogram(map: Map<number, number>) {
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([round, count]) => ({ round, count }));
}

function sortCountMap(map: Map<string, number>, denominator: number): SimulationActionFrequencyRow[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count, rate: denominator > 0 ? count / denominator : 0 }));
}

function averageNullable(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => value != null);
  return filtered.length > 0 ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : null;
}

function buildTopLikelyOverstableCausesZh(variant: Pick<SimulationVariantAggregate, "avgMovedIntoRiskPerRound" | "avgRiskCampersPerRound" | "avgResolvedEventRate" | "avgAdjacentHelpCount" | "avgDeclaredTasks" | "taskDeclarationCounts" | "preLossStrategicTop">) {
  const lines: string[] = [];
  if (variant.avgMovedIntoRiskPerRound < 0.25 && variant.avgRiskCampersPerRound < 0.25) {
    lines.push("風險地格幾乎沒有真正進入主線：AI 明顯偏向安全站點／安全會合點，風險停留扣損沒有實際打到主線。");
  }
  if (variant.avgResolvedEventRate > 0.95 && variant.avgAdjacentHelpCount > 6) {
    lines.push("事件解決率與 0AP 相鄰互助都偏高：AI 目前更像 solver，會過度穩定地把危機處理乾淨。");
  }
  const topTask = variant.taskDeclarationCounts[0];
  if (variant.avgDeclaredTasks > 3 || (topTask && topTask.ratePerGame > 0.7)) {
    lines.push("任務宣告窗口太乾淨：可宣告就宣告，讓任務節奏比真人局更完整、更少漏失。");
  }
  const focusPoint = variant.preLossStrategicTop.find((row) => row.key === "play_action_card:card_focus_the_point");
  if (lines.length < 3 && focusPoint && focusPoint.rate > 0.5) {
    lines.push("即使在敗局前一輪，AI 仍高頻使用〈看準重點〉等穩定牌效，表示危機緩衝仍偏強。");
  }
  while (lines.length < 3) {
    lines.push("目前過穩訊號仍以 AI 決策與流程窗口為主，尚不像單純是資源上限本身造成。");
  }
  return lines.slice(0, 3);
}

function countCompletedTasks(snapshot: GameSnapshot) {
  return snapshot.tasks.filter((task) => task.completionCheckedByHost).length;
}

function totalSr(snapshot: GameSnapshot) {
  return snapshot.players.reduce((sum, player) => sum + player.currentSr, 0);
}

function totalSp(snapshot: GameSnapshot) {
  return snapshot.players.reduce((sum, player) => sum + player.currentSp, 0);
}

function isCurrentEventResolved(snapshot: GameSnapshot): boolean {
  if (!snapshot.currentEvent) return false;
  const sr = snapshot.currentEvent.contributions.reduce((sum, item) => sum + item.srCounted, 0);
  const sp = snapshot.currentEvent.contributions.reduce((sum, item) => sum + item.spCounted, 0);
  return sr >= snapshot.currentEvent.requirement.srRequired && sp >= snapshot.currentEvent.requirement.spRequired;
}

function chooseTaskDeclaration(snapshot: GameSnapshot): { task: TaskState; actorSeat: SeatId } | null {
  const eligibleDeclarers = snapshot.players.filter((player) => player.currentSr > 0 && player.currentSp > 0);
  const actorSeat = eligibleDeclarers[(Math.max(0, snapshot.round - 1)) % Math.max(1, eligibleDeclarers.length)]?.seatId ?? "P1";
  const aiPolicyId = snapshot.roomConfig.aiPolicyProfileId ?? "solver_baseline";
  const missRate = aiPolicyId === "task_noise_only" || aiPolicyId === "humanized_v1" ? 0.22 : 0;
  const verifiedTasks = snapshot.tasks
    .filter((task) => !task.completionCheckedByHost)
    .map((task) => ({ task, verification: verifyTaskDeclaration(snapshot, task) }))
    .filter((row) => row.verification.ok);

  if (verifiedTasks.length === 0) return null;
  if (missRate > 0 && Math.random() < missRate) return null;

  if (aiPolicyId === "task_noise_only" || aiPolicyId === "humanized_v1") {
    const preferred = verifiedTasks
      .map((row) => {
        let score = Math.random();
        if (row.task.taskId === "task_crisis_control") score += 4;
        if (row.task.taskId === "task_neighborhood_relay") score += 3;
        if (row.task.taskId === "task_support_network_formed") score += 2;
        if (row.task.taskId === "task_small_gathering_point") score += 1;
        return { ...row, score };
      })
      .sort((a, b) => b.score - a.score || a.task.taskId.localeCompare(b.task.taskId))[0];
    return preferred ? { task: preferred.task, actorSeat } : null;
  }

  return { task: verifiedTasks[0].task, actorSeat };
}

function inferFailureReason(snapshot: GameSnapshot): SimulationFailureReason {
  if (snapshot.pressure >= 10) return "pressure_overflow";
  if (snapshot.players.some((player) => player.currentSr <= 0)) return "sr_zero";
  if (snapshot.players.some((player) => player.currentSp <= 0)) return "sp_zero";
  if (snapshot.round >= 7 && countCompletedTasks(snapshot) < 2) return "task_shortfall";
  return "unknown";
}

function applyAction(snapshot: GameSnapshot, action: Parameters<typeof applyRoomActionReducer>[0]["action"], at: string) {
  return applyRoomActionReducer({ snapshot, action, at }).snapshot;
}

function tryApplyAction(snapshot: GameSnapshot, action: Parameters<typeof applyRoomActionReducer>[0]["action"], at: string) {
  try {
    return { snapshot: applyAction(snapshot, action, at), errorCode: null as string | null };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "UNKNOWN";
    return { snapshot, errorCode };
  }
}

function initializeFailureReasons(): Record<SimulationFailureReason, number> {
  return {
    pressure_overflow: 0,
    sr_zero: 0,
    sp_zero: 0,
    task_shortfall: 0,
    unknown: 0,
  };
}

function initializeEventDebugMap() {
  return new Map<string, { nameZh: string; seenCount: number; resolvedCount: number; unresolvedCount: number }>(
    MINIMAL_EVENTS.map((event) => [
      event.cardId,
      {
        nameZh: event.nameZh,
        seenCount: 0,
        resolvedCount: 0,
        unresolvedCount: 0,
      },
    ]),
  );
}

function runSingleSimulation(roomConfig: RoomConfig, seed: number, tuningAxesInput?: Partial<SimulationTuningAxes>, customAiPolicy?: CustomAiPolicyInput) {
  return withSeededRandom(seed, () => {
    const tuningAxes = normalizeTuningAxes(tuningAxesInput);
    const customPolicy = customAiPolicy ? buildCustomAiPolicy(customAiPolicy) : undefined;
    let snapshot = createInitialGameSnapshot({
      roomId: `sim-${Math.random().toString(36).slice(2, 8)}`,
      players: createSimulationPlayers(),
      roomConfig,
      at: new Date().toISOString(),
    });

    let steps = 0;
    let declaredTasks = 0;
    let resolvedEvents = 0;
    let eventCount = 0;
    let adjacentHelpCount = 0;
    let companionUseCount = 0;
    let multiContributorEvents = 0;
    const eventDebugMap = initializeEventDebugMap();
    let peakSrTotal = totalSr(snapshot);
    let peakSpTotal = totalSp(snapshot);
    const roundTotals: Array<{ round: number; srTotal: number; spTotal: number }> = [];
    const taskDeclarationCounts = new Map<string, number>();
    const preLossPresence = new Map<string, number>();
    const preLossStrategic = new Map<string, number>();
    let firstDangerRound: number | null = null;
    let firstPressure6Round: number | null = null;
    let firstAxisBrink: "SR" | "SP" | "both" | null = null;
    let hadResourceTensionMoment = false;
    let movedIntoRiskTotal = 0;
    let riskCampersTotal = 0;
    let completedRounds = 0;
    let pressure3EligibleRounds = 0;
    let pressure3MultiContributorRounds = 0;
    let pressure6EligibleRounds = 0;
    let pressure6DeclaredRounds = 0;
    const roundCadenceRows: SimulationRoundCadenceRow[] = [];
    let currentActions: string[] = [];
    let roundEventResolved: boolean | null = null;
    let movedIntoRiskThisRound = 0;
    let declaredTaskThisRound = false;
    let roundStartPressure = 0;

    while (steps < 500) {
      steps += 1;
      peakSrTotal = Math.max(peakSrTotal, totalSr(snapshot));
      peakSpTotal = Math.max(peakSpTotal, totalSp(snapshot));
      const currentBrinkSr = minSr(snapshot) <= 1;
      const currentBrinkSp = minSp(snapshot) <= 1;
      if (currentBrinkSr || currentBrinkSp) hadResourceTensionMoment = true;

      if (snapshot.phase === "gameover") {
        if (!snapshot.players.every((player) => player.currentSr > 0 && player.currentSp > 0) || snapshot.pressure >= 10) {
          const uniqueActions = new Set(currentActions);
          const strategicActions = [...uniqueActions].filter((key) => key !== "start_round" && key !== "end_turn" && key !== "fallback_end_turn" && key !== "resolve_campfire");
          for (const key of uniqueActions) preLossPresence.set(key, (preLossPresence.get(key) ?? 0) + 1);
          for (const key of strategicActions) preLossStrategic.set(key, (preLossStrategic.get(key) ?? 0) + 1);
        }
        return {
          won: false,
          failureReason: inferFailureReason(snapshot),
          completedTasks: countCompletedTasks(snapshot),
          declaredTasks,
          finalPressure: snapshot.pressure,
          resolvedEvents,
          eventCount,
          adjacentHelpCount,
          companionUseCount,
          multiContributorEvents,
          finalSrTotal: totalSr(snapshot),
          finalSpTotal: totalSp(snapshot),
          peakSrTotal,
          peakSpTotal,
          endedRound: snapshot.round,
          eventDebugMap,
          roundTotals,
          firstDangerRound,
          firstPressure6Round,
          firstAxisBrink,
          hadResourceTensionMoment,
          movedIntoRiskTotal,
          riskCampersTotal,
          completedRounds,
          pressure3EligibleRounds,
          pressure3MultiContributorRounds,
          pressure6EligibleRounds,
          pressure6DeclaredRounds,
          roundCadenceRows,
          taskDeclarationCounts,
          preLossPresence,
          preLossStrategic,
        };
      }

      if (snapshot.phase === "crisis") {
        if (snapshot.round >= 7) {
          const won = countCompletedTasks(snapshot) >= 2 && snapshot.players.every((player) => player.currentSr > 0 && player.currentSp > 0) && snapshot.pressure < 10;
          if (!won) {
            const uniqueActions = new Set(currentActions);
            const strategicActions = [...uniqueActions].filter((key) => key !== "start_round" && key !== "end_turn" && key !== "fallback_end_turn" && key !== "resolve_campfire");
            for (const key of uniqueActions) preLossPresence.set(key, (preLossPresence.get(key) ?? 0) + 1);
            for (const key of strategicActions) preLossStrategic.set(key, (preLossStrategic.get(key) ?? 0) + 1);
          }
          return {
            won,
            failureReason: won ? null : inferFailureReason(snapshot),
            completedTasks: countCompletedTasks(snapshot),
            declaredTasks,
            finalPressure: snapshot.pressure,
            resolvedEvents,
            eventCount,
            adjacentHelpCount,
            companionUseCount,
            multiContributorEvents,
            finalSrTotal: totalSr(snapshot),
            finalSpTotal: totalSp(snapshot),
            peakSrTotal,
            peakSpTotal,
            endedRound: snapshot.round,
            eventDebugMap,
            roundTotals,
            firstDangerRound,
            firstPressure6Round,
            firstAxisBrink,
          hadResourceTensionMoment,
            movedIntoRiskTotal,
            riskCampersTotal,
            completedRounds,
            pressure3EligibleRounds,
            pressure3MultiContributorRounds,
            pressure6EligibleRounds,
            pressure6DeclaredRounds,
            roundCadenceRows,
            taskDeclarationCounts,
            preLossPresence,
            preLossStrategic,
          };
        }
        roundStartPressure = snapshot.pressure;
        const beforeStartRound = structuredClone(snapshot);
        snapshot = applyAction(snapshot, { type: "start_round", actorSeat: "P1" }, new Date().toISOString());
        applyTuningAfterAction(beforeStartRound, snapshot, { type: "start_round", actorSeat: "P1" }, tuningAxes);
        currentActions = [];
        roundEventResolved = null;
        movedIntoRiskThisRound = 0;
        declaredTaskThisRound = false;
        continue;
      }

      if (snapshot.phase === "campfire" && !snapshot.blockingWindow) {
        const alreadyDeclaredTaskThisRound = snapshot.tasks.some((task) => task.declaredAtRound === snapshot.round && task.completionCheckedByHost);
        if (!alreadyDeclaredTaskThisRound) {
          const taskChoice = chooseTaskDeclaration(snapshot);
          if (taskChoice) {
            declaredTasks += 1;
            declaredTaskThisRound = true;
            taskDeclarationCounts.set(taskChoice.task.taskId, (taskDeclarationCounts.get(taskChoice.task.taskId) ?? 0) + 1);
            currentActions.push(`declare_task:${taskChoice.task.taskId}`);
            snapshot = applyAction(snapshot, { type: "declare_task", actorSeat: taskChoice.actorSeat, taskId: taskChoice.task.taskId }, new Date().toISOString());
            continue;
          }
        }

        const currentEvent = snapshot.currentEvent;
        roundEventResolved = isCurrentEventResolved(snapshot);
        eventCount += 1;
        if (roundEventResolved) resolvedEvents += 1;
        const contributorCount = new Set(currentEvent?.contributions.map((item) => item.seatId) ?? []).size;
        if (contributorCount >= 2) {
          multiContributorEvents += 1;
        }
        if (roundStartPressure >= 3) {
          pressure3EligibleRounds += 1;
          if (contributorCount >= 2) pressure3MultiContributorRounds += 1;
        }
        if (roundStartPressure >= 6) {
          pressure6EligibleRounds += 1;
          if (declaredTaskThisRound) pressure6DeclaredRounds += 1;
        }
        if (currentEvent) {
          const debug = eventDebugMap.get(currentEvent.cardId) ?? { nameZh: currentEvent.nameZh, seenCount: 0, resolvedCount: 0, unresolvedCount: 0 };
          debug.seenCount += 1;
          if (roundEventResolved) debug.resolvedCount += 1;
          else debug.unresolvedCount += 1;
          eventDebugMap.set(currentEvent.cardId, debug);
        }
        applyTuningBeforeAction(snapshot, { type: "resolve_campfire" }, tuningAxes);
        const beforeResolveCampfire = structuredClone(snapshot);
        snapshot = applyAction(snapshot, { type: "resolve_campfire", actorSeat: "P1" }, new Date().toISOString());
        applyTuningAfterAction(beforeResolveCampfire, snapshot, { type: "resolve_campfire", actorSeat: "P1" }, tuningAxes);

        if (snapshot.phase === "crisis" || snapshot.phase === "gameover") {
          completedRounds += 1;
          const srMin = minSr(snapshot);
          const spMin = minSp(snapshot);
          const brinkSr = srMin <= 1;
          const brinkSp = spMin <= 1;
          if (firstDangerRound == null && (brinkSr || brinkSp || snapshot.pressure >= 6)) firstDangerRound = snapshot.round;
          if (firstPressure6Round == null && snapshot.pressure >= 6) firstPressure6Round = snapshot.round;
          if (firstAxisBrink == null && (brinkSr || brinkSp)) firstAxisBrink = brinkSr && brinkSp ? "both" : brinkSr ? "SR" : "SP";
          movedIntoRiskTotal += movedIntoRiskThisRound;
          riskCampersTotal += riskCampers(snapshot);
          roundTotals.push({ round: completedRounds, srTotal: totalSr(snapshot), spTotal: totalSp(snapshot) });
          roundCadenceRows.push({
            round: completedRounds,
            survivalRate: 1,
            avgResolvedEventsByEnd: resolvedEvents,
            avgEventCountByEnd: eventCount,
            avgResolvedRateByEnd: eventCount > 0 ? resolvedEvents / eventCount : 0,
            avgResolvedThisRound: roundEventResolved ? 1 : 0,
            avgEventResolvedRateThisRound: roundEventResolved ? 1 : 0,
            avgSrTotalAtEnd: totalSr(snapshot),
            avgSpTotalAtEnd: totalSp(snapshot),
          });
        }
        continue;
      }

      const action = chooseAiStep(snapshot, customPolicy);
      if (!action) {
        return {
          won: false,
          failureReason: "unknown" as const,
          completedTasks: countCompletedTasks(snapshot),
          declaredTasks,
          finalPressure: snapshot.pressure,
          resolvedEvents,
          eventCount,
          adjacentHelpCount,
          companionUseCount,
          multiContributorEvents,
          finalSrTotal: totalSr(snapshot),
          finalSpTotal: totalSp(snapshot),
          peakSrTotal,
          peakSpTotal,
          endedRound: snapshot.round,
          eventDebugMap,
          roundTotals,
          firstDangerRound,
          firstPressure6Round,
          firstAxisBrink,
          hadResourceTensionMoment,
          movedIntoRiskTotal,
          riskCampersTotal,
          completedRounds,
          pressure3EligibleRounds,
          pressure3MultiContributorRounds,
          pressure6EligibleRounds,
          pressure6DeclaredRounds,
          roundCadenceRows,
          taskDeclarationCounts,
          preLossPresence,
          preLossStrategic,
        };
      }

      currentActions.push(normalizeActionLabel(action));
      if (action.type === "move") {
        const destination = getTileById(snapshot.mapTiles, action.toTileId);
        if (destination?.kind === "risk") movedIntoRiskThisRound += 1;
      }
      if (action.type === "adjacent_help") adjacentHelpCount += 1;
      if (action.type === "use_companion_token") companionUseCount += 1;
      const attempted = tryApplyAction(snapshot, action, new Date().toISOString());
      if (attempted.errorCode) {
        if (snapshot.phase === "action" && snapshot.activeSeat && action.type !== "end_turn" && "actorSeat" in action && action.actorSeat === snapshot.activeSeat) {
          currentActions.push("fallback_end_turn");
          const fallback = tryApplyAction(snapshot, { type: "end_turn", actorSeat: snapshot.activeSeat }, new Date().toISOString());
          if (fallback.errorCode) {
            return {
              won: false,
              failureReason: "unknown" as const,
              completedTasks: countCompletedTasks(snapshot),
              declaredTasks,
              finalPressure: snapshot.pressure,
              resolvedEvents,
              eventCount,
              adjacentHelpCount,
              companionUseCount,
              multiContributorEvents,
              finalSrTotal: totalSr(snapshot),
              finalSpTotal: totalSp(snapshot),
              peakSrTotal,
              peakSpTotal,
              endedRound: snapshot.round,
              eventDebugMap,
              roundTotals,
              firstDangerRound,
              firstPressure6Round,
              firstAxisBrink,
          hadResourceTensionMoment,
              movedIntoRiskTotal,
              riskCampersTotal,
              completedRounds,
              taskDeclarationCounts,
              preLossPresence,
              preLossStrategic,
            };
          }
          snapshot = fallback.snapshot;
        } else {
          return {
            won: false,
            failureReason: "unknown" as const,
            completedTasks: countCompletedTasks(snapshot),
            declaredTasks,
            finalPressure: snapshot.pressure,
            resolvedEvents,
            eventCount,
            adjacentHelpCount,
            companionUseCount,
            multiContributorEvents,
            finalSrTotal: totalSr(snapshot),
            finalSpTotal: totalSp(snapshot),
            peakSrTotal,
            peakSpTotal,
            endedRound: snapshot.round,
            eventDebugMap,
            roundTotals,
            firstDangerRound,
            firstPressure6Round,
            firstAxisBrink,
          hadResourceTensionMoment,
            movedIntoRiskTotal,
            riskCampersTotal,
            completedRounds,
            pressure3EligibleRounds,
            pressure3MultiContributorRounds,
            pressure6EligibleRounds,
            pressure6DeclaredRounds,
            roundCadenceRows,
            taskDeclarationCounts,
            preLossPresence,
            preLossStrategic,
          };
        }
      } else {
        applyTuningAfterAction(snapshot, attempted.snapshot, action as unknown as { type: string; [key: string]: unknown }, tuningAxes);
        snapshot = attempted.snapshot;
      }
    }

    return {
      won: false,
      failureReason: "unknown" as const,
      completedTasks: countCompletedTasks(snapshot),
      declaredTasks,
      finalPressure: snapshot.pressure,
      resolvedEvents,
      eventCount,
      adjacentHelpCount,
      companionUseCount,
      multiContributorEvents,
      finalSrTotal: totalSr(snapshot),
      finalSpTotal: totalSp(snapshot),
      peakSrTotal,
      peakSpTotal,
      endedRound: snapshot.round,
      eventDebugMap,
      roundTotals,
      firstDangerRound,
      firstPressure6Round,
      firstAxisBrink,
          hadResourceTensionMoment,
      movedIntoRiskTotal,
      riskCampersTotal,
      completedRounds,
      taskDeclarationCounts,
      preLossPresence,
      preLossStrategic,
    };
  });
}

export function runSimulationVariant(variant: SimulationVariantInput): SimulationVariantAggregate {
  const roomConfig = mergeRoomConfig(DEFAULT_ROOM_CONFIG, variant.roomConfigPatch);
  const baseSeed = Number.isFinite(variant.seed) ? Math.floor(variant.seed as number) : 20260401;
  const failureReasons = initializeFailureReasons();
  const roundAccumulator = new Map<number, { srTotal: number; spTotal: number; count: number }>();

  let winCount = 0;
  let completedTasks = 0;
  let declaredTasks = 0;
  let finalPressure = 0;
  let resolvedEventRate = 0;
  let resolvedEventsTotal = 0;
  let eventCountTotal = 0;
  let adjacentHelpCount = 0;
  let companionUseCount = 0;
  let multiContributorEvents = 0;
  let finalSrTotal = 0;
  let finalSpTotal = 0;
  let peakSrTotal = 0;
  let peakSpTotal = 0;
  let failedGameCount = 0;
  let failureRoundTotal = 0;
  const failureRoundHistogram = new Map<number, number>();
  const firstDangerRoundHistogram = new Map<number, number>();
  const firstPressure6RoundHistogram = new Map<number, number>();
  const firstAxisBrinkCounts = new Map<string, number>();
  const taskDeclarationAccumulator = new Map<string, number>();
  const preLossPresenceAccumulator = new Map<string, number>();
  const preLossStrategicAccumulator = new Map<string, number>();
  const eventDebugAccumulator = initializeEventDebugMap();
  const firstDangerRounds: Array<number | null> = [];
  const firstPressure6Rounds: Array<number | null> = [];
  let winResourceTensionCount = 0;
  let movedIntoRiskTotal = 0;
  let riskCampersTotal = 0;
  let completedRoundsTotal = 0;
  let pressure3EligibleRoundsTotal = 0;
  let pressure3MultiContributorRoundsTotal = 0;
  let pressure6EligibleRoundsTotal = 0;
  let pressure6DeclaredRoundsTotal = 0;
  const roundCadenceAccumulator = new Map<number, { survivalCount: number; resolvedByEndSum: number; eventByEndSum: number; resolvedThisRoundSum: number; eventResolvedRateThisRoundSum: number; srEndSum: number; spEndSum: number }>();

  for (let i = 0; i < variant.runCount; i += 1) {
    const game = runSingleSimulation(roomConfig, baseSeed + i, variant.tuningAxes, variant.customAiPolicy);
    if (game.won) winCount += 1;
    if (game.failureReason) {
      failureReasons[game.failureReason] += 1;
      failedGameCount += 1;
      failureRoundTotal += game.endedRound;
      failureRoundHistogram.set(game.endedRound, (failureRoundHistogram.get(game.endedRound) ?? 0) + 1);
    }
    completedTasks += game.completedTasks;
    declaredTasks += game.declaredTasks;
    finalPressure += game.finalPressure;
    resolvedEventRate += game.eventCount > 0 ? game.resolvedEvents / game.eventCount : 0;
    resolvedEventsTotal += game.resolvedEvents;
    eventCountTotal += game.eventCount;
    adjacentHelpCount += game.adjacentHelpCount;
    companionUseCount += game.companionUseCount;
    multiContributorEvents += game.multiContributorEvents;
    finalSrTotal += game.finalSrTotal;
    finalSpTotal += game.finalSpTotal;
    peakSrTotal += game.peakSrTotal;
    peakSpTotal += game.peakSpTotal;
    firstDangerRounds.push(game.firstDangerRound);
    firstPressure6Rounds.push(game.firstPressure6Round);
    if (game.firstDangerRound != null) firstDangerRoundHistogram.set(game.firstDangerRound, (firstDangerRoundHistogram.get(game.firstDangerRound) ?? 0) + 1);
    if (game.firstPressure6Round != null) firstPressure6RoundHistogram.set(game.firstPressure6Round, (firstPressure6RoundHistogram.get(game.firstPressure6Round) ?? 0) + 1);
    if (game.firstAxisBrink) firstAxisBrinkCounts.set(game.firstAxisBrink, (firstAxisBrinkCounts.get(game.firstAxisBrink) ?? 0) + 1);
    if (game.won && game.hadResourceTensionMoment) winResourceTensionCount += 1;
    movedIntoRiskTotal += game.movedIntoRiskTotal;
    riskCampersTotal += game.riskCampersTotal;
    completedRoundsTotal += game.completedRounds;
    pressure3EligibleRoundsTotal += game.pressure3EligibleRounds ?? 0;
    pressure3MultiContributorRoundsTotal += game.pressure3MultiContributorRounds ?? 0;
    pressure6EligibleRoundsTotal += game.pressure6EligibleRounds ?? 0;
    pressure6DeclaredRoundsTotal += game.pressure6DeclaredRounds ?? 0;

    const cadenceByRound = new Map((game.roundCadenceRows ?? []).map((row) => [row.round, row]));
    let carryResolvedByEnd = 0;
    let carryEventByEnd = 0;
    let carrySrEnd = game.finalSrTotal;
    let carrySpEnd = game.finalSpTotal;
    for (let round = 1; round <= 7; round += 1) {
      const cadence = cadenceByRound.get(round);
      if (cadence) {
        carryResolvedByEnd = cadence.avgResolvedEventsByEnd;
        carryEventByEnd = cadence.avgEventCountByEnd;
        carrySrEnd = cadence.avgSrTotalAtEnd;
        carrySpEnd = cadence.avgSpTotalAtEnd;
      }
      const current = roundCadenceAccumulator.get(round) ?? { survivalCount: 0, resolvedByEndSum: 0, eventByEndSum: 0, resolvedThisRoundSum: 0, eventResolvedRateThisRoundSum: 0, srEndSum: 0, spEndSum: 0 };
      if (round <= game.completedRounds) {
        current.survivalCount += 1;
      }
      if (cadence) {
        current.resolvedThisRoundSum += cadence.avgResolvedThisRound;
        current.eventResolvedRateThisRoundSum += cadence.avgEventResolvedRateThisRound;
      }
      current.resolvedByEndSum += carryResolvedByEnd;
      current.eventByEndSum += carryEventByEnd;
      current.srEndSum += carrySrEnd;
      current.spEndSum += carrySpEnd;
      roundCadenceAccumulator.set(round, current);
    }

    for (const [taskId, count] of game.taskDeclarationCounts.entries()) {
      taskDeclarationAccumulator.set(taskId, (taskDeclarationAccumulator.get(taskId) ?? 0) + count);
    }

    for (const [key, count] of game.preLossPresence.entries()) {
      preLossPresenceAccumulator.set(key, (preLossPresenceAccumulator.get(key) ?? 0) + count);
    }

    for (const [key, count] of game.preLossStrategic.entries()) {
      preLossStrategicAccumulator.set(key, (preLossStrategicAccumulator.get(key) ?? 0) + count);
    }

    for (const [cardId, eventStats] of game.eventDebugMap.entries()) {
      const current = eventDebugAccumulator.get(cardId) ?? { nameZh: eventStats.nameZh, seenCount: 0, resolvedCount: 0, unresolvedCount: 0 };
      current.seenCount += eventStats.seenCount;
      current.resolvedCount += eventStats.resolvedCount;
      current.unresolvedCount += eventStats.unresolvedCount;
      eventDebugAccumulator.set(cardId, current);
    }

    for (const round of game.roundTotals) {
      const current = roundAccumulator.get(round.round) ?? { srTotal: 0, spTotal: 0, count: 0 };
      current.srTotal += round.srTotal;
      current.spTotal += round.spTotal;
      current.count += 1;
      roundAccumulator.set(round.round, current);
    }
  }

  const lossCount = failedGameCount;
  const earlyLossCount = Array.from(failureRoundHistogram.entries()).reduce((sum, [round, count]) => sum + (round <= 3 ? count : 0), 0);
  const lateLossR57Count = Array.from(failureRoundHistogram.entries()).reduce((sum, [round, count]) => sum + (round >= 5 && round <= 7 ? count : 0), 0);
  const lateLossR67Count = Array.from(failureRoundHistogram.entries()).reduce((sum, [round, count]) => sum + (round >= 6 && round <= 7 ? count : 0), 0);
  const earlyLossRate = lossCount > 0 ? earlyLossCount / lossCount : null;
  const lateLossR57Rate = lossCount > 0 ? lateLossR57Count / lossCount : null;
  const lateLossR67Rate = lossCount > 0 ? lateLossR67Count / lossCount : null;
  const winResourceTensionRate = winCount > 0 ? winResourceTensionCount / winCount : null;

  const aggregate: SimulationVariantAggregate = {
    variantId: variant.variantId,
    labelZh: variant.customAiPolicy ? describeCustomAiPolicy(variant.customAiPolicy) : variant.labelZh,
    runCount: variant.runCount,
    seed: baseSeed,
    winCount,
    lossCount,
    winRate: winCount / variant.runCount,
    avgCompletedTasks: completedTasks / variant.runCount,
    avgDeclaredTasks: declaredTasks / variant.runCount,
    avgFinalPressure: finalPressure / variant.runCount,
    avgResolvedEventRate: resolvedEventRate / variant.runCount,
    avgResolvedEventCount: resolvedEventsTotal / variant.runCount,
    avgEventCount: eventCountTotal / variant.runCount,
    avgSurvivalRounds: completedRoundsTotal / variant.runCount,
    avgResolvedEventsPerSurvivalRound: completedRoundsTotal > 0 ? resolvedEventsTotal / completedRoundsTotal : 0,
    avgAdjacentHelpCount: adjacentHelpCount / variant.runCount,
    avgCompanionUseCount: companionUseCount / variant.runCount,
    avgMultiContributorEvents: multiContributorEvents / variant.runCount,
    avgPressure3MultiContributorRate: pressure3EligibleRoundsTotal > 0 ? pressure3MultiContributorRoundsTotal / pressure3EligibleRoundsTotal : 0,
    avgPressure6DeclareRate: pressure6EligibleRoundsTotal > 0 ? pressure6DeclaredRoundsTotal / pressure6EligibleRoundsTotal : 0,
    avgFinalSrTotal: finalSrTotal / variant.runCount,
    avgFinalSpTotal: finalSpTotal / variant.runCount,
    avgPeakSrTotal: peakSrTotal / variant.runCount,
    avgPeakSpTotal: peakSpTotal / variant.runCount,
    avgFailureRound: failedGameCount > 0 ? failureRoundTotal / failedGameCount : null,
    avgFirstDangerRound: averageNullable(firstDangerRounds),
    avgFirstPressure6Round: averageNullable(firstPressure6Rounds),
    earlyLossRate,
    lateLossR57Rate,
    lateLossR67Rate,
    winResourceTensionRate,
    playtestFitScore: 0,
    avgMovedIntoRiskPerRound: completedRoundsTotal > 0 ? movedIntoRiskTotal / completedRoundsTotal : 0,
    avgRiskCampersPerRound: completedRoundsTotal > 0 ? riskCampersTotal / completedRoundsTotal : 0,
    failureReasons,
    failureRoundHistogram: toSortedHistogram(failureRoundHistogram),
    firstDangerRoundHistogram: toSortedHistogram(firstDangerRoundHistogram),
    firstPressure6RoundHistogram: toSortedHistogram(firstPressure6RoundHistogram),
    firstAxisBrinkCounts: (["SR", "SP", "both"] as const).map((axis) => ({ axis, count: firstAxisBrinkCounts.get(axis) ?? 0 })),
    taskDeclarationCounts: Array.from(taskDeclarationAccumulator.entries()).map(([taskId, count]) => ({ taskId, nameZh: TASK_NAME_MAP[taskId] ?? taskId, count, ratePerGame: count / variant.runCount })).sort((a, b) => b.count - a.count || a.taskId.localeCompare(b.taskId)),
    preLossActionPresenceTop: sortCountMap(preLossPresenceAccumulator, failedGameCount).slice(0, 15),
    preLossStrategicTop: sortCountMap(preLossStrategicAccumulator, failedGameCount).slice(0, 15),
    topLikelyOverstableCausesZh: [],
    eventDebug: Array.from(eventDebugAccumulator.entries())
      .map(([cardId, stats]) => ({
        cardId,
        nameZh: stats.nameZh,
        seenCount: stats.seenCount,
        resolvedCount: stats.resolvedCount,
        unresolvedCount: stats.unresolvedCount,
        resolvedRate: stats.seenCount > 0 ? stats.resolvedCount / stats.seenCount : 0,
      }))
      .sort((a, b) => a.cardId.localeCompare(b.cardId)),
    avgRoundResourceTotals: Array.from(roundAccumulator.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, totals]) => ({
        round,
        avgSrTotal: totals.srTotal / totals.count,
        avgSpTotal: totals.spTotal / totals.count,
      })),
    roundCadenceRows: Array.from(roundCadenceAccumulator.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, totals]) => ({
        round,
        survivalRate: totals.survivalCount / variant.runCount,
        avgResolvedEventsByEnd: totals.resolvedByEndSum / variant.runCount,
        avgEventCountByEnd: totals.eventByEndSum / variant.runCount,
        avgResolvedRateByEnd: totals.eventByEndSum > 0 ? totals.resolvedByEndSum / totals.eventByEndSum : 0,
        avgResolvedThisRound: totals.resolvedThisRoundSum / variant.runCount,
        avgEventResolvedRateThisRound: totals.survivalCount > 0 ? totals.eventResolvedRateThisRoundSum / totals.survivalCount : 0,
        avgSrTotalAtEnd: totals.srEndSum / variant.runCount,
        avgSpTotalAtEnd: totals.spEndSum / variant.runCount,
      })),
  };

  aggregate.topLikelyOverstableCausesZh = buildTopLikelyOverstableCausesZh(aggregate);
  aggregate.playtestFitScore = scoreVariantAgainstPlaytestTargets(aggregate);
  return aggregate;
}

function getBaselineVariantIndex(aggregates: SimulationVariantAggregate[], presetId: string) {
  if (["tuning_axes_v1", "tuning_axes_v2", "tuning_axes_v3", "tuning_axes_v4"].includes(presetId)) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    aggregates.forEach((variant, index) => {
      const score = scoreVariantAgainstPythonBenchmark(variant);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }
  if (["tuning_axes_v5", "tuning_axes_v6", "tuning_axes_v7"].includes(presetId)) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    aggregates.forEach((variant, index) => {
      const score = scoreVariantAgainstPlaytestTargetsWithPythonTiebreak(variant);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }
  if (presetId === "gap_root_cause_alignment") {
    const canonicalIndex = aggregates.findIndex((variant) => variant.variantId === "canonical_gap_root_v2f_baseline");
    if (canonicalIndex >= 0) return canonicalIndex;
  }
  if (presetId === "canonical_v2b_refinement") {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    aggregates.forEach((variant, index) => {
      const score = scoreVariantAgainstPythonBenchmark(variant);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }
  if (presetId === "canonical_v2c_refinement") {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    aggregates.forEach((variant, index) => {
      const score = scoreVariantAgainstPythonBenchmark(variant);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }
  if (presetId === "canonical_v2d_refinement") {
    const mainlineIndex = aggregates.findIndex((variant) => variant.variantId === "canonical_v2d_mainline");
    if (mainlineIndex >= 0) return mainlineIndex;
  }
  if (presetId === "canonical_v2e_refinement") {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    aggregates.forEach((variant, index) => {
      const score = scoreVariantAgainstPythonBenchmark(variant);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }
  if (presetId === "canonical_v2f_refinement") {
    const mainlineIndex = aggregates.findIndex((variant) => variant.variantId === "canonical_v2f_mainline");
    if (mainlineIndex >= 0) return mainlineIndex;
  }
  if (presetId === "canonical_v2_refinement") {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    aggregates.forEach((variant, index) => {
      const score = scoreVariantAgainstPythonBenchmark(variant);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }
  if (presetId === "ai_policy_alignment") {
    const canonicalIndex = aggregates.findIndex((variant) => variant.variantId === "canonical_humanized_policy");
    if (canonicalIndex >= 0) return canonicalIndex;
  }
  if (presetId === "event_resolution_alignment") {
    const canonicalIndex = aggregates.findIndex((variant) => variant.variantId === "canonical_event_baseline");
    if (canonicalIndex >= 0) return canonicalIndex;
  }
  if (presetId === "survival_cadence_alignment") {
    const canonicalIndex = aggregates.findIndex((variant) => variant.variantId === "canonical_survival_baseline");
    if (canonicalIndex >= 0) return canonicalIndex;
  }
  if (presetId === "custom_ai_builder") {
    const customIndex = aggregates.findIndex((variant) => variant.variantId === "custom_ai_candidate");
    if (customIndex >= 0) return customIndex;
  }
  return 0;
}

function buildSummaryZh(aggregates: SimulationVariantAggregate[], presetId: string, baselineIndex: number) {
  if (aggregates.length < 2) return ["目前只有單一版本，先補第二個比較版本才看得出差異。"];

  const baseline = aggregates[baselineIndex] ?? aggregates[0];
  const challenger = aggregates.find((_, index) => index !== baselineIndex) ?? aggregates[0];
  const winRateDelta = challenger.winRate - baseline.winRate;
  const adjacentHelpDelta = challenger.avgAdjacentHelpCount - baseline.avgAdjacentHelpCount;
  const peakSrDelta = challenger.avgPeakSrTotal - baseline.avgPeakSrTotal;
  const peakSpDelta = challenger.avgPeakSpTotal - baseline.avgPeakSpTotal;
  const lines: string[] = [];

  if (presetId === "cap_mode_baseline") {
    if (winRateDelta > 0.05 && adjacentHelpDelta <= 0) {
      lines.push(`與基線相比，${challenger.labelZh} 的勝率提升 ${formatSignedPercent(winRateDelta)}，但相鄰互助沒有同步上升，這比較像資源雪球而不是協作改善。`);
    } else if (Math.abs(winRateDelta) <= 0.05) {
      lines.push(`無上限與有上限的勝率差距目前不算大（${formatSignedPercent(winRateDelta)}），下一步要優先看資源峰值與合作指標，而不是只看輸贏。`);
    } else {
      lines.push(`與基線相比，${challenger.labelZh} 的勝率變化為 ${formatSignedPercent(winRateDelta)}，需要再對照壓力、互助與資源峰值一起看。`);
    }

    if (peakSrDelta > 1 || peakSpDelta > 1) {
      lines.push(`資源峰值差異明顯：SR ${formatSignedNumber(peakSrDelta)} / SP ${formatSignedNumber(peakSpDelta)}。這表示中後期囤資源的可能性值得優先追。`);
    } else {
      lines.push(`SR / SP 峰值差距目前不算大，無上限不一定已經失控，但還要看 200 或 500 局時是否持續放大。`);
    }
  } else if (presetId === "action_profile_response") {
    lines.push(`這組比較主要看行動牌池是否改變事件解決節奏。若勝率變高但壓力沒有同步下降，代表牌池可能只是在補穩定度，未必真的改善危機處理。`);
    lines.push(`請優先對照 avgResolvedEventRate、avgMultiContributorEvents 與 avgAdjacentHelpCount，看新增牌是否在幫助合作，而不是只增加牌效補血。`);
  } else if (presetId === "pool_profile_compact") {
    lines.push(`這組比較主要看牌池密度與輪替。若精簡池讓勝率上升，但壓力與互助需求下降，代表事件／任務多樣性可能不夠。`);
    lines.push(`若精簡池的平均峰值資源更高，也代表重複抽到較好處理的事件／任務，可能讓局勢過度穩定。`);
  } else if (presetId === "tuning_axes_v1") {
    lines.push(`這組比較固定 Canonical v2f AI 主線，只掃描事件層、survival economy、support 卡效與風險懲罰的全域參數軸，快速判斷哪一類規則最敏感。`);
    lines.push(`請優先對照 avgSurvivalRounds、avgResolvedEventsPerSurvivalRound、avgResolvedEventCount、avgCompanionUseCount、avgFinalSpTotal 與 avgPressure6DeclareRate。若某條軸一動就讓 avgSurvivalRounds 明顯收斂，而 throughput 變動有限，代表主因更像 survival economy；若 throughput 先掉，才更支持事件層本身偏寬。`);
  } else if (presetId === "tuning_axes_v2") {
    lines.push(`這組比較把 v1 的粗軸拆成事件 SR/SP、庇護所/物資站、陪伴防損三組子軸，並加入兩個最有價值的組合軸。目的不是直接定案，而是更快定位哪一條子軸最接近 Python benchmark。`);
    lines.push(`請優先對照 avgResolvedEventCount、avgResolvedEventsPerSurvivalRound、avgSurvivalRounds、avgFinalSrTotal、avgFinalSpTotal 與 avgCompanionUseCount。若事件需求 SP 或 SR 的單軸優於 shelter / station / companion，代表事件層不能再只放在次要位置。`);
  } else if (presetId === "tuning_axes_v3") {
    lines.push(`這組比較把事件需求 SP 側當主嫌，去跟 survival economy 做交叉驗證，看它是單獨成立，還是必須和 companion / recovery 一起收才有效。`);
    lines.push(`請優先對照 avgResolvedEventCount、avgResolvedEventsPerSurvivalRound、avgSurvivalRounds，以及 SP +1 單軸相對於 shelter / station / companion 的排序。若 SP +1 持續排前，代表事件 SP 壓力開始比 survival economy 更可疑。`);
  } else if (presetId === "tuning_axes_v4") {
    lines.push(`這組比較以事件 SP 需求側為核心懷疑點，驗證它到底是單獨就夠，還是必須與未解 SP 懲罰或 survival economy 一起收才最接近 Python。`);
    lines.push(`請優先對照「事件需求 SP +1」、「事件未解懲罰 SP +1」與「事件需求 SP +1＋事件未解懲罰 SP +1」三條線的排序。若組合線穩定排第一，代表事件卡在 SP 側的需求與未解懲罰都偏寬。`);
  } else if (presetId === "tuning_axes_v5") {
    lines.push(`這組比較直接裁定事件 SP 壓力結構。主評分已改成首玩體驗 fit score：先看勝率是否落在 40%–45%，再看早崩比例、敗局是否後移，以及勝局是否常出現 SR / SP ≤ 1 的緊張時刻。`);
    lines.push(`請優先比較「事件需求 SP +1」、「事件未解懲罰 SP +1」、「事件需求 SP +1＋事件未解懲罰 SP +1」與「事件需求 SP +1＋事件立即懲罰 SP +1」。若 A3 穩定最好、A4 明顯早崩，代表主嫌更像需求＋未解，而不是立即懲罰。`);
  } else if (presetId === "tuning_axes_v6") {
    lines.push(`這組比較先固定 A2「事件未解懲罰 SP +1」，再往 survival cadence 掃第二刀。主評分仍以首玩體驗 fit score 為主，目的是分辨事件未解 SP 壓力收起來之後，剩餘 gap 更像陪伴、互助、風險暴露，還是站點回復節奏。`);
    lines.push(`請優先比較「A2＋陪伴更嚴」、「A2＋相鄰互助更保守」、「A2＋風險暴露提高」、「A2＋庇護所 -1」、「A2＋物資站 -1」與「A2＋陪伴更嚴＋物資站 -1」。若單一 survival 軸只能降勝率、卻無法把敗局後移，代表它更像硬打；若能同時壓低早崩並提升 R5–R7 / R6–R7 佔比，才更像合理首玩修正。`);
  } else if (presetId === "tuning_axes_v7") {
    lines.push(`這組比較把 AI 基底拉回較寬的 Canonical Humanized，再重新驗 A2 是否足以把勝率壓進 40%–45% 首玩帶。主評分仍以首玩體驗 fit score 為主，目的是分辨前一輪過硬到底是因為 v2f AI 太緊，還是 A2 本身就不適合保留。`);
    lines.push(`請優先比較「Canonical Humanized＋A2」相對「Canonical Humanized 主線」的變化，再看 risk / help / station / companion 哪一條第二刀最能把敗局後移到 R5–R7，同時保住 40%–45% 勝率。若 A2 單刀就能落進帶內，後面就不必再加太多第二刀。`);
  } else if (presetId === "gap_root_cause_alignment") {
    lines.push(`這組比較不是再找更多可能因素，而是直接用「${baseline.labelZh}」當 web v2f 候選主線，把 survival cadence 與 event throughput 放在同一張 compare 裡，看剩餘差距主因更像活得更久，還是每存活回合更會解。`);
    lines.push(`請優先對照 avgSurvivalRounds、avgResolvedEventsPerSurvivalRound、R5 / R6 的累積解決事件、avgPressure3MultiContributorRate 與敗局型態。若總解決事件數下降但每存活回合解事件能力接近不變，代表主因仍偏 survival cadence。`);
  } else if (presetId === "canonical_v2b_refinement") {
    lines.push(`這組比較以「v2 先收陪伴」為底，往前補較輕的互助與較輕的風險收法，目標是找到比 companion-only 更接近 Python、但不會像 full v2 收過頭的中間點。`);
    lines.push(`請優先對照 avgCompanionUseCount、avgAdjacentHelpCount、avgMovedIntoRiskPerRound、avgSurvivalRounds、avgResolvedEventsPerSurvivalRound 與 R5 / R6 的累積解決事件。若差距縮小主要來自 avgSurvivalRounds 收斂，而 throughput 幾乎不動，代表 v2b 方向正確。`);
  } else if (presetId === "canonical_v2c_refinement") {
    lines.push(`這組比較延續 v2b，但第二刀改押 tighter recovery，而不是再收互助或硬推風險暴露。目標是找出一條比 v2b 更穩定、也更容易重現的 survival 收法。`);
    lines.push(`請優先對照 avgCompanionUseCount、avgAdjacentHelpCount、avgSurvivalRounds、avgResolvedEventsPerSurvivalRound、avgPressure6DeclareRate 與 R5 / R6 的累積解決事件。若 gap 縮小主要來自 avgSurvivalRounds 與 pressure6 declare 收斂，而 throughput 沒有一起崩掉，代表 v2c 更值得扶正。`);
  } else if (presetId === "canonical_v2d_refinement") {
    lines.push(`這組比較只在 v2c 之內做更小的 survival 微調：不再擴到 throughput，也不再大幅壓互助或風險。重點是分開看偏 SP 的保守回復、偏 SR 的保守回復，以及更保守的 companion，哪一條最貼近 Python，並可正式升格成 v2d 主線。`);
    lines.push(`請優先對照 avgCompanionUseCount、avgSurvivalRounds、avgResolvedEventsPerSurvivalRound、avgPressure6DeclareRate、R5 / R6 的累積解決事件與 avgAdjacentHelpCount。若 gap 縮小主要來自 avgSurvivalRounds 與 pressure6 declare，而 help 仍貼近 Python，代表 v2d 可取代 v2c；若只剩 pressure3 多人投入仍偏高，下一刀才輪到 contribution / help 線。`);
  } else if (presetId === "canonical_v2e_refinement") {
    lines.push(`這組比較延續 v2d，只在 survival cadence 內再收一小階：先測雙站點更保守，再測更保守 companion，目標是找出比 v2d 更接近 Python、但不會把 throughput 一起砍壞的 v2e 主線。`);
    lines.push(`請優先對照 avgCompanionUseCount、avgSurvivalRounds、avgResolvedEventsPerSurvivalRound、avgPressure6DeclareRate、R5 / R6 的累積解決事件與 avgAdjacentHelpCount。若 gap 縮小主要來自 avgSurvivalRounds 下降、throughput 變化小，代表 v2e 方向正確；若 help 與任務一起掉太多，代表 survival 收過頭。`);
  } else if (presetId === "canonical_v2f_refinement") {
    lines.push(`這組比較沿著 v2e 繼續只做最後一輪 survival cadence 細修：不再動 help 或 risk，而是分開看「SP / shelter recovery 再細收」與「在同一收法上 companion 再細收」，確認是否仍有比 v2e 更接近 Python 的窄改善空間。`);
    lines.push(`請優先對照 avgCompanionUseCount、avgSurvivalRounds、avgResolvedEventsPerSurvivalRound、avgPressure6DeclareRate、R5 / R6 的累積解決事件與 avgFinalSpTotal。若 gap 縮小主要來自 avgSurvivalRounds 與最終 SP 收斂，而 throughput 幾乎不變，代表 v2f 還有空間；若只剩微幅變動甚至來回打平，代表 survival 線已接近該停的點。`);
  } else if (presetId === "canonical_v2_refinement") {
    lines.push(`這組比較直接往 Canonical v2 開刀：先收 companion，再收互助門檻，最後再加上風險暴露。系統會先把這組裡最接近 Python 的版本放在第一個，再看它能不能把 avgSurvivalRounds 拉近 Python，同時保住 avgResolvedEventsPerSurvivalRound。`);
    lines.push(`請優先對照 avgCompanionUseCount、avgAdjacentHelpCount、avgMovedIntoRiskPerRound、avgSurvivalRounds、avgResolvedEventsPerSurvivalRound 與 R5 / R6 的累積解決事件。若總解決事件下降主要來自存活回合縮短，而 throughput 幾乎不動，代表 v2 收法方向正確。`);
  } else if (presetId === "ai_policy_alignment") {
    lines.push(`這組比較現在以「${baseline.labelZh}」作為正式候選主線，不再把 Solver 當成預設主口徑。先看它和 Solver 的勝率、相鄰互助、進風險頻率差多少，再決定 web simulation 後續要不要正式換線。`);
    lines.push(`請優先對照 avgSurvivalRounds、avgResolvedEventsPerSurvivalRound、avgAdjacentHelpCount、avgMovedIntoRiskPerRound 與 avgDeclaredTasks，看差異究竟比較像活得更久，還是每回合更會解。`);
  } else if (presetId === "event_resolution_alignment") {
    lines.push(`這組比較專門追「平均解決事件數」為什麼仍高於 Python。基線固定是「${baseline.labelZh}」，先看停用〈看準重點〉與提高投入保守度，哪一條線能單獨把 avgResolvedEventCount 壓下來。`);
    lines.push(`請優先對照 avgResolvedEventCount、avgResolvedEventsPerSurvivalRound、avgSurvivalRounds、avgResolvedEventRate、avgCompletedTasks 與敗局型態。若總解決事件數下降但每存活回合解事件能力沒變，代表差距主要來自生存節奏。`);
  } else if (presetId === "survival_cadence_alignment") {
    lines.push(`這組比較專門追 web 主線「為什麼活得太久」。基線固定是「${baseline.labelZh}」，先看陪伴標記介入、站點回復門檻與風險暴露，哪一條線單獨就能把勝率與敗局型態往 Python 拉近。`);
    lines.push(`請優先對照 avgCompanionUseCount、avgSurvivalRounds、avgResolvedEventsPerSurvivalRound、avgFinalSrTotal、avgFinalSpTotal、avgMovedIntoRiskPerRound、avgRiskCampersPerRound 與 failureReasons。若勝率下降但每存活回合解事件能力不變，代表問題更像生存節奏，而不是事件需求本身。`);
  } else if (presetId === "custom_ai_builder") {
    lines.push(`這組比較直接拿你的「${baseline.labelZh}」和現行主線 AI 並排看，先回答它到底會不會比現行主線更接近你心中的真人打法。`);
    lines.push("先看勝率，再看平均完成任務與平均解決事件數；如果勝率上升但事件解決節奏掉太多，代表它比較像保命，不一定是真的更會玩。");
  }

  const weakestEvent = baseline.eventDebug.filter((event) => event.seenCount > 0).sort((a, b) => a.resolvedRate - b.resolvedRate)[0];
  if (weakestEvent) {
    lines.push(`基線版本目前最難處理的事件是「${weakestEvent.nameZh}」，解決率 ${formatPercent(weakestEvent.resolvedRate)}，可優先檢查這張事件的立即效果與未解懲罰。`);
  }
  if (presetId === "gap_root_cause_alignment" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前 gap 拆解基線是「${baseline.labelZh}」，比較對象依序是 ${labels}。先看 v2d 相對 v2c、保守庇護所與陪伴更保守線，是否仍主要差在 avgSurvivalRounds；若 throughput 線反而更有影響，才回頭收 event handling。`);
  } else if (presetId === "canonical_v2b_refinement" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前這組裡最接近 Python 的版本是「${baseline.labelZh}」，其餘比較對象依序是 ${labels}。先看有沒有一個比 companion-only 更接近 Python、但 throughput 沒明顯崩掉的 v2b 中間點。`);
  } else if (presetId === "canonical_v2c_refinement" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前這組裡最接近 Python 的版本是「${baseline.labelZh}」，其餘比較對象依序是 ${labels}。先看 tighter recovery 能不能比 v2b 更穩定地縮短存活回合，同時不要把每存活回合解事件能力一起拖垮。`);
  } else if (presetId === "canonical_v2d_refinement" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前這組預設主線是「${baseline.labelZh}」，其餘比較對象依序是 ${labels}。先看 v2d 的微調，是不是主要透過縮短存活回合與壓低 pressure6 declare 去縮小 gap，而不是把每存活回合解事件能力一起砍壞。`);
  } else if (presetId === "canonical_v2e_refinement" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前這組裡最接近 Python 的版本是「${baseline.labelZh}」，其餘比較對象依序是 ${labels}。先看 v2e 的細修，是不是主要透過再縮短存活回合去壓低總解事件數，同時把 help 與任務維持在不明顯崩掉的區間。`);
  } else if (presetId === "canonical_v2_refinement" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前這組裡最接近 Python 的版本是「${baseline.labelZh}」，其餘比較對象依序是 ${labels}。先看最接近 Python 的那一條線，是不是主要透過縮短存活回合來壓下總解事件數。`);
  } else if (presetId === "ai_policy_alignment" && aggregates.length > 2) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    const solver = aggregates.find((variant) => variant.variantId === "solver_baseline_policy");
    if (solver) {
      lines.push(`正式候選「${baseline.labelZh}」相對 Solver 的勝率差 ${formatSignedPercent(baseline.winRate - solver.winRate)}，相鄰互助差 ${formatSignedNumber(baseline.avgAdjacentHelpCount - solver.avgAdjacentHelpCount)}，進風險 / 回合差 ${formatSignedNumber(baseline.avgMovedIntoRiskPerRound - solver.avgMovedIntoRiskPerRound)}。`);
    }
    lines.push(`目前正式候選版本是「${baseline.labelZh}」，本輪比較對象依序是 ${labels}。先看哪一條線單獨就最接近這條候選口徑。`);
  } else if (presetId === "event_resolution_alignment" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前事件收斂基線是「${baseline.labelZh}」，比較對象依序是 ${labels}。先看哪一條線單獨就能把平均解決事件數往 Python benchmark 拉近。`);
  } else if (presetId === "survival_cadence_alignment" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前生存節奏基線是「${baseline.labelZh}」，比較對象依序是 ${labels}。先看哪一條線單獨就能把勝率壓下來，同時保留事件解決率。`);
  } else if (presetId === "tuning_axes_v5" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前以首玩體驗最貼近基準的版本「${baseline.labelZh}」作正式候選，其餘比較對象依序是 ${labels}。若物資站 -1 只是在拉低勝率、卻沒有把敗局後移或補出緊張時刻，代表它更像第二層微調，不是主嫌。`);
  } else if (presetId === "tuning_axes_v6" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前以首玩體驗最貼近基準的版本「${baseline.labelZh}」作正式候選，其餘比較對象依序是 ${labels}。若 help / risk 線主要把敗局往前推，而 companion / recovery 線較能把敗局留在 R5–R7，代表剩餘 gap 仍偏 survival cadence，但不能用前置爆打的方式修。`);
  } else if (presetId === "tuning_axes_v7" && aggregates.length > 1) {
    const labels = aggregates.filter((variant, index) => index !== baselineIndex).map((variant) => `「${variant.labelZh}」`).join('、');
    lines.push(`目前以首玩體驗最貼近基準的版本「${baseline.labelZh}」作正式候選，其餘比較對象依序是 ${labels}。若 A2 單刀已把勝率壓進 40%–45%，後續就不該再硬加第二刀；若 risk / help 線只是在壓低勝率卻沒有把敗局後移，代表它們更像前置爆打，不是這輪主修。`);
  } else {
    lines.push(`目前基線版本是「${baseline.labelZh}」，比較對象是「${challenger.labelZh}」。先看勝率，再看壓力、互助與 SR / SP 峰值。`);
  }
  return lines;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPercent(value: number) {
  const percent = (value * 100).toFixed(1);
  return `${value >= 0 ? "+" : ""}${percent}%`;
}

function formatNumber(value: number) {
  return value.toFixed(3);
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function getRoundCadenceRow(variant: SimulationVariantAggregate, round: number) {
  return variant.roundCadenceRows.find((row) => row.round === round) ?? null;
}

function scoreVariantAgainstPythonBenchmark(variant: Pick<SimulationVariantAggregate, "winRate" | "avgCompletedTasks" | "avgAdjacentHelpCount" | "avgResolvedEventCount" | "avgPressure3MultiContributorRate" | "avgPressure6DeclareRate">) {
  return Math.abs(variant.winRate - PYTHON_MAINLINE_BENCHMARK.result.winRate)
    + Math.abs(variant.avgCompletedTasks - PYTHON_MAINLINE_BENCHMARK.result.avgCompletedMissions)
    + Math.abs(variant.avgAdjacentHelpCount - PYTHON_MAINLINE_BENCHMARK.result.avgZeroApMutualAid)
    + Math.abs(variant.avgResolvedEventCount - PYTHON_MAINLINE_BENCHMARK.result.avgResolvedEvents)
    + Math.abs(variant.avgPressure3MultiContributorRate - PYTHON_MAINLINE_BENCHMARK.result.avgPressure3MultiContributorRate)
    + Math.abs(variant.avgPressure6DeclareRate - PYTHON_MAINLINE_BENCHMARK.result.avgPressure6DeclareRate);
}

function formatNullablePercent(value: number | null) {
  return value == null ? "—" : formatPercent(value);
}

function getPlaytestFitStatus(distance: number, tight = 0.02, near = 0.08): SimulationPlaytestFitStatus {
  if (distance <= tight) return "pass";
  if (distance <= near) return "near";
  return "miss";
}

function scoreVariantAgainstPlaytestTargets(variant: Pick<SimulationVariantAggregate, "winRate" | "earlyLossRate" | "lateLossR57Rate" | "lateLossR67Rate" | "winResourceTensionRate">) {
  const winRatePenalty = variant.winRate < 0.4 ? 0.4 - variant.winRate : variant.winRate > 0.45 ? variant.winRate - 0.45 : 0;
  const earlyLossPenalty = Math.max(0, (variant.earlyLossRate ?? 0) - 0.15);
  const lateLossR57Penalty = Math.max(0, 0.7 - (variant.lateLossR57Rate ?? 0));
  const lateLossR67Penalty = Math.max(0, 0.5 - (variant.lateLossR67Rate ?? 0));
  const tensionPenalty = Math.max(0, 0.5 - (variant.winResourceTensionRate ?? 0));
  return winRatePenalty * 3
    + earlyLossPenalty * 2.5
    + lateLossR57Penalty * 1.5
    + lateLossR67Penalty * 2
    + tensionPenalty * 1.5;
}

function scoreVariantAgainstPlaytestTargetsWithPythonTiebreak(variant: Pick<SimulationVariantAggregate, "winRate" | "earlyLossRate" | "lateLossR57Rate" | "lateLossR67Rate" | "winResourceTensionRate" | "avgCompletedTasks" | "avgAdjacentHelpCount" | "avgResolvedEventCount" | "avgPressure3MultiContributorRate" | "avgPressure6DeclareRate">) {
  return scoreVariantAgainstPlaytestTargets(variant) + scoreVariantAgainstPythonBenchmark(variant) * 0.05;
}

function buildPlaytestAlignment(baseline: SimulationVariantAggregate): SimulationPlaytestAlignment {
  const rows: SimulationPlaytestFitRow[] = [
    {
      metricId: "win_rate_band",
      labelZh: "首玩勝率",
      targetZh: "40%–45%",
      value: baseline.winRate,
      valueZh: formatPercent(baseline.winRate),
      status: getPlaytestFitStatus(baseline.winRate < 0.4 ? 0.4 - baseline.winRate : baseline.winRate > 0.45 ? baseline.winRate - 0.45 : 0, 0.005, 0.03),
      noteZh: "這是唯一明確的主勝率區間；不再要求單純靠近 Python。",
    },
    {
      metricId: "early_loss_ratio",
      labelZh: "R1–R3 敗局占比",
      targetZh: "≤ 15%",
      value: baseline.earlyLossRate,
      valueZh: formatNullablePercent(baseline.earlyLossRate),
      status: getPlaytestFitStatus(Math.max(0, (baseline.earlyLossRate ?? 0) - 0.15), 0.01, 0.05),
      noteZh: "用全部敗局中，R1–R3 敗局的比例計算。",
    },
    {
      metricId: "late_loss_r57_ratio",
      labelZh: "敗局集中於 R5–R7",
      targetZh: "暫以 ≥ 70% 作 proxy",
      value: baseline.lateLossR57Rate,
      valueZh: formatNullablePercent(baseline.lateLossR57Rate),
      status: getPlaytestFitStatus(Math.max(0, 0.7 - (baseline.lateLossR57Rate ?? 0)), 0.03, 0.1),
      noteZh: "原始口徑是『主要集中』，本報表先用 70% 當暫定門檻。",
    },
    {
      metricId: "late_loss_r67_ratio",
      labelZh: "R6–R7 惜敗占比",
      targetZh: "≥ 50%（回合 proxy）",
      value: baseline.lateLossR67Rate,
      valueZh: formatNullablePercent(baseline.lateLossR67Rate),
      status: getPlaytestFitStatus(Math.max(0, 0.5 - (baseline.lateLossR67Rate ?? 0)), 0.03, 0.1),
      noteZh: "目前以失敗發生在 R6–R7 當作惜敗 proxy，還不是完整『差一點』判定。",
    },
    {
      metricId: "win_resource_tension_rate",
      labelZh: "勝局出現 SR / SP ≤ 1 緊張時刻",
      targetZh: "暫以 ≥ 50% 作 proxy",
      value: baseline.winResourceTensionRate,
      valueZh: formatNullablePercent(baseline.winResourceTensionRate),
      status: getPlaytestFitStatus(Math.max(0, 0.5 - (baseline.winResourceTensionRate ?? 0)), 0.03, 0.1),
      noteZh: "這裡統計的是勝局中曾出現資源 ≤ 1 的比例，作為『常出現至少一次』的暫定 proxy。",
    },
  ];
  const passedCount = rows.filter((row) => row.status === "pass").length;
  const nearCount = rows.filter((row) => row.status === "near").length;
  const summaryZh = [
    `正式候選「${baseline.labelZh}」的首玩體驗 fit score 為 ${baseline.playtestFitScore.toFixed(3)}。這個分數越低越好，主評分看的是首玩體驗基準，不是 Python gap。`,
    `目前 ${passedCount} 項達標、${nearCount} 項接近。若 R1–R3 敗局占比仍高，代表事件 SP 壓力可能被推得太前置；若勝局緊張時刻太少，代表整體壓力仍偏寬。`,
    `R5–R7 與 R6–R7 兩項目前都還是回合 proxy，不等於完整惜敗判讀；後續若要更準，需再補『最後一輪前資源差距』等 closeness 指標。`,
  ];
  return {
    baselineVariantId: baseline.variantId,
    baselineLabelZh: baseline.labelZh,
    fitScore: baseline.playtestFitScore,
    rows,
    summaryZh,
  };
}

function normalizeRelativeDelta(delta: number, baselineValue: number, minimum = 0.1) {
  return baselineValue === 0 ? 0 : delta / Math.max(Math.abs(baselineValue), minimum);
}

function getDominantAxisLabelZh(axis: SimulationGapDiagnosis["dominantAxis"]) {
  switch (axis) {
    case "survival_cadence":
      return "主因較偏生存節奏";
    case "per_round_resolution":
      return "主因較偏每回合解題能力";
    case "mixed":
      return "主因較偏混合型";
    default:
      return "訊號仍不足";
  }
}

function buildGapDiagnosis(aggregates: SimulationVariantAggregate[], presetId: string, baseline: SimulationVariantAggregate): SimulationGapDiagnosis {
  const supportedPresets = new Set(["tuning_axes_v1", "tuning_axes_v2", "tuning_axes_v3", "tuning_axes_v4", "tuning_axes_v5", "tuning_axes_v6", "tuning_axes_v7", "gap_root_cause_alignment", "canonical_v2b_refinement", "canonical_v2c_refinement", "canonical_v2d_refinement", "canonical_v2e_refinement", "canonical_v2f_refinement", "canonical_v2_refinement", "ai_policy_alignment", "event_resolution_alignment", "survival_cadence_alignment"]);
  if (!supportedPresets.has(presetId) || aggregates.length < 2) {
    return {
      baselineVariantId: baseline.variantId,
      baselineLabelZh: baseline.labelZh,
      dominantAxis: "insufficient_signal",
      dominantAxisLabelZh: getDominantAxisLabelZh("insufficient_signal"),
      confidence: 0,
      evidenceZh: ["目前這組 compare 不足以直接判斷 gap 主因；請改用「gap 主因拆解比較」或至少包含 Canonical 主線、survival 線與 event 線的比較組。"],
      nextStepsZh: ["先切到 gap 主因拆解比較，再看 avgSurvivalRounds 與 avgResolvedEventsPerSurvivalRound 哪一條先被單因子版本明顯拉動。"],
      variantImpacts: [],
    };
  }

  const baselineR5 = getRoundCadenceRow(baseline, 5);
  let survivalEvidence = 0;
  let throughputEvidence = 0;

  const variantImpacts = aggregates
    .filter((variant) => variant.variantId !== baseline.variantId)
    .map((variant) => {
      const totalResolvedDelta = baseline.avgResolvedEventCount - variant.avgResolvedEventCount;
      const survivalRoundsDelta = baseline.avgSurvivalRounds - variant.avgSurvivalRounds;
      const throughputDelta = baseline.avgResolvedEventsPerSurvivalRound - variant.avgResolvedEventsPerSurvivalRound;
      const winRateDelta = baseline.winRate - variant.winRate;
      const variantR5 = getRoundCadenceRow(variant, 5);
      const r5ResolvedByEndDelta = baselineR5 && variantR5 ? baselineR5.avgResolvedEventsByEnd - variantR5.avgResolvedEventsByEnd : null;

      const totalResolvedScore = Math.abs(normalizeRelativeDelta(totalResolvedDelta, baseline.avgResolvedEventCount, 1));
      const winRateScore = Math.abs(normalizeRelativeDelta(winRateDelta, baseline.winRate, 0.1));
      const weight = totalResolvedScore + winRateScore * 0.5;
      const survivalScore = Math.abs(normalizeRelativeDelta(survivalRoundsDelta, baseline.avgSurvivalRounds, 1));
      const throughputScore = Math.abs(normalizeRelativeDelta(throughputDelta, baseline.avgResolvedEventsPerSurvivalRound, 0.1));

      survivalEvidence += survivalScore * weight;
      throughputEvidence += throughputScore * weight;

      let primaryAxis: SimulationGapDiagnosisVariantImpact["primaryAxis"] = "mixed";
      if (survivalScore > throughputScore * 1.35) primaryAxis = "survival_cadence";
      else if (throughputScore > survivalScore * 1.35) primaryAxis = "per_round_resolution";

      return {
        variantId: variant.variantId,
        labelZh: variant.labelZh,
        winRateDelta,
        totalResolvedDelta,
        survivalRoundsDelta,
        throughputDelta,
        r5ResolvedByEndDelta,
        primaryAxis,
      };
    })
    .sort((a, b) => Math.abs(b.totalResolvedDelta) - Math.abs(a.totalResolvedDelta));

  const totalEvidence = survivalEvidence + throughputEvidence;
  let dominantAxis: SimulationGapDiagnosis["dominantAxis"] = "insufficient_signal";
  if (totalEvidence >= 0.05) {
    if (survivalEvidence > throughputEvidence * 1.35) dominantAxis = "survival_cadence";
    else if (throughputEvidence > survivalEvidence * 1.35) dominantAxis = "per_round_resolution";
    else dominantAxis = "mixed";
  }

  const confidence = totalEvidence <= 0 ? 0 : Math.min(1, Math.abs(survivalEvidence - throughputEvidence) / totalEvidence);
  const topImpacts = variantImpacts.slice(0, 3);
  const evidenceZh = [
    `基線「${baseline.labelZh}」目前平均存活回合 ${formatNumber(baseline.avgSurvivalRounds)}，每存活回合解事件 ${formatNumber(baseline.avgResolvedEventsPerSurvivalRound)}，平均解決事件數 ${formatNumber(baseline.avgResolvedEventCount)}。`,
    ...topImpacts.map((impact) => {
      const r5Part = impact.r5ResolvedByEndDelta == null ? "" : `，R5 累積解決事件差 ${formatSignedNumber(-impact.r5ResolvedByEndDelta)}`;
      const axisZh = impact.primaryAxis === "survival_cadence" ? "主要動到生存節奏" : impact.primaryAxis === "per_round_resolution" ? "主要動到每回合解題能力" : "同時動到兩邊";
      return `「${impact.labelZh}」相對基線：勝率 ${formatSignedPercent(-impact.winRateDelta)}、總解決事件 ${formatSignedNumber(-impact.totalResolvedDelta)}、存活回合 ${formatSignedNumber(-impact.survivalRoundsDelta)}、每存活回合解事件 ${formatSignedNumber(-impact.throughputDelta)}${r5Part}；${axisZh}。`;
    }),
  ];

  const nextStepsZh = dominantAxis === "survival_cadence"
    ? [
        "下一刀優先收 companion / help / risk，不先急著重寫事件需求。",
        "先看收緊 survival cadence 後，avgResolvedEventsPerSurvivalRound 是否仍幾乎不動；若是，代表主因已很接近 survival。",
      ]
    : dominantAxis === "per_round_resolution"
      ? [
          "下一刀優先收 pressure 3+ 多人投入、事件處理時序與 event-handling policy。",
          "先看壓力 3+ 區間的多人投入達成率與固定回合截斷下的解決率。",
        ]
      : dominantAxis === "mixed"
        ? [
            "下一刀不要只押單一方向；先同時看 R5 截斷累積解決事件與壓力 3+ 多人投入率。",
            "若 survival 與 throughput 都被明顯拉動，代表還需要再拆 companion/help/risk 與 pressure 3+。",
          ]
        : ["目前訊號仍不足；請優先改用 gap 主因拆解比較或提高局數到 100+。"];

  return {
    baselineVariantId: baseline.variantId,
    baselineLabelZh: baseline.labelZh,
    dominantAxis,
    dominantAxisLabelZh: getDominantAxisLabelZh(dominantAxis),
    confidence,
    evidenceZh,
    nextStepsZh,
    variantImpacts,
  };
}

function orderVariantsByBaseline(aggregates: SimulationVariantAggregate[], baselineIndex: number) {
  const baseline = aggregates[baselineIndex];
  if (!baseline) return aggregates;
  return [baseline, ...aggregates.filter((_, index) => index !== baselineIndex)];
}

function buildBenchmarkAlignment(baseline: SimulationVariantAggregate, gapDiagnosis: SimulationGapDiagnosis): SimulationBenchmarkAlignment {
  const pythonRows = PYTHON_MAINLINE_BENCHMARK.comparisonMatrix;
  const currentFailureSrRate = baseline.runCount > 0 ? baseline.failureReasons.sr_zero / baseline.runCount : 0;
  const currentFailureSpRate = baseline.runCount > 0 ? baseline.failureReasons.sp_zero / baseline.runCount : 0;
  const rows: SimulationBenchmarkGapRow[] = [
    { metricId: "win_rate", labelZh: "勝率", pythonValue: PYTHON_MAINLINE_BENCHMARK.result.winRate, webValue: baseline.winRate, delta: baseline.winRate - PYTHON_MAINLINE_BENCHMARK.result.winRate, deltaZh: formatSignedPercent(baseline.winRate - PYTHON_MAINLINE_BENCHMARK.result.winRate) },
    { metricId: "completed_tasks", labelZh: "平均完成任務", pythonValue: PYTHON_MAINLINE_BENCHMARK.result.avgCompletedMissions, webValue: baseline.avgCompletedTasks, delta: baseline.avgCompletedTasks - PYTHON_MAINLINE_BENCHMARK.result.avgCompletedMissions, deltaZh: formatSignedNumber(baseline.avgCompletedTasks - PYTHON_MAINLINE_BENCHMARK.result.avgCompletedMissions) },
    { metricId: "adjacent_help", labelZh: "0AP 相鄰互助", pythonValue: PYTHON_MAINLINE_BENCHMARK.result.avgZeroApMutualAid, webValue: baseline.avgAdjacentHelpCount, delta: baseline.avgAdjacentHelpCount - PYTHON_MAINLINE_BENCHMARK.result.avgZeroApMutualAid, deltaZh: formatSignedNumber(baseline.avgAdjacentHelpCount - PYTHON_MAINLINE_BENCHMARK.result.avgZeroApMutualAid) },
    { metricId: "resolved_events", labelZh: "平均解決事件數", pythonValue: PYTHON_MAINLINE_BENCHMARK.result.avgResolvedEvents, webValue: baseline.avgResolvedEventCount, delta: baseline.avgResolvedEventCount - PYTHON_MAINLINE_BENCHMARK.result.avgResolvedEvents, deltaZh: formatSignedNumber(baseline.avgResolvedEventCount - PYTHON_MAINLINE_BENCHMARK.result.avgResolvedEvents) },
    { metricId: "pressure3_multi", labelZh: "壓力 3+ 多人投入率", pythonValue: PYTHON_MAINLINE_BENCHMARK.result.avgPressure3MultiContributorRate, webValue: baseline.avgPressure3MultiContributorRate, delta: baseline.avgPressure3MultiContributorRate - PYTHON_MAINLINE_BENCHMARK.result.avgPressure3MultiContributorRate, deltaZh: formatSignedPercent(baseline.avgPressure3MultiContributorRate - PYTHON_MAINLINE_BENCHMARK.result.avgPressure3MultiContributorRate) },
    { metricId: "pressure6_declare", labelZh: "壓力 6+ 任務宣告率", pythonValue: PYTHON_MAINLINE_BENCHMARK.result.avgPressure6DeclareRate, webValue: baseline.avgPressure6DeclareRate, delta: baseline.avgPressure6DeclareRate - PYTHON_MAINLINE_BENCHMARK.result.avgPressure6DeclareRate, deltaZh: formatSignedPercent(baseline.avgPressure6DeclareRate - PYTHON_MAINLINE_BENCHMARK.result.avgPressure6DeclareRate) },
    { metricId: "failure_sr", labelZh: "SR 歸零敗局率", pythonValue: PYTHON_MAINLINE_BENCHMARK.result.failureSrZero, webValue: currentFailureSrRate, delta: currentFailureSrRate - PYTHON_MAINLINE_BENCHMARK.result.failureSrZero, deltaZh: formatSignedPercent(currentFailureSrRate - PYTHON_MAINLINE_BENCHMARK.result.failureSrZero) },
    { metricId: "failure_sp", labelZh: "SP 歸零敗局率", pythonValue: PYTHON_MAINLINE_BENCHMARK.result.failureSpZero, webValue: currentFailureSpRate, delta: currentFailureSpRate - PYTHON_MAINLINE_BENCHMARK.result.failureSpZero, deltaZh: formatSignedPercent(currentFailureSpRate - PYTHON_MAINLINE_BENCHMARK.result.failureSpZero) },
  ];
  const gapScore = rows.reduce((sum, row) => sum + Math.abs(row.delta), 0);
  const closest = pythonRows
    .map((row) => ({
      row,
      score: Math.abs(baseline.winRate - row.winRate) + Math.abs(baseline.avgCompletedTasks - row.avgCompletedMissions) + Math.abs(baseline.avgAdjacentHelpCount - row.avgZeroApMutualAid) + Math.abs(baseline.avgResolvedEventCount - row.avgResolvedEvents) + Math.abs(baseline.avgPressure3MultiContributorRate - row.avgPressure3MultiContributorRate) + Math.abs(baseline.avgPressure6DeclareRate - row.avgPressure6DeclareRate),
    }))
    .sort((a, b) => a.score - b.score)[0]?.row ?? PYTHON_MAINLINE_BENCHMARK.result;
  const topGaps = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  const summaryZh = [
    `目前 web 正式候選「${baseline.labelZh}」對照 Python 主線「${PYTHON_MAINLINE_BENCHMARK.defaultResultLabelZh}」的總差距分數為 ${gapScore.toFixed(3)}；在 Python 矩陣裡最接近的是「${closest.labelZh}」。`,
    `系統目前判定 gap 主因：${gapDiagnosis.dominantAxisLabelZh}（confidence ${formatNumber(gapDiagnosis.confidence)}）。請優先分開看 avgResolvedEventCount、avgResolvedEventsPerSurvivalRound 與 avgSurvivalRounds。`,
    ...topGaps.map((row) => `目前最大差距之一是「${row.labelZh}」：web ${formatNumber(row.webValue)}，Python ${formatNumber(row.pythonValue)}，差值 ${row.deltaZh}。`),
  ];
  return {
    baselineVariantId: baseline.variantId,
    baselineLabelZh: baseline.labelZh,
    pythonVariantId: PYTHON_MAINLINE_BENCHMARK.result.variantId,
    pythonLabelZh: PYTHON_MAINLINE_BENCHMARK.result.labelZh,
    closestPythonVariantId: closest.variantId,
    closestPythonLabelZh: closest.labelZh,
    gapScore,
    rows,
    summaryZh,
  };
}

export function runSimulationCompare(variants: SimulationVariantInput[], options?: { presetId?: string; seed?: number }): SimulationCompareReport {
  const reportSeed = Number.isFinite(options?.seed) ? Math.floor(options!.seed as number) : 20260401;
  const inputVariants = variants.length > 0 ? variants : DEFAULT_SIMULATION_COMPARE_VARIANTS;
  const resolvedVariants = inputVariants.map((variant, index) => ({
    ...variant,
    seed: Number.isFinite(variant.seed) ? variant.seed : reportSeed + index * 1000,
  }));
  const rawAggregates = resolvedVariants.map(runSimulationVariant);
  const preset = getSimulationComparePreset(options?.presetId);
  const baselineIndex = getBaselineVariantIndex(rawAggregates, preset.presetId);
  const baseline = rawAggregates[baselineIndex] ?? rawAggregates[0];
  const aggregates = orderVariantsByBaseline(rawAggregates, baselineIndex);
  const gapDiagnosis = buildGapDiagnosis(aggregates, preset.presetId, baseline);

  return {
    generatedAt: new Date().toISOString(),
    seed: reportSeed,
    presetId: preset.presetId,
    presetLabelZh: preset.labelZh,
    presetDescriptionZh: preset.descriptionZh,
    availablePresets: getSimulationComparePresetDefinitions(),
    baselineVariantId: baseline.variantId,
    reportFormatZh: [
      "先看雙層：第一層是機制校正，第二層是首玩體驗校正；不要再只看誰最接近 Python。",
      "首玩體驗主基準是：勝率 40%–45%、R1–R3 敗局占比 ≤ 15%、敗局後移到 R5–R7、R6–R7 惜敗占比提高、勝局常出現 SR / SP ≤ 1。",
      "若 win rate 上升但相鄰互助下降，代表可能是資源雪球而非合作改善。",
      "avgPeakSrTotal / avgPeakSpTotal 可用來觀察無上限後是否出現中後期囤資源。",
      "2026-04 本輪修正已納入事件立即效果、巡林探路者免費移動、商會護衛 SR 轉移、事件牌庫隨機抽牌與非固定宣告者。修前與修後數據不宜直接混讀。",
      "avgResolvedEventCount 已拆成 avgSurvivalRounds 與 avgResolvedEventsPerSurvivalRound；先分清楚是活得更久，還是每存活回合更會解事件。",
      "固定回合截斷表會把已敗局版本在後續回合視為不再新增事件，累積值沿用最後存活回合的數字；用來分離『活得更久』與『每回合更會解』。",
    ],
    summaryZh: buildSummaryZh(rawAggregates, preset.presetId, baselineIndex),
    variants: aggregates,
    playtestAlignment: buildPlaytestAlignment(baseline),
    comparisonTable: aggregates.map((item) => ({
      variantId: item.variantId,
      labelZh: item.labelZh,
      winRate: item.winRate,
      avgCompletedTasks: item.avgCompletedTasks,
      avgFinalPressure: item.avgFinalPressure,
      avgResolvedEventRate: item.avgResolvedEventRate,
      avgResolvedEventCount: item.avgResolvedEventCount,
      avgEventCount: item.avgEventCount,
      avgSurvivalRounds: item.avgSurvivalRounds,
      avgResolvedEventsPerSurvivalRound: item.avgResolvedEventsPerSurvivalRound,
      avgAdjacentHelpCount: item.avgAdjacentHelpCount,
      avgPressure3MultiContributorRate: item.avgPressure3MultiContributorRate,
      avgPressure6DeclareRate: item.avgPressure6DeclareRate,
      avgCompanionUseCount: item.avgCompanionUseCount,
      avgFinalSrTotal: item.avgFinalSrTotal,
      avgFinalSpTotal: item.avgFinalSpTotal,
      avgPeakSrTotal: item.avgPeakSrTotal,
      avgPeakSpTotal: item.avgPeakSpTotal,
      avgFailureRound: item.avgFailureRound,
      avgFirstDangerRound: item.avgFirstDangerRound,
      avgFirstPressure6Round: item.avgFirstPressure6Round,
      earlyLossRate: item.earlyLossRate,
      lateLossR57Rate: item.lateLossR57Rate,
      lateLossR67Rate: item.lateLossR67Rate,
      winResourceTensionRate: item.winResourceTensionRate,
      playtestFitScore: item.playtestFitScore,
      avgMovedIntoRiskPerRound: item.avgMovedIntoRiskPerRound,
      avgRiskCampersPerRound: item.avgRiskCampersPerRound,
    })),
    gapDiagnosis,
    benchmarkAlignment: buildBenchmarkAlignment(baseline, gapDiagnosis),
    deltasFromFirstVariant: aggregates.map((item) => ({
      variantId: item.variantId,
      labelZh: item.labelZh,
      winRateDelta: item.winRate - baseline.winRate,
      completedTasksDelta: item.avgCompletedTasks - baseline.avgCompletedTasks,
      finalPressureDelta: item.avgFinalPressure - baseline.avgFinalPressure,
      resolvedEventRateDelta: item.avgResolvedEventRate - baseline.avgResolvedEventRate,
      resolvedEventCountDelta: item.avgResolvedEventCount - baseline.avgResolvedEventCount,
      eventCountDelta: item.avgEventCount - baseline.avgEventCount,
      survivalRoundsDelta: item.avgSurvivalRounds - baseline.avgSurvivalRounds,
      resolvedEventsPerSurvivalRoundDelta: item.avgResolvedEventsPerSurvivalRound - baseline.avgResolvedEventsPerSurvivalRound,
      adjacentHelpDelta: item.avgAdjacentHelpCount - baseline.avgAdjacentHelpCount,
      pressure3MultiContributorDelta: item.avgPressure3MultiContributorRate - baseline.avgPressure3MultiContributorRate,
      pressure6DeclareDelta: item.avgPressure6DeclareRate - baseline.avgPressure6DeclareRate,
      companionUseDelta: item.avgCompanionUseCount - baseline.avgCompanionUseCount,
      finalSrDelta: item.avgFinalSrTotal - baseline.avgFinalSrTotal,
      finalSpDelta: item.avgFinalSpTotal - baseline.avgFinalSpTotal,
      peakSrDelta: item.avgPeakSrTotal - baseline.avgPeakSrTotal,
      peakSpDelta: item.avgPeakSpTotal - baseline.avgPeakSpTotal,
      firstDangerRoundDelta: item.avgFirstDangerRound != null && baseline.avgFirstDangerRound != null ? item.avgFirstDangerRound - baseline.avgFirstDangerRound : null,
      firstPressure6RoundDelta: item.avgFirstPressure6Round != null && baseline.avgFirstPressure6Round != null ? item.avgFirstPressure6Round - baseline.avgFirstPressure6Round : null,
      movedIntoRiskDelta: item.avgMovedIntoRiskPerRound - baseline.avgMovedIntoRiskPerRound,
      riskCampersDelta: item.avgRiskCampersPerRound - baseline.avgRiskCampersPerRound,
    })),
  };
}

function getBranchVerificationStatusFromPlaytest(alignment: SimulationPlaytestAlignment): {
  status: SimulationBranchVerificationStatus;
  passCount: number;
  nearCount: number;
  missCount: number;
} {
  const passCount = alignment.rows.filter((row) => row.status === "pass").length;
  const nearCount = alignment.rows.filter((row) => row.status === "near").length;
  const missCount = alignment.rows.filter((row) => row.status === "miss").length;

  if (missCount === 0) {
    return { status: "pass", passCount, nearCount, missCount };
  }

  if (missCount <= 2 && passCount + nearCount >= 4) {
    return { status: "near", passCount, nearCount, missCount };
  }

  return { status: "miss", passCount, nearCount, missCount };
}

function buildBranchVerificationSummary(rows: SimulationBranchVerificationRow[]) {
  if (rows.length === 0) {
    return ["目前沒有可供檢驗的 AI 模擬分支。"];
  }

  const passRows = rows.filter((row) => row.status === "pass");
  const nearRows = rows.filter((row) => row.status === "near");
  const missRows = rows.filter((row) => row.status === "miss");
  const healthiestRow = [...rows].sort((a, b) => a.playtestFitScore - b.playtestFitScore || a.benchmarkGapScore - b.benchmarkGapScore)[0];

  return [
    `本輪共檢驗 ${rows.length} 條分支；通過 ${passRows.length} 條、接近 ${nearRows.length} 條、偏離 ${missRows.length} 條。`,
    healthiestRow ? `目前最健康的分支是「${healthiestRow.presetLabelZh}」，正式候選為「${healthiestRow.baselineLabelZh}」，首玩適配分數 ${formatNumber(healthiestRow.playtestFitScore)}。` : "尚未找到可用的健康分支。",
    missRows.length > 0 ? `需要優先回頭檢查的是：${missRows.map((row) => row.presetLabelZh).join("、")}。` : "目前沒有明顯偏離的分支。",
  ];
}

export function runSimulationBranchVerification(options?: {
  presetIds?: string[];
  runCount?: number;
  seed?: number;
}): SimulationBranchVerificationReport {
  const presetIds = (options?.presetIds?.length ? options.presetIds : [...DEFAULT_SIMULATION_BRANCH_PRESET_IDS]) as string[];
  const runCount = Number.isFinite(options?.runCount) ? Math.max(10, Math.floor(options!.runCount as number)) : 50;
  const seed = Number.isFinite(options?.seed) ? Math.floor(options!.seed as number) : 20260401;

  const rows = presetIds.map((presetId, index) => {
    const compare = runSimulationCompare(buildPresetVariants(presetId, runCount), {
      presetId,
      seed: seed + index * 1000,
    });
    const baseline = compare.variants.find((variant) => variant.variantId === compare.baselineVariantId) ?? compare.variants[0];
    const playtestStatus = getBranchVerificationStatusFromPlaytest(compare.playtestAlignment);

    return {
      presetId: compare.presetId,
      presetLabelZh: compare.presetLabelZh,
      baselineVariantId: compare.baselineVariantId,
      baselineLabelZh: compare.playtestAlignment.baselineLabelZh,
      status: playtestStatus.status,
      playtestFitScore: compare.playtestAlignment.fitScore,
      benchmarkGapScore: compare.benchmarkAlignment.gapScore,
      dominantAxisLabelZh: compare.gapDiagnosis.dominantAxisLabelZh,
      winRate: baseline?.winRate ?? 0,
      completedTaskAvg: baseline?.avgCompletedTasks ?? 0,
      passCount: playtestStatus.passCount,
      nearCount: playtestStatus.nearCount,
      missCount: playtestStatus.missCount,
      summaryZh: [
        compare.summaryZh[0] ?? `${compare.presetLabelZh} 已完成比較。`,
        `正式候選：${compare.playtestAlignment.baselineLabelZh}｜勝率 ${formatPercent(baseline?.winRate ?? 0)}｜平均完成任務 ${formatNumber(baseline?.avgCompletedTasks ?? 0)}。`,
        `首玩適配 ${formatNumber(compare.playtestAlignment.fitScore)}｜Python 差距 ${formatNumber(compare.benchmarkAlignment.gapScore)}｜主因 ${compare.gapDiagnosis.dominantAxisLabelZh}。`,
      ],
    } satisfies SimulationBranchVerificationRow;
  });

  return {
    generatedAt: new Date().toISOString(),
    runCount,
    seed,
    rows,
    summaryZh: buildBranchVerificationSummary(rows),
  };
}
