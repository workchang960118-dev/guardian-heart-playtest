import { buildPresetVariants, runSimulationCompare } from './src/domain/guardian-heart/testing/ai-simulation';
import { PYTHON_MAINLINE_BENCHMARK } from './src/domain/guardian-heart/seeds/simulation/python-mainline-benchmark';
const preset = process.argv[2] ?? 'canonical_v2d_refinement';
const n = Number(process.argv[3] ?? '150');
const report = runSimulationCompare(buildPresetVariants(preset, n), { presetId: preset, seed: 20260401 });
for (const v of report.variants) {
  const score = Math.abs(v.winRate - PYTHON_MAINLINE_BENCHMARK.result.winRate)
    + Math.abs(v.avgCompletedTasks - PYTHON_MAINLINE_BENCHMARK.result.avgCompletedMissions)
    + Math.abs(v.avgAdjacentHelpCount - PYTHON_MAINLINE_BENCHMARK.result.avgZeroApMutualAid)
    + Math.abs(v.avgResolvedEventCount - PYTHON_MAINLINE_BENCHMARK.result.avgResolvedEvents)
    + Math.abs(v.avgPressure3MultiContributorRate - PYTHON_MAINLINE_BENCHMARK.result.avgPressure3MultiContributorRate)
    + Math.abs(v.avgPressure6DeclareRate - PYTHON_MAINLINE_BENCHMARK.result.avgPressure6DeclareRate);
  console.log(v.variantId, v.labelZh, score.toFixed(4), JSON.stringify({win:v.winRate,tasks:v.avgCompletedTasks,help:v.avgAdjacentHelpCount,total:v.avgResolvedEventCount,p3:v.avgPressure3MultiContributorRate,p6:v.avgPressure6DeclareRate}));
}
