import { NextResponse } from "next/server";
import {
  DEFAULT_SIMULATION_COMPARE_PRESET_ID,
  buildPresetVariants,
  runSimulationCompare,
} from "@/domain/guardian-heart/testing/ai-simulation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const presetId = url.searchParams.get("presetId") ?? DEFAULT_SIMULATION_COMPARE_PRESET_ID;
  const runCount = Number(url.searchParams.get("runCount") ?? 100);
  const seed = Number(url.searchParams.get("seed") ?? 20260401);
  const variants = buildPresetVariants(presetId, runCount);
  const report = runSimulationCompare(variants, { presetId, seed });
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const presetId = typeof body?.presetId === "string" ? body.presetId : DEFAULT_SIMULATION_COMPARE_PRESET_ID;
  const runCount = Number(body?.runCount ?? 100);
  const seed = Number(body?.seed ?? 20260401);
  const variants = Array.isArray(body?.variants)
    ? body.variants
    : buildPresetVariants(presetId, runCount);
  const report = runSimulationCompare(variants, { presetId, seed });
  return NextResponse.json(report);
}
