import { buildPresetVariants, runSimulationCompare } from './src/domain/guardian-heart/testing/ai-simulation';
const report = runSimulationCompare(buildPresetVariants('survival_cadence_alignment', 200), {presetId:'survival_cadence_alignment', seed:20260401});
console.log(JSON.stringify(report.comparisonTable, null, 2));
