import { buildPresetVariants, runSimulationCompare } from '../src/domain/guardian-heart/testing/ai-simulation';
import fs from 'fs';

const runCount = Number(process.argv[2] || 100);
const seed = Number(process.argv[3] || 20260401);
const presetId = 'tuning_axes_v5';
const report = runSimulationCompare(buildPresetVariants(presetId, runCount), { presetId, seed });
fs.writeFileSync(`/mnt/data/tuning_axes_v5_report_${runCount}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  presetId: report.presetId,
  runCount,
  seed,
  summaryZh: report.summaryZh,
  variants: report.variants.map(v => ({
    variantId: v.variantId,
    labelZh: v.labelZh,
    winRate: v.winRate,
    avgFailureRound: v.avgFailureRound,
    avgResolvedEventRate: v.avgResolvedEventRate,
    avgFinalPressure: v.avgFinalPressure,
    avgCompletedTasks: v.avgCompletedTasks,
    playtestFitScore: (v as any).playtestFitScore,
    playtestAlignment: (v as any).playtestAlignment,
  })),
  baselineVariantId: report.baselineVariantId,
  gapDiagnosis: report.gapDiagnosis,
  playtestAlignment: (report as any).playtestAlignment,
}, null, 2));
