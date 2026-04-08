import { buildPresetVariants, runSimulationCompare } from './src/domain/guardian-heart/testing/ai-simulation';
const report = runSimulationCompare(buildPresetVariants('canonical_v2e_refinement', 200), { presetId:'canonical_v2e_refinement', seed:20260401 });
console.log('v2e baseline', report.baselineVariantId, report.variants[0].variantId, report.variants.map(v=>v.variantId).join(','));
const gap = runSimulationCompare(buildPresetVariants('gap_root_cause_alignment', 100), { presetId:'gap_root_cause_alignment', seed:20260401 });
console.log('gap baseline', gap.baselineVariantId, gap.gapDiagnosis?.dominantAxis, gap.gapDiagnosis?.confidence);
console.log(gap.gapDiagnosis?.variantImpacts.map(v=>`${v.variantId}:${v.primaryAxis}`).join(' | '));
