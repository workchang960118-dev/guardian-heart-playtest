import { MVP_READINESS_MATRIX } from "../src/domain/guardian-heart/testing/mvp-readiness-matrix.ts";

console.log("Guardian Heart MVP｜10A 最終 readiness 盤點
");
for (const entry of MVP_READINESS_MATRIX) {
  const icon = entry.status === "done" ? "[DONE]" : "[PENDING]";
  console.log(`${icon} ${entry.titleZh}`);
  console.log(`  - ${entry.noteZh}`);
}
