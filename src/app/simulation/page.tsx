import { Suspense } from "react";
import { SimulationReportClient } from "@/components/guardian-heart/simulation-report-client";

export default function SimulationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-stone-100 px-6 py-10 text-stone-900">
          <div className="mx-auto max-w-7xl rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-600 shadow-sm">
            正在載入 AI 模擬報表...
          </div>
        </main>
      }
    >
      <SimulationReportClient />
    </Suspense>
  );
}
