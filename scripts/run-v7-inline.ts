import { buildPresetVariants, runSimulationCompare } from '../src/domain/guardian-heart/testing/ai-simulation';
import fs from 'fs';

const runCount = Number(process.argv[2] ?? '120');
const seed = Number(process.argv[3] ?? '20260326');
const presetId = 'tuning_axes_v7';
const report = runSimulationCompare(buildPresetVariants(presetId, runCount), { presetId, seed });
fs.writeFileSync(`/mnt/data/tuning_axes_v7_report_${runCount}.json`, JSON.stringify(report, null, 2));

const lines: string[] = [];
lines.push(`# tuning_axes_v7｜${runCount}局摘要`);
lines.push(``);
lines.push(`- seed: ${seed}`);
lines.push(`- baseline candidate: ${report.playtestAlignment.baselineLabelZh}`);
lines.push(`- baseline fit score: ${report.playtestAlignment.fitScore.toFixed(3)}`);
lines.push(``);
for (const v of report.variants) {
  lines.push(`## ${v.labelZh}`);
  lines.push(`- 勝率：${(v.winRate * 100).toFixed(1)}%`);
  lines.push(`- fit score：${v.playtestFitScore.toFixed(3)}`);
  lines.push(`- 平均敗局回合：${v.avgFailureRound == null ? '—' : v.avgFailureRound.toFixed(2)}`);
  lines.push(`- R1–R3 敗局占比：${v.earlyLossRate == null ? '—' : `${(v.earlyLossRate * 100).toFixed(1)}%`}`);
  lines.push(`- R5–R7 敗局占比：${v.lateLossR57Rate == null ? '—' : `${(v.lateLossR57Rate * 100).toFixed(1)}%`}`);
  lines.push(`- R6–R7 惜敗 proxy：${v.lateLossR67Rate == null ? '—' : `${(v.lateLossR67Rate * 100).toFixed(1)}%`}`);
  lines.push(`- 勝局緊張時刻 proxy：${v.winResourceTensionRate == null ? '—' : `${(v.winResourceTensionRate * 100).toFixed(1)}%`}`);
  lines.push('');
}
fs.writeFileSync(`/mnt/data/tuning_axes_v7_summary_${runCount}.md`, lines.join('\n'));
console.log(lines.join('\n'));
