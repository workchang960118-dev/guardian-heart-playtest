import { buildPresetVariants, runSimulationCompare } from './src/domain/guardian-heart/testing/ai-simulation';
const preset = process.argv[2] ?? 'canonical_v2c_refinement';
const n = Number(process.argv[3] ?? '100');
const report = runSimulationCompare(buildPresetVariants(preset, n), { presetId: preset, seed: 20260401 });
console.log('preset', preset, 'baseline', report.baselineVariantId);
for (const v of report.variants) {
  const align = report.benchmarkAlignment.baselineVariantId===v.variantId ? report.benchmarkAlignment.gapScore : null;
  console.log(JSON.stringify({variantId:v.variantId,label:v.labelZh,win:v.winRate,survival:v.avgSurvivalRounds,throughput:v.avgResolvedEventsPerSurvivalRound,total:v.avgResolvedEventCount,help:v.avgAdjacentHelpCount,comp:v.avgCompanionUseCount,mpr:v.avgMovedIntoRiskPerRound,p3:v.avgPressure3MultiContributorRate,p6:v.avgPressure6DeclareRate,gapScore:align}, null, 2));
}
console.log('diag', report.gapDiagnosis.dominantAxis, report.gapDiagnosis.confidence);
