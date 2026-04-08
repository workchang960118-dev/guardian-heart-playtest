import { buildPresetVariants, runSimulationCompare } from './src/domain/guardian-heart/testing/ai-simulation';
const report = runSimulationCompare(buildPresetVariants('ai_policy_alignment', 300), { presetId: 'ai_policy_alignment', seed: 20260326 });
console.log(JSON.stringify(report, null, 2));
