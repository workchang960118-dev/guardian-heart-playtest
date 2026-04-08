import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const filePath = resolve(process.cwd(), "src/domain/guardian-heart/testing/mvp-gap-registry.ts");
const source = readFileSync(filePath, "utf8");

const transpiled = source
  .replace(/export type[\s\S]*?;\n/g, "")
  .replace(/export const MVP_GAP_REGISTRY =/, "globalThis.MVP_GAP_REGISTRY =");

const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(transpiled, context);

const registry = context.globalThis.MVP_GAP_REGISTRY ?? [];

console.log("\nGuardian Heart Multiplayer MVP｜7B 缺口補單\n");
for (const gap of registry) {
  console.log(`[${gap.priority}] ${gap.id}`);
  console.log(`- 區域：${gap.area}`);
  console.log(`- 標題：${gap.titleZh}`);
  console.log(`- 摘要：${gap.summaryZh}`);
  console.log(`- 阻斷 MVP：${gap.blocksMvp ? "yes" : "no"}`);
  console.log(`- 阻斷 AI 模擬：${gap.blocksAiSimulation ? "yes" : "no"}`);
  console.log(`- 建議下一步：${gap.suggestedNextStepZh}`);
  console.log("");
}
