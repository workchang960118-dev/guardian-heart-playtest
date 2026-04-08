export type PythonMainlineBenchmarkMatrixRow = {
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

export type PythonMainlineBenchmarkReport = {
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
  result: PythonMainlineBenchmarkMatrixRow;
  comparisonMatrix: PythonMainlineBenchmarkMatrixRow[];
  interpretationZh: string[];
};

export const PYTHON_MAINLINE_BENCHMARK: PythonMainlineBenchmarkReport = {
  canonicalVersion: "v2.6-mainline-parametric",
  file: "guardian_heart_ai_sim_mainline_v2_6.py",
  python: "3.13.5",
  n: 500,
  seed: 20260326,
  defaultIncludeTestCards: true,
  defaultMissRate: 0.15,
  sha256: "91e523c82608c8215bbd6aff2a8c113284f4c396e3916720c59a7b7f743a4d28",
  defaultResultVariantId: "full6_miss15",
  defaultResultLabelZh: "全任務 6 張＋漏宣告率 15%",
  result: {
    variantId: "full6_miss15",
    labelZh: "全任務 6 張＋漏宣告率 15%",
    avgCompletedMissions: 4.032,
    avgMissedDeclarations: 0.674,
    avgPressure3MultiContributorRate: 0.738,
    avgPressure6DeclareRate: 0.048,
    avgResolvedEvents: 4.522,
    avgZeroApMutualAid: 5.302,
    failureNone: 0.156,
    failureSpZero: 0.248,
    failureSrZero: 0.596,
    winRate: 0.156,
  },
  comparisonMatrix: [
    {
      variantId: "core5_miss0",
      labelZh: "核心任務 5 張＋漏宣告率 0%",
      avgCompletedMissions: 4.29,
      avgMissedDeclarations: 0,
      avgPressure3MultiContributorRate: 0.7028333333333333,
      avgPressure6DeclareRate: 0.008,
      avgResolvedEvents: 4.382,
      avgZeroApMutualAid: 4.77,
      failureNone: 0.142,
      failureSpZero: 0.272,
      failureSrZero: 0.586,
      winRate: 0.142,
    },
    {
      variantId: "core5_miss15",
      labelZh: "核心任務 5 張＋漏宣告率 15%",
      avgCompletedMissions: 3.912,
      avgMissedDeclarations: 0.642,
      avgPressure3MultiContributorRate: 0.7028333333333333,
      avgPressure6DeclareRate: 0.03,
      avgResolvedEvents: 4.382,
      avgZeroApMutualAid: 4.77,
      failureNone: 0.142,
      failureSpZero: 0.272,
      failureSrZero: 0.586,
      winRate: 0.142,
    },
    {
      variantId: "full6_miss0",
      labelZh: "全任務 6 張＋漏宣告率 0%",
      avgCompletedMissions: 4.398,
      avgMissedDeclarations: 0,
      avgPressure3MultiContributorRate: 0.738,
      avgPressure6DeclareRate: 0.006,
      avgResolvedEvents: 4.522,
      avgZeroApMutualAid: 5.302,
      failureNone: 0.156,
      failureSpZero: 0.248,
      failureSrZero: 0.596,
      winRate: 0.156,
    },
    {
      variantId: "full6_miss15",
      labelZh: "全任務 6 張＋漏宣告率 15%",
      avgCompletedMissions: 4.032,
      avgMissedDeclarations: 0.674,
      avgPressure3MultiContributorRate: 0.738,
      avgPressure6DeclareRate: 0.048,
      avgResolvedEvents: 4.522,
      avgZeroApMutualAid: 5.302,
      failureNone: 0.156,
      failureSpZero: 0.248,
      failureSrZero: 0.596,
      winRate: 0.156,
    },
  ],
  interpretationZh: [
    "這份外部 benchmark 目前最能直接對照的是勝率、平均完成任務數、0AP 相鄰互助次數。",
    "avgResolvedEvents 是事件解決數，不是事件解決率；若要一對一對比，需再補同口徑欄位。",
    "目前 default result 為 full6_miss15，可視為 Python 主線模擬在 500 局、含測試牌、漏宣告率 15% 下的參考點。",
  ],
};
