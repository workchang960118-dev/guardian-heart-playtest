import { runSimulationCompare } from './src/domain/guardian-heart/testing/ai-simulation';
const variants = [
  { variantId: 'solver_baseline_current_rules', labelZh: 'Solver 基線（現行規則）', runCount: 300, roomConfigPatch: { resourceCapMode: 'uncapped', aiPolicyProfileId: 'solver_baseline' } },
  { variantId: 'canonical_humanized_current_rules', labelZh: 'Canonical Humanized（舊候選）', runCount: 300, roomConfigPatch: { resourceCapMode: 'uncapped', aiPolicyProfileId: 'canonical_humanized' } },
  { variantId: 'canonical_humanized_v2f_current_rules', labelZh: 'Canonical Humanized v2f（現行 v5 主線 AI）', runCount: 300, roomConfigPatch: { resourceCapMode: 'uncapped', aiPolicyProfileId: 'canonical_humanized_v2f' } },
];
const report = runSimulationCompare(variants as any, { presetId: 'custom_ai_check', seed: 20260326 });
console.log(JSON.stringify(report, null, 2));
