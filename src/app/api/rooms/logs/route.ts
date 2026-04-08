import { NextResponse } from "next/server";
import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import { getSupabaseServerClient } from "@/server/rooms/supabase/server-client";
import { getRoomActionLogsService } from "@/server/rooms/services/get-room-action-logs-service";

function mapLogsErrorStatus(code: string): number {
  if (code === "ROOM_NOT_FOUND") return 404;
  return 400;
}

function mapLogsErrorMessage(code: string): string {
  if (code === "ROOM_NOT_FOUND") return "找不到房間。";
  if (code === "REJOIN_FAILED") return "無法驗證房間身分。";
  return "讀取正式回合紀錄失敗。";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const roomCode = String(body?.roomCode ?? "").trim();
    const joinToken = String(body?.joinToken ?? "").trim();
    const limit = Number(body?.limit ?? 200);
    if (!roomCode) {
      const response: ApiResponse<never> = { ok: false, error: { code: "ROOM_CODE_REQUIRED", message: "請提供房間代碼。" } };
      return NextResponse.json(response, { status: 400 });
    }
    if (!joinToken) {
      const response: ApiResponse<never> = { ok: false, error: { code: "ACTION_REQUIRED", message: "缺少房間身分資訊。" } };
      return NextResponse.json(response, { status: 400 });
    }
    const client = getSupabaseServerClient();
    const result = await getRoomActionLogsService({ client, roomCode, joinToken, limit });
    if (!result.ok) {
      const response: ApiResponse<never> = { ok: false, error: { code: result.error, message: mapLogsErrorMessage(result.error) } };
      return NextResponse.json(response, { status: mapLogsErrorStatus(result.error) });
    }
    const response: ApiResponse<typeof result> = { ok: true, data: result };
    return NextResponse.json(response);
  } catch {
    const response: ApiResponse<never> = { ok: false, error: { code: "UNKNOWN_ACTION_ERROR", message: "讀取正式回合紀錄失敗。" } };
    return NextResponse.json(response, { status: 400 });
  }
}
