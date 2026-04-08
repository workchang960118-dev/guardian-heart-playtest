import { buildPresetVariants, runSimulationCompare } from './src/domain/guardian-heart/testing/ai-simulation';
const report = runSimulationCompare(buildPresetVariants('canonical_v2f_refinement', 300), { presetId: 'canonical_v2f_refinement', seed: 20260326 });
console.log(JSON.stringify(report, null, 2));
