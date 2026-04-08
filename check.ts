import {runSimulationCompare, buildPresetVariants} from './src/domain/guardian-heart/testing/ai-simulation';
const r=runSimulationCompare(buildPresetVariants('cap_mode_baseline', 500),{presetId:'cap_mode_baseline', seed:20260326});
console.log(JSON.stringify(r.comparisonTable,null,2));
