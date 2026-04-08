import { NextResponse } from "next/server";
import {
  DEFAULT_SIMULATION_BRANCH_PRESET_IDS,
  runSimulationBranchVerification,
} from "@/domain/guardian-heart/testing/ai-simulation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runCount = Number(url.searchParams.get("runCount") ?? 50);
  const seed = Number(url.searchParams.get("seed") ?? 20260401);
  const presetIds = url.searchParams.getAll("presetId");
  const report = runSimulationBranchVerification({
    presetIds: presetIds.length > 0 ? presetIds : [...DEFAULT_SIMULATION_BRANCH_PRESET_IDS],
    runCount,
    seed,
  });
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const runCount = Number(body?.runCount ?? 50);
  const seed = Number(body?.seed ?? 20260401);
  const presetIds = Array.isArray(body?.presetIds)
    ? body.presetIds.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
    : [...DEFAULT_SIMULATION_BRANCH_PRESET_IDS];
  const report = runSimulationBranchVerification({ presetIds, runCount, seed });
  return NextResponse.json(report);
}
