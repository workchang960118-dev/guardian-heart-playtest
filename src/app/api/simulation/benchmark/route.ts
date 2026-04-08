import { NextResponse } from "next/server";
import { PYTHON_MAINLINE_BENCHMARK } from "@/domain/guardian-heart/seeds/simulation/python-mainline-benchmark";

export async function GET() {
  return NextResponse.json(PYTHON_MAINLINE_BENCHMARK);
}
