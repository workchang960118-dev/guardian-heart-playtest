import { buildPresetVariants, runSimulationCompare, getSimulationComparePresetDefinitions } from "../src/domain/guardian-heart/testing/ai-simulation";
import fs from 'fs';

const seed = 20260326;
const runCount = 500;
const presets = getSimulationComparePresetDefinitions().map((p) => p.presetId);

function pct(v:number){return `${(v*100).toFixed(1)}%`;}
function num(v:number|null|undefined){return v==null?'—':v.toFixed(2);}

let md = `# Guardian Heart｜simulation compare 收斂檢查（13B-4A）\n\n`;
md += `- seed: ${seed}\n- runCount: ${runCount} / 版本\n- 版本基底：13B-4A\n- 說明：這份報告已包含事件 debug 與失敗回合分布，用來檢查近期修正後的規則口徑是否收斂。\n\n`;

for (const presetId of presets) {
  const report = runSimulationCompare(buildPresetVariants(presetId, runCount), { presetId, seed });
  md += `## ${report.presetLabelZh}（${presetId}）\n\n`;
  md += `${report.presetDescriptionZh}\n\n`;
  md += `### 摘要\n`;
  for (const line of report.summaryZh) md += `- ${line}\n`;
  md += `\n### 版本主表\n\n`;
  md += `| 版本 | 勝率 | 平均完成任務 | 平均最終壓力 | 事件解決率 | 平均事件數 | 相鄰互助 | 平均失敗回合 |\n`;
  md += `|---|---:|---:|---:|---:|---:|---:|---:|\n`;
  for (const v of report.variants) {
    md += `| ${v.labelZh} | ${pct(v.winRate)} | ${num(v.avgCompletedTasks)} | ${num(v.avgFinalPressure)} | ${pct(v.avgResolvedEventRate)} | ${num(v.avgEventCount)} | ${num(v.avgAdjacentHelpCount)} | ${num(v.avgFailureRound)} |\n`;
  }
  md += `\n`;
  for (const v of report.variants) {
    const weakest = [...v.eventDebug].filter(e=>e.seenCount>0).sort((a,b)=>a.resolvedRate-b.resolvedRate || b.seenCount-a.seenCount).slice(0,3);
    md += `### ${v.labelZh}｜事件 debug\n\n`;
    md += `| 事件 | 抽到次數 | 解決率 | 未解次數 |\n`;
    md += `|---|---:|---:|---:|\n`;
    for (const e of weakest) md += `| ${e.nameZh} | ${e.seenCount} | ${pct(e.resolvedRate)} | ${e.unresolvedCount} |\n`;
    md += `\n`;
    md += `失敗回合分布：`;
    if (v.failureRoundHistogram.length === 0) md += `本輪無敗局。\n\n`;
    else md += `${v.failureRoundHistogram.map(r=>`R${r.round}:${r.count}`).join('、')}\n\n`;
  }
}

fs.writeFileSync('/mnt/data/guardian-heart-simulation-compare-4A.md', md);
console.log(md);
