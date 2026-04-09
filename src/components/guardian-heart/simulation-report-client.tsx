"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SimulationFailureReason = "pressure_overflow" | "sr_zero" | "sp_zero" | "task_shortfall" | "unknown";

type SimulationComparePresetDefinition = {
  presetId: string;
  labelZh: string;
  descriptionZh: string;
  variantLabelsZh: string[];
};

type PythonBenchmarkMatrixRow = {
  variantId: string;
  labelZh: string;
  avgCompletedMissions: number;
  avgMissedDeclarations: number;
  avgPressure3MultiContributorRate: number;
  avgPressure6DeclareRate: number;
  avgResolvedEvents: number;
  avgZeroApMutualAid: number;
  failureNone: number;
  failureSpZero: number;
  failureSrZero: number;
  winRate: number;
};

type PythonBenchmarkReport = {
  canonicalVersion: string;
  file: string;
  python: string;
  n: number;
  seed: number;
  defaultIncludeTestCards: boolean;
  defaultMissRate: number;
  sha256: string;
  defaultResultVariantId: string;
  defaultResultLabelZh: string;
  result: PythonBenchmarkMatrixRow;
  comparisonMatrix: PythonBenchmarkMatrixRow[];
  interpretationZh: string[];
};

type SimulationEventDebugAggregate = {
  cardId: string;
  nameZh: string;
  seenCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  resolvedRate: number;
};

type SimulationHistogramRow = {
  round: number;
  count: number;
};

type SimulationAxisBrinkRow = {
  axis: "SR" | "SP" | "both";
  count: number;
};

type SimulationActionFrequencyRow = {
  key: string;
  count: number;
  rate: number;
};

type SimulationTaskDeclarationRow = {
  taskId: string;
  nameZh: string;
  count: number;
  ratePerGame: number;
};

type SimulationRoundCadenceRow = {
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

type SimulationBenchmarkGapRow = {
  metricId: string;
  labelZh: string;
  pythonValue: number;
  webValue: number;
  delta: number;
  deltaZh: string;
};

type SimulationBenchmarkAlignment = {
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

type SimulationPlaytestFitStatus = "pass" | "near" | "miss";

type SimulationPlaytestFitRow = {
  metricId: string;
  labelZh: string;
  targetZh: string;
  value: number | null;
  valueZh: string;
  status: SimulationPlaytestFitStatus;
  noteZh: string;
};

type SimulationPlaytestAlignment = {
  baselineVariantId: string;
  baselineLabelZh: string;
  fitScore: number;
  rows: SimulationPlaytestFitRow[];
  summaryZh: string[];
};

type SimulationGapDiagnosisVariantImpact = {
  variantId: string;
  labelZh: string;
  winRateDelta: number;
  totalResolvedDelta: number;
  survivalRoundsDelta: number;
  throughputDelta: number;
  r5ResolvedByEndDelta: number | null;
  primaryAxis: "survival_cadence" | "per_round_resolution" | "mixed";
};

type SimulationGapDiagnosis = {
  baselineVariantId: string;
  baselineLabelZh: string;
  dominantAxis: "survival_cadence" | "per_round_resolution" | "mixed" | "insufficient_signal";
  dominantAxisLabelZh: string;
  confidence: number;
  evidenceZh: string[];
  nextStepsZh: string[];
  variantImpacts: SimulationGapDiagnosisVariantImpact[];
};

type SimulationVariantAggregate = {
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

type SimulationCompareReport = {
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
    firstDangerRoundDelta: number | null;
    firstPressure6RoundDelta: number | null;
    movedIntoRiskDelta: number;
    riskCampersDelta: number;
  }>;
};

type SimulationBranchVerificationStatus = "pass" | "near" | "miss";

type SimulationBranchVerificationRow = {
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

type SimulationBranchVerificationReport = {
  generatedAt: string;
  runCount: number;
  seed: number;
  rows: SimulationBranchVerificationRow[];
  summaryZh: string[];
};

type CustomAiPriorityId = "stabilize_self" | "stabilize_team" | "resolve_event" | "play_cards" | "move_position";

const RUN_COUNT_OPTIONS = [50, 100, 200, 500];
const CUSTOM_AI_PRIORITY_OPTIONS: Array<{ value: CustomAiPriorityId; labelZh: string; noteZh: string }> = [
  { value: "stabilize_self", labelZh: "先顧自己資源線", noteZh: "SR / SP 快掉到安全線時，優先去回復。" },
  { value: "stabilize_team", labelZh: "先顧隊友資源線", noteZh: "看到隊友快掉到安全線時，優先互助。" },
  { value: "resolve_event", labelZh: "先補事件需求", noteZh: "先試著補 1 點事件需求，再下一輪重新檢查整體局勢。" },
  { value: "play_cards", labelZh: "先找能出的行動卡", noteZh: "優先用手牌做支援或補事件。" },
  { value: "move_position", labelZh: "先移動找位置", noteZh: "先站到更容易回復、互助或處理事件的位置。" },
];
const DEFAULT_CUSTOM_AI_PRIORITY_ORDER: CustomAiPriorityId[] = ["stabilize_self", "stabilize_team", "resolve_event"];

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number) {
  return value.toFixed(2);
}

function formatNullableNumber(value: number | null) {
  return value == null ? "—" : value.toFixed(2);
}

function formatNullablePercent(value: number | null) {
  return value == null ? "—" : formatPercent(value);
}

function formatSignedNumber(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatNullableSignedNumber(value: number | null, digits = 2) {
  return value == null ? "—" : formatSignedNumber(value, digits);
}

function formatBenchmarkMetricValue(metricId: string, value: number) {
  return metricId === "win_rate" || metricId === "failure_sr" || metricId === "failure_sp" || metricId === "pressure3_multi" || metricId === "pressure6_declare" ? formatPercent(value) : formatNumber(value);
}

export function SimulationReportClient() {
  const searchParams = useSearchParams();
  const [report, setReport] = useState<SimulationCompareReport | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState("tuning_axes_v7");
  const [runCount, setRunCount] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<PythonBenchmarkReport | null>(null);
  const [branchReport, setBranchReport] = useState<SimulationBranchVerificationReport | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [customAiName, setCustomAiName] = useState("穩健互助型");
  const [customPriorityOrder, setCustomPriorityOrder] = useState<CustomAiPriorityId[]>(DEFAULT_CUSTOM_AI_PRIORITY_ORDER);
  const [customSelfSafetyLine, setCustomSelfSafetyLine] = useState(1);
  const [customTeamSafetyLine, setCustomTeamSafetyLine] = useState(1);
  const [customEventBuffer, setCustomEventBuffer] = useState(1);
  const [customReport, setCustomReport] = useState<SimulationCompareReport | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  async function loadReport(presetId: string, nextRunCount: number) {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ presetId, runCount: String(nextRunCount) });
      const response = await fetch(`/api/simulation/compare?${query.toString()}`);
      if (!response.ok) throw new Error("讀取模擬報表失敗");
      const result = (await response.json()) as SimulationCompareReport;
      setReport(result);
      setSelectedPresetId(result.presetId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "讀取模擬報表失敗");
    } finally {
      setLoading(false);
    }
  }

  async function loadBranchVerification(nextRunCount: number) {
    setBranchLoading(true);
    setBranchError(null);

    try {
      const query = new URLSearchParams({ runCount: String(Math.min(nextRunCount, 100)) });
      const response = await fetch(`/api/simulation/branch-verify?${query.toString()}`);
      if (!response.ok) throw new Error("讀取分支檢驗失敗");
      const result = (await response.json()) as SimulationBranchVerificationReport;
      setBranchReport(result);
    } catch (loadError) {
      setBranchError(loadError instanceof Error ? loadError.message : "讀取分支檢驗失敗");
    } finally {
      setBranchLoading(false);
    }
  }

  async function runCustomAiCompare() {
    if (new Set(customPriorityOrder).size !== customPriorityOrder.length) {
      setCustomError("自定義 AI 的決策順序不能重複，請改成三個不同優先順序。");
      return;
    }

    setCustomLoading(true);
    setCustomError(null);

    try {
      const response = await fetch("/api/simulation/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: "custom_ai_builder",
          runCount,
          variants: [
            {
              variantId: "current_mainline_ai",
              labelZh: "現行主線 AI",
              runCount,
              roomConfigPatch: {
                resourceCapMode: "uncapped",
                aiPolicyProfileId: "canonical_humanized",
              },
            },
            {
              variantId: "custom_ai_candidate",
              labelZh: customAiName.trim() || "自定義 AI",
              runCount,
              roomConfigPatch: {
                resourceCapMode: "uncapped",
                aiPolicyProfileId: "canonical_humanized",
              },
              customAiPolicy: {
                labelZh: customAiName.trim() || "自定義 AI",
                priorityOrder: customPriorityOrder,
                selfSafetyLine: customSelfSafetyLine,
                teamSafetyLine: customTeamSafetyLine,
                eventContributionBuffer: customEventBuffer,
              },
            },
          ],
        }),
      });
      if (!response.ok) throw new Error("讀取自定義 AI 模擬失敗");
      const result = (await response.json()) as SimulationCompareReport;
      setCustomReport(result);
    } catch (loadError) {
      setCustomError(loadError instanceof Error ? loadError.message : "讀取自定義 AI 模擬失敗");
    } finally {
      setCustomLoading(false);
    }
  }

  useEffect(() => {
    const presetIdFromQuery = searchParams.get("presetId");
    const runCountFromQuery = Number(searchParams.get("runCount") ?? runCount);
    const nextPresetId = presetIdFromQuery || selectedPresetId;
    const nextRunCount = Number.isFinite(runCountFromQuery) && runCountFromQuery > 0 ? runCountFromQuery : runCount;
    setSelectedPresetId(nextPresetId);
    setRunCount(nextRunCount);
    void loadReport(nextPresetId, nextRunCount);
    void loadBranchVerification(nextRunCount);
    void fetch("/api/simulation/benchmark")
      .then((response) => response.ok ? response.json() : null)
      .then((result) => setBenchmark(result as PythonBenchmarkReport | null))
      .catch(() => setBenchmark(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePreset = useMemo(
    () => report?.availablePresets.find((preset) => preset.presetId === selectedPresetId) ?? report?.availablePresets[0] ?? null,
    [report?.availablePresets, selectedPresetId],
  );

  const benchmarkTargetVariant = useMemo(() => {
    if (!report?.variants?.length) return null;
    return report.variants.find((variant) => variant.variantId === report.baselineVariantId) ?? report.variants[0];
  }, [report?.baselineVariantId, report?.variants]);

  const benchmarkComparisonRows = report?.benchmarkAlignment?.rows ?? [];
  const playtestRankedRows = useMemo(
    () => [...(report?.comparisonTable ?? [])].sort((a, b) => a.playtestFitScore - b.playtestFitScore || a.winRate - b.winRate),
    [report?.comparisonTable],
  );
  const cadenceFocusRounds = [4, 5, 6, 7];
  const hasDuplicateCustomPriorities = new Set(customPriorityOrder).size !== customPriorityOrder.length;
  const customPrioritySummary = customPriorityOrder
    .map((priority, index) => `${index + 1}. ${CUSTOM_AI_PRIORITY_OPTIONS.find((option) => option.value === priority)?.labelZh ?? priority}`)
    .join(" -> ");
  const customMainlineRow = customReport?.comparisonTable.find((row) => row.variantId === "current_mainline_ai") ?? null;
  const customCandidateRow = customReport?.comparisonTable.find((row) => row.variantId === "custom_ai_candidate") ?? null;

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-amber-700">守護之心模擬</p>
            <h1 className="text-3xl font-bold">守護之心｜AI 模擬比較報表</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              先看版本差異，再判斷要不要動規則或牌池。
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-7 text-sky-900 max-w-3xl">
            想快速看哪版更穩、哪版更接近首玩目標，先看「首玩體驗基準對照」和「版本總表」。
          </div>
          <div className="flex gap-3">
            <Link href="/" className="rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold">
              回房間入口
            </Link>
            <button
              type="button"
              onClick={() => void loadReport(selectedPresetId, runCount)}
              className="rounded-2xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "重新計算中..." : "重新跑比較"}
            </button>
            <button
              type="button"
              onClick={() => void loadBranchVerification(runCount)}
              className="rounded-2xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={branchLoading}
            >
              {branchLoading ? "檢驗分支中..." : "重新跑分支檢驗"}
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">模擬口徑</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-amber-900">
            {(report?.reportFormatZh ?? []).map((line, index) => (
              <li key={`evidence-${index}`}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm lg:grid-cols-[1.6fr_1fr]">
          <div>
            <h2 className="mb-3 text-lg font-semibold">比較設定</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                比較組
                <select
                  value={selectedPresetId}
                  onChange={(event) => setSelectedPresetId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3"
                >
                  {(report?.availablePresets ?? []).map((preset) => (
                    <option key={preset.presetId} value={preset.presetId}>
                      {preset.labelZh}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                局數
                <select
                  value={runCount}
                  onChange={(event) => setRunCount(Number(event.target.value))}
                  className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3"
                >
                  {RUN_COUNT_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value} 局
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
              <p className="font-semibold">目前比較組</p>
              <p className="mt-2">{activePreset?.descriptionZh ?? "正在載入比較組說明..."}</p>
              <p className="mt-2 text-xs text-amber-800">切換選單後再按「重新跑比較」即可。</p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
            <p className="font-semibold">怎麼看</p>
            <ul className="mt-2 list-disc pl-5">
              {(report?.reportFormatZh ?? []).map((line, index) => (
                <li key={`evidence-${index}`}>{line}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-stone-500">
              {report ? `報表時間：${new Date(report.generatedAt).toLocaleString("zh-TW")}` : "尚未取得報表"}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-xl font-semibold text-emerald-950">白話自定義 AI</h2>
              <p className="mt-2 text-sm leading-7 text-emerald-950">
                你可以直接幫 AI 取名字、排思考順序，然後看它的勝率。
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm leading-7 text-stone-700">
              <p className="font-semibold text-stone-900">目前順序</p>
              <p className="mt-1">{customPrioritySummary}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-emerald-200 bg-white p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-stone-800">
                  自定義 AI 名稱
                  <input
                    value={customAiName}
                    onChange={(event) => setCustomAiName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3"
                    placeholder="例如：穩健互助型"
                  />
                </label>
                <label className="text-sm font-medium text-stone-800">
                  自己至少保到
                  <select
                    value={customSelfSafetyLine}
                    onChange={(event) => setCustomSelfSafetyLine(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3"
                  >
                    <option value={1}>SR / SP 要大於 1</option>
                    <option value={2}>SR / SP 要大於 2</option>
                    <option value={3}>SR / SP 要大於 3</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-stone-800">
                  隊友至少保到
                  <select
                    value={customTeamSafetyLine}
                    onChange={(event) => setCustomTeamSafetyLine(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3"
                  >
                    <option value={1}>SR / SP 要大於 1</option>
                    <option value={2}>SR / SP 要大於 2</option>
                    <option value={3}>SR / SP 要大於 3</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-stone-800">
                  補事件時至少保留
                  <select
                    value={customEventBuffer}
                    onChange={(event) => setCustomEventBuffer(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3"
                  >
                    <option value={0}>不特別保留</option>
                    <option value={1}>至少保 1 點</option>
                    <option value={2}>至少保 2 點</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {customPriorityOrder.map((priority, index) => (
                  <label key={`custom-priority-${index}`} className="text-sm font-medium text-stone-800">
                    第 {index + 1} 優先
                    <select
                      value={priority}
                      onChange={(event) => {
                        const next = [...customPriorityOrder];
                        next[index] = event.target.value as CustomAiPriorityId;
                        setCustomPriorityOrder(next);
                      }}
                      className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3"
                    >
                      {CUSTOM_AI_PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.labelZh}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs leading-6 text-stone-500">
                      {CUSTOM_AI_PRIORITY_OPTIONS.find((option) => option.value === priority)?.noteZh ?? ""}
                    </p>
                  </label>
                ))}
              </div>

              {hasDuplicateCustomPriorities ? (
                <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  三個優先順序目前有重複；請改成三個不同選項。
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void runCustomAiCompare()}
                  className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={customLoading || hasDuplicateCustomPriorities}
                >
                  {customLoading ? "試跑中..." : "試跑這個 AI"}
                </button>
                <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs text-emerald-900">
                  會拿它和「現行主線 AI」並排比較
                </span>
              </div>
              {customError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{customError}</p> : null}
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm leading-7 text-stone-700">
              <p className="font-semibold text-stone-900">這個 AI 會怎麼想</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>自己資源線：SR / SP 要大於 {customSelfSafetyLine}</li>
                <li>隊友資源線：SR / SP 要大於 {customTeamSafetyLine}</li>
                <li>補事件時：至少保留 {customEventBuffer} 點資源</li>
                <li>每做完一個動作，下一輪會再從第一優先重新檢查</li>
              </ul>
              <p className="mt-4 text-xs leading-6 text-stone-500">
                這版先做成好懂的 MVP：你排的是思考順序，不是逐牌腳本。
              </p>
            </div>
          </div>

          {customReport && customCandidateRow && customMainlineRow ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <SummaryCard title="你的 AI 勝率" value={formatPercent(customCandidateRow.winRate)} note={customCandidateRow.labelZh} />
                <SummaryCard title="現行主線 AI" value={formatPercent(customMainlineRow.winRate)} note={customMainlineRow.labelZh} />
                <SummaryCard title="勝率差距" value={formatSignedNumber((customCandidateRow.winRate - customMainlineRow.winRate) * 100, 1) + "%"} note="你的 AI 減掉現行主線" />
                <SummaryCard title="平均完成任務差" value={formatSignedNumber(customCandidateRow.avgCompletedTasks - customMainlineRow.avgCompletedTasks)} note="你的 AI 減掉現行主線" />
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm leading-7 text-stone-700">
                  <p className="font-semibold text-stone-900">先看這四個數字就夠了</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    <li>{customCandidateRow.labelZh} 勝率：{formatPercent(customCandidateRow.winRate)}</li>
                    <li>平均完成任務：{formatNumber(customCandidateRow.avgCompletedTasks)}</li>
                    <li>平均解決事件數：{formatNumber(customCandidateRow.avgResolvedEventCount)}</li>
                    <li>平均存活回合：{formatNumber(customCandidateRow.avgSurvivalRounds)}</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm leading-7 text-stone-700">
                  <p className="font-semibold text-stone-900">系統摘要</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    {(customReport.summaryZh ?? []).slice(0, 3).map((line, index) => (
                      <li key={`custom-summary-${index}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard title="正式候選" value={benchmarkTargetVariant?.labelZh ?? report?.comparisonTable[0]?.labelZh ?? "載入中"} note={report?.presetLabelZh ?? ""} />
          <SummaryCard title="差距主因" value={report?.gapDiagnosis.dominantAxisLabelZh ?? "載入中"} note={report ? `信心值 ${formatNumber(report.gapDiagnosis.confidence)}` : "等待診斷"} />
          <SummaryCard title="比較局數" value={report?.variants[0] ? `${report.variants[0].runCount} 局 / 版本` : `${runCount} 局`} note="同一比較組內，每個版本都跑相同局數" />
          <SummaryCard title="比較版本數" value={report ? `${report.variants.length} 個` : "載入中"} note={report?.presetDescriptionZh ?? ""} />
        </section>

        <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-violet-950">AI 模擬分支檢驗</h2>
              <p className="mt-1 text-sm leading-7 text-violet-900">這裡會一起掃幾條重要分支，快速看哪條主線健康、哪條還偏離。</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-violet-700">
              {branchReport ? `${branchReport.runCount} 局 / 分支` : `最多 ${Math.min(runCount, 100)} 局 / 分支`}
            </span>
          </div>
          {branchError ? <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{branchError}</p> : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-2xl border border-violet-200 bg-white p-4 text-sm leading-7 text-stone-700">
              <p className="font-semibold text-stone-900">檢驗摘要</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                {(branchReport?.summaryZh ?? ["載入後會在這裡顯示目前健康、接近、偏離的分支數量與主建議。"]).map((line, index) => (
                  <li key={`branch-summary-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-violet-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-violet-100 bg-violet-50 text-left text-violet-900">
                    <th className="px-3 py-3">分支</th>
                    <th className="px-3 py-3">狀態</th>
                    <th className="px-3 py-3">正式候選</th>
                    <th className="px-3 py-3">勝率</th>
                    <th className="px-3 py-3">首玩適配</th>
                    <th className="px-3 py-3">Python 差距</th>
                    <th className="px-3 py-3">主因</th>
                  </tr>
                </thead>
                <tbody>
                  {(branchReport?.rows ?? []).map((row) => (
                    <tr key={row.presetId} className="border-b border-violet-100 align-top">
                      <td className="px-3 py-3 font-medium text-stone-900">{row.presetLabelZh}</td>
                      <td className="px-3 py-3"><FitStatusBadge status={row.status} /></td>
                      <td className="px-3 py-3">{row.baselineLabelZh}</td>
                      <td className="px-3 py-3">{formatPercent(row.winRate)}</td>
                      <td className="px-3 py-3">{formatNumber(row.playtestFitScore)}</td>
                      <td className="px-3 py-3">{formatNumber(row.benchmarkGapScore)}</td>
                      <td className="px-3 py-3">{row.dominantAxisLabelZh}</td>
                    </tr>
                  ))}
                  {!branchReport?.rows?.length ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-stone-500">
                    {branchLoading ? "分支檢驗計算中..." : "尚未取得分支結果。"}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          {branchReport?.rows?.length ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {branchReport.rows.map((row) => (
                <div key={`${row.presetId}-card`} className="rounded-2xl border border-violet-200 bg-white p-4 text-sm leading-7 text-stone-700">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-stone-900">{row.presetLabelZh}</p>
                    <FitStatusBadge status={row.status} />
                  </div>
                  <p className="mt-2 text-xs text-stone-500">正式候選：{row.baselineLabelZh}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {row.summaryZh.map((line, index) => (
                      <li key={`${row.presetId}-${index}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="text-lg font-semibold text-sky-950">先看這裡</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-sky-950">
              <li>先看「正式候選」：這是目前最推薦你優先採用的版本。</li>
              <li>再看「首玩體驗基準對照」：確認勝率、早崩、後移敗局與惜敗感是否接近目標。</li>
              <li>若你只想知道為什麼要選它，看「差距主因」與「重點摘要」。</li>
              <li>其餘表格多半是進階細節。</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-white p-4 text-sm leading-7 text-stone-700">
            <p className="font-semibold text-stone-900">先回答四個問題</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>哪個版本目前最好？</li>
              <li>它的勝率是多少？</li>
              <li>它是不是更接近首玩體驗目標？</li>
              <li>為什麼它比其他版本好？</li>
            </ol>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm lg:grid-cols-3">
          {(report?.summaryZh ?? []).map((line, index) => (
            <div key={`summary-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
              {line}
            </div>
          ))}
        </section>

        <section className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="mb-4 text-xl font-semibold">首玩體驗基準對照</h2>
            <p className="mb-4 text-sm leading-7 text-stone-600">先看是否貼近你拍板的首玩目標：40%–45% 勝率、少早崩、敗局後移，以及勝局常出現資源緊張時刻。</p>
            {report?.playtestAlignment ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-950">
                  <p className="font-semibold">正式候選：{report.playtestAlignment.baselineLabelZh}</p>
                  <p className="mt-1 text-xs">適配分數：{formatNumber(report.playtestAlignment.fitScore)}（越低越貼近你設定的首玩目標）</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {report.playtestAlignment.summaryZh.map((line, index) => (
                      <li key={`evidence-${index}`}>{line}</li>
                    ))}
                  </ul>
                </div>
                {report.playtestAlignment.rows.map((row, index) => (
                  <div key={`${row.metricId}-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-stone-900">{row.labelZh}</p>
                      <FitStatusBadge status={row.status} />
                    </div>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                      <p>目標：{row.targetZh}</p>
                      <p>目前：{row.valueZh}</p>
                      <p className="text-stone-600">{row.noteZh}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-500">尚未產生首玩對照。</p>
            )}
          </div>

          <div>
            <h2 className="mb-4 text-xl font-semibold">首玩適配排名</h2>
            <p className="mb-3 text-sm leading-7 text-stone-600">適配分數越低，代表越接近理想節奏。</p>
            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-3 py-3">版本</th>
                    <th className="px-3 py-3">適配分數</th>
                    <th className="px-3 py-3">勝率</th>
                    <th className="px-3 py-3">R1–R3 敗局</th>
                    <th className="px-3 py-3">R5–R7 敗局</th>
                    <th className="px-3 py-3">R6–R7 惜敗</th>
                    <th className="px-3 py-3">勝局緊張時刻</th>
                  </tr>
                </thead>
                <tbody>
                  {playtestRankedRows.map((row, index) => (
                    <tr key={`${row.variantId}-playtest-${index}`} className="border-b border-stone-100 align-top">
                      <td className="px-3 py-3 font-medium text-stone-900">{row.labelZh}</td>
                      <td className="px-3 py-3">{formatNumber(row.playtestFitScore)}</td>
                      <td className="px-3 py-3">{formatPercent(row.winRate)}</td>
                      <td className="px-3 py-3">{formatNullablePercent(row.earlyLossRate)}</td>
                      <td className="px-3 py-3">{formatNullablePercent(row.lateLossR57Rate)}</td>
                      <td className="px-3 py-3">{formatNullablePercent(row.lateLossR67Rate)}</td>
                      <td className="px-3 py-3">{formatNullablePercent(row.winResourceTensionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-6 text-stone-500">R5–R7 與 R6–R7 目前先用失敗回合代判節奏是否後移。</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">差距主因判斷</h2>
            {report?.gapDiagnosis ? (
              <div className="space-y-4 text-sm leading-7 text-stone-700">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <p className="font-semibold">{report.gapDiagnosis.dominantAxisLabelZh}</p>
                  <p className="mt-1 text-xs">基準版本：{report.gapDiagnosis.baselineLabelZh}｜信心值 {formatNumber(report.gapDiagnosis.confidence)}</p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-stone-700">判斷依據</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {report.gapDiagnosis.evidenceZh.map((line, index) => (
                      <li key={`evidence-${index}`}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-stone-700">下一刀建議</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {report.gapDiagnosis.nextStepsZh.map((line, index) => (
                      <li key={`evidence-${index}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500">尚未產生差距主因診斷。</p>
            )}
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">主因拆解影響排名</h2>
            {report?.gapDiagnosis?.variantImpacts?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="px-3 py-2">版本</th>
                      <th className="px-3 py-2">總解事件差</th>
                      <th className="px-3 py-2">存活回合差</th>
                      <th className="px-3 py-2">每存活回合差</th>
                      <th className="px-3 py-2">主軸</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.gapDiagnosis.variantImpacts.map((row, index) => (
                      <tr key={`${row.variantId}-${index}`} className="border-b border-stone-100">
                        <td className="px-3 py-2 font-medium text-stone-900">{row.labelZh}</td>
                        <td className="px-3 py-2">{formatSignedNumber(-row.totalResolvedDelta)}</td>
                        <td className="px-3 py-2">{formatSignedNumber(-row.survivalRoundsDelta)}</td>
                        <td className="px-3 py-2">{formatSignedNumber(-row.throughputDelta)}</td>
                        <td className="px-3 py-2">{row.primaryAxis === "survival_cadence" ? "生存節奏" : row.primaryAxis === "per_round_resolution" ? "每回合解題" : "混合"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-stone-500">目前這組模擬比較還不足以做主因拆解。</p>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">外部 Python 基準參照</h2>
            {benchmark ? (
              <div className="space-y-4 text-sm leading-7 text-stone-700">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="font-semibold">{benchmark.canonicalVersion}</p>
                  <p className="mt-1 text-xs">{benchmark.file}｜Python {benchmark.python}｜{benchmark.n} 局｜種子 {benchmark.seed}</p>
                  <p className="mt-2 text-xs">預設參照結果：{benchmark.defaultResultLabelZh}｜漏宣告率 {formatPercent(benchmark.defaultMissRate)}｜測試牌 {benchmark.defaultIncludeTestCards ? "包含" : "不含"}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left text-stone-500">
                        <th className="px-3 py-3">版本</th>
                        <th className="px-3 py-3">勝率</th>
                        <th className="px-3 py-3">平均完成任務</th>
                        <th className="px-3 py-3">0AP 相鄰互助</th>
                        <th className="px-3 py-3">漏宣告</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmark.comparisonMatrix.map((row, index) => (
                        <tr key={`${row.variantId}-${index}`} className="border-b border-stone-100">
                          <td className="px-3 py-3 font-medium text-stone-900">{row.labelZh}</td>
                          <td className="px-3 py-3">{formatPercent(row.winRate)}</td>
                          <td className="px-3 py-3">{formatNumber(row.avgCompletedMissions)}</td>
                          <td className="px-3 py-3">{formatNumber(row.avgZeroApMutualAid)}</td>
                          <td className="px-3 py-3">{formatNumber(row.avgMissedDeclarations)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-xs text-stone-600">
                  {benchmark.interpretationZh.map((line, index) => (
                    <li key={`evidence-${index}`}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-stone-500">尚未取得外部基準。</p>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">正式候選 vs 外部基準參照</h2>
            <p className="mb-4 text-sm leading-7 text-stone-600">這裡會拿目前正式候選，對照你上傳的 Python 主線預設結果。</p>
            {report?.benchmarkAlignment ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                <p className="font-semibold">最接近的 Python 參照版本：{report.benchmarkAlignment.closestPythonLabelZh}</p>
                <p className="mt-1 text-xs">差距分數：{formatNumber(report.benchmarkAlignment.gapScore)}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {report.benchmarkAlignment.summaryZh.map((line, index) => (
                    <li key={`evidence-${index}`}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-3">
              {benchmarkComparisonRows.length > 0 ? benchmarkComparisonRows.map((row, index) => (
                <div key={`${row.metricId}-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="font-semibold text-stone-900">{row.labelZh}</p>
                  <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                    <p>Python 基準：{formatBenchmarkMetricValue(row.metricId, row.pythonValue)}</p>
                    <p>目前基線：{formatBenchmarkMetricValue(row.metricId, row.webValue)}</p>
                    <p>差值：{row.deltaZh}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-stone-500">待目前報表與外部基準都載入後顯示。</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">版本總表</h2>
          <p className="mb-4 text-sm leading-7 text-stone-600">想快速比較版本差異，先看這裡即可。</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-3 py-3">版本</th>
                  <th className="px-3 py-3">勝率</th>
                  <th className="px-3 py-3">平均完成任務</th>
                  <th className="px-3 py-3">平均最終壓力</th>
                  <th className="px-3 py-3">事件解決率</th>
                  <th className="px-3 py-3">平均解決事件數</th>
                  <th className="px-3 py-3">平均事件數</th>
                  <th className="px-3 py-3">平均存活回合</th>
                  <th className="px-3 py-3">每存活回合解事件</th>
                  <th className="px-3 py-3">相鄰互助</th>
                  <th className="px-3 py-3">壓力 3+ 多人投入率</th>
                  <th className="px-3 py-3">壓力 6+ 任務宣告率</th>
                  <th className="px-3 py-3">陪伴使用</th>
                  <th className="px-3 py-3">最終 SR</th>
                  <th className="px-3 py-3">最終 SP</th>
                  <th className="px-3 py-3">SR 峰值</th>
                  <th className="px-3 py-3">SP 峰值</th>
                  <th className="px-3 py-3">首次進危險</th>
                  <th className="px-3 py-3">首次壓力 6</th>
                  <th className="px-3 py-3">進風險 / 回合</th>
                  <th className="px-3 py-3">風險停留 / 回合</th>
                </tr>
              </thead>
              <tbody>
                {(report?.comparisonTable ?? []).map((row, index) => (
                  <tr key={`${row.variantId}-comparison-${index}`} className="border-b border-stone-100 align-top">
                    <td className="px-3 py-3 font-medium text-stone-900">{row.labelZh}</td>
                    <td className="px-3 py-3">{formatPercent(row.winRate)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgCompletedTasks)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgFinalPressure)}</td>
                    <td className="px-3 py-3">{formatPercent(row.avgResolvedEventRate)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgResolvedEventCount)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgEventCount)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgSurvivalRounds)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgResolvedEventsPerSurvivalRound)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgAdjacentHelpCount)}</td>
                    <td className="px-3 py-3">{formatPercent(row.avgPressure3MultiContributorRate)}</td>
                    <td className="px-3 py-3">{formatPercent(row.avgPressure6DeclareRate)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgCompanionUseCount)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgFinalSrTotal)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgFinalSpTotal)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgPeakSrTotal)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgPeakSpTotal)}</td>
                    <td className="px-3 py-3">{formatNullableNumber(row.avgFirstDangerRound)}</td>
                    <td className="px-3 py-3">{formatNullableNumber(row.avgFirstPressure6Round)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgMovedIntoRiskPerRound)}</td>
                    <td className="px-3 py-3">{formatNumber(row.avgRiskCampersPerRound)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">相對基線差值</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-3 py-3">版本</th>
                  <th className="px-3 py-3">勝率 Δ</th>
                  <th className="px-3 py-3">任務完成 Δ</th>
                  <th className="px-3 py-3">最終壓力 Δ</th>
                  <th className="px-3 py-3">事件解決率 Δ</th>
                  <th className="px-3 py-3">解決事件數 Δ</th>
                  <th className="px-3 py-3">平均事件數 Δ</th>
                  <th className="px-3 py-3">存活回合 Δ</th>
                  <th className="px-3 py-3">每存活回合解事件 Δ</th>
                  <th className="px-3 py-3">相鄰互助 Δ</th>
                  <th className="px-3 py-3">壓力 3+ 多人投入率 Δ</th>
                  <th className="px-3 py-3">壓力 6+ 任務宣告率 Δ</th>
                  <th className="px-3 py-3">陪伴使用 Δ</th>
                  <th className="px-3 py-3">最終 SR Δ</th>
                  <th className="px-3 py-3">最終 SP Δ</th>
                  <th className="px-3 py-3">SR 峰值 Δ</th>
                  <th className="px-3 py-3">SP 峰值 Δ</th>
                  <th className="px-3 py-3">首次進危險 Δ</th>
                  <th className="px-3 py-3">首次壓力 6 Δ</th>
                  <th className="px-3 py-3">進風險 / 回合 Δ</th>
                  <th className="px-3 py-3">風險停留 / 回合 Δ</th>
                </tr>
              </thead>
              <tbody>
                {(report?.deltasFromFirstVariant ?? []).map((row, index) => (
                  <tr key={`${row.variantId}-delta-${index}`} className="border-b border-stone-100 align-top">
                    <td className="px-3 py-3 font-medium text-stone-900">{row.labelZh}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.winRateDelta * 100, 1)}%</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.completedTasksDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.finalPressureDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.resolvedEventRateDelta * 100, 1)}%</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.resolvedEventCountDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.eventCountDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.survivalRoundsDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.resolvedEventsPerSurvivalRoundDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.adjacentHelpDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.pressure3MultiContributorDelta * 100, 1)}%</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.pressure6DeclareDelta * 100, 1)}%</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.companionUseDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.finalSrDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.finalSpDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.peakSrDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.peakSpDelta)}</td>
                    <td className="px-3 py-3">{formatNullableSignedNumber(row.firstDangerRoundDelta)}</td>
                    <td className="px-3 py-3">{formatNullableSignedNumber(row.firstPressure6RoundDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.movedIntoRiskDelta)}</td>
                    <td className="px-3 py-3">{formatSignedNumber(row.riskCampersDelta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {(report?.variants ?? []).map((variant, variantIndex) => (
            <div key={`${variant.variantId}-${variantIndex}`} className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">{variant.labelZh}</h2>
              <p className="mb-4 text-sm text-stone-500">局數：{variant.runCount} 局</p>

              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <MiniStat label="勝場數" value={`${variant.winCount}`} />
                <MiniStat label="平均宣告任務" value={formatNumber(variant.avgDeclaredTasks)} />
                <MiniStat label="平均多人投入事件" value={formatNumber(variant.avgMultiContributorEvents)} />
                <MiniStat label="平均陪伴使用" value={formatNumber(variant.avgCompanionUseCount)} />
                <MiniStat label="平均事件數" value={formatNumber(variant.avgEventCount)} />
                <MiniStat label="平均存活回合" value={formatNumber(variant.avgSurvivalRounds)} />
                <MiniStat label="每存活回合解事件" value={formatNumber(variant.avgResolvedEventsPerSurvivalRound)} />
                <MiniStat label="壓力 3+ 多人投入率" value={formatPercent(variant.avgPressure3MultiContributorRate)} />
                <MiniStat label="壓力 6+ 任務宣告率" value={formatPercent(variant.avgPressure6DeclareRate)} />
                <MiniStat label="平均失敗回合" value={formatNullableNumber(variant.avgFailureRound)} />
              </div>

              <h3 className="mb-3 text-sm font-semibold text-stone-700">失敗原因分布</h3>
              <div className="mb-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <tbody>
                    {Object.entries(variant.failureReasons).map(([reason, count]) => (
                      <tr key={reason} className="border-b border-stone-100">
                        <td className="px-3 py-2 text-stone-600">{FAILURE_REASON_LABEL_ZH[reason as SimulationFailureReason]}</td>
                        <td className="px-3 py-2 font-medium text-stone-900">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-stone-700">失敗回合分布</h3>
              <div className="mb-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="px-3 py-2">回合</th>
                      <th className="px-3 py-2">敗局數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variant.failureRoundHistogram.length > 0 ? variant.failureRoundHistogram.map((row, index) => (
                      <tr key={`${variant.variantId}-failure-round-${row.round}-${index}`} className="border-b border-stone-100">
                        <td className="px-3 py-2">{row.round}</td>
                        <td className="px-3 py-2">{row.count}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="px-3 py-2 text-stone-500" colSpan={2}>這個版本本輪沒有敗局，暫時沒有失敗回合分布。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>


              <h3 className="mb-3 text-sm font-semibold text-stone-700">崩盤訊號</h3>
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <MiniStat label="首次進危險回合" value={formatNullableNumber(variant.avgFirstDangerRound)} />
                <MiniStat label="首次壓力達 6 回合" value={formatNullableNumber(variant.avgFirstPressure6Round)} />
                <MiniStat label="每回合進風險次數" value={formatNumber(variant.avgMovedIntoRiskPerRound)} />
                <MiniStat label="每回合風險停留人次" value={formatNumber(variant.avgRiskCampersPerRound)} />
              </div>

              <div className="mb-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-stone-700">首次進危險分布</p>
                  <table className="min-w-full text-sm">
                    <tbody>
                      {variant.firstDangerRoundHistogram.length > 0 ? variant.firstDangerRoundHistogram.map((row, index) => (
                        <tr key={`${variant.variantId}-danger-${row.round}-${index}`} className="border-b border-stone-100">
                          <td className="px-2 py-2">R{row.round}</td>
                          <td className="px-2 py-2">{row.count}</td>
                        </tr>
                      )) : (
                        <tr><td className="px-2 py-2 text-stone-500" colSpan={2}>尚未出現危險訊號。</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-stone-700">首次壓力達 6 分布</p>
                  <table className="min-w-full text-sm">
                    <tbody>
                      {variant.firstPressure6RoundHistogram.length > 0 ? variant.firstPressure6RoundHistogram.map((row, index) => (
                        <tr key={`${variant.variantId}-pressure6-${row.round}-${index}`} className="border-b border-stone-100">
                          <td className="px-2 py-2">R{row.round}</td>
                          <td className="px-2 py-2">{row.count}</td>
                        </tr>
                      )) : (
                        <tr><td className="px-2 py-2 text-stone-500" colSpan={2}>尚未進入壓力 6。</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-stone-700">先崩軸分布</p>
                  <table className="min-w-full text-sm">
                    <tbody>
                      {variant.firstAxisBrinkCounts.map((row, index) => (
                        <tr key={`${variant.variantId}-axis-${row.axis}-${index}`} className="border-b border-stone-100">
                          <td className="px-2 py-2">{row.axis}</td>
                          <td className="px-2 py-2">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-stone-700">固定回合截斷 / 生存節奏</h3>
              <div className="mb-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="px-3 py-2">回合</th>
                      <th className="px-3 py-2">存活率</th>
                      <th className="px-3 py-2">累積解決事件</th>
                      <th className="px-3 py-2">累積事件數</th>
                      <th className="px-3 py-2">累積解決率</th>
                      <th className="px-3 py-2">本回合解決事件</th>
                      <th className="px-3 py-2">本回合解決率</th>
                      <th className="px-3 py-2">回合末 SR</th>
                      <th className="px-3 py-2">回合末 SP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variant.roundCadenceRows.filter((row) => cadenceFocusRounds.includes(row.round)).map((row, index) => (
                      <tr key={`${variant.variantId}-cadence-${row.round}-${index}`} className="border-b border-stone-100">
                        <td className="px-3 py-2">R{row.round}</td>
                        <td className="px-3 py-2">{formatPercent(row.survivalRate)}</td>
                        <td className="px-3 py-2">{formatNumber(row.avgResolvedEventsByEnd)}</td>
                        <td className="px-3 py-2">{formatNumber(row.avgEventCountByEnd)}</td>
                        <td className="px-3 py-2">{formatPercent(row.avgResolvedRateByEnd)}</td>
                        <td className="px-3 py-2">{formatNumber(row.avgResolvedThisRound)}</td>
                        <td className="px-3 py-2">{formatPercent(row.avgEventResolvedRateThisRound)}</td>
                        <td className="px-3 py-2">{formatNumber(row.avgSrTotalAtEnd)}</td>
                        <td className="px-3 py-2">{formatNumber(row.avgSpTotalAtEnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-stone-700">AI 決策複檢</h3>
              <div className="mb-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-stone-700">任務宣告次數（每局平均）</p>
                  <table className="min-w-full text-sm">
                    <tbody>
                      {variant.taskDeclarationCounts.length > 0 ? variant.taskDeclarationCounts.map((row, index) => (
                        <tr key={`${variant.variantId}-task-${row.taskId}-${index}`} className="border-b border-stone-100">
                          <td className="px-2 py-2">{row.nameZh}</td>
                          <td className="px-2 py-2">{row.count}</td>
                          <td className="px-2 py-2">{formatPercent(row.ratePerGame)}</td>
                        </tr>
                      )) : (
                        <tr><td className="px-2 py-2 text-stone-500" colSpan={3}>本輪沒有任務宣告紀錄。</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-stone-700">敗局前一輪常見操作</p>
                  <table className="min-w-full text-sm">
                    <tbody>
                      {variant.preLossStrategicTop.length > 0 ? variant.preLossStrategicTop.map((row, index) => (
                        <tr key={`${variant.variantId}-preloss-${row.key}-${index}`} className="border-b border-stone-100">
                          <td className="px-2 py-2">{row.key}</td>
                          <td className="px-2 py-2">{row.count}</td>
                          <td className="px-2 py-2">{formatPercent(row.rate)}</td>
                        </tr>
                      )) : (
                        <tr><td className="px-2 py-2 text-stone-500" colSpan={3}>目前沒有敗局前一輪動作紀錄。</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-stone-700">目前最可能造成過穩的三個原因</h3>
              <ul className="mb-5 list-disc space-y-2 pl-5 text-sm leading-7 text-stone-700">
                {variant.topLikelyOverstableCausesZh.map((line, index) => (
                  <li key={`${variant.variantId}-cause-${index}`}>{line}</li>
                ))}
              </ul>

              <h3 className="mb-3 text-sm font-semibold text-stone-700">事件檢查（優先看解決率最低）</h3>
              <div className="mb-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="px-3 py-2">事件</th>
                      <th className="px-3 py-2">抽到次數</th>
                      <th className="px-3 py-2">解決率</th>
                      <th className="px-3 py-2">未解次數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...variant.eventDebug]
                      .filter((event) => event.seenCount > 0)
                      .sort((a, b) => a.resolvedRate - b.resolvedRate || b.seenCount - a.seenCount)
                      .map((event, index) => (
                        <tr key={`${variant.variantId}-${event.cardId}-${index}`} className="border-b border-stone-100">
                          <td className="px-3 py-2 font-medium text-stone-900">{event.nameZh}</td>
                          <td className="px-3 py-2">{event.seenCount}</td>
                          <td className="px-3 py-2">{formatPercent(event.resolvedRate)}</td>
                          <td className="px-3 py-2">{event.unresolvedCount}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-stone-700">每回合平均資源曲線</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="px-3 py-2">回合</th>
                      <th className="px-3 py-2">平均 SR 總量</th>
                      <th className="px-3 py-2">平均 SP 總量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variant.avgRoundResourceTotals.map((row, index) => (
                      <tr key={`${variant.variantId}-${row.round}-${index}`} className="border-b border-stone-100">
                        <td className="px-3 py-2">{row.round}</td>
                        <td className="px-3 py-2">{formatNumber(row.avgSrTotal)}</td>
                        <td className="px-3 py-2">{formatNumber(row.avgSpTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

const FAILURE_REASON_LABEL_ZH: Record<SimulationFailureReason, string> = {
  pressure_overflow: "壓力到頂",
  sr_zero: "SR 歸零",
  sp_zero: "SP 歸零",
  task_shortfall: "任務未達標",
  unknown: "未知中斷",
};

function SummaryCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-stone-500">{title}</p>
      <p className="mt-3 text-2xl font-bold text-stone-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{note}</p>
    </div>
  );
}

function FitStatusBadge({ status }: { status: SimulationPlaytestFitStatus }) {
  const label = status === "pass" ? "達標" : status === "near" ? "接近" : "未達";
  const className = status === "pass"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "near"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-rose-200 bg-rose-50 text-rose-700";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-stone-900">{value}</p>
    </div>
  );
}
