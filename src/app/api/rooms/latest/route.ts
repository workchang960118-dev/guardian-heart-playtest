import { NextResponse } from "next/server";
import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import { getSupabaseServerClient } from "@/server/rooms/supabase/server-client";
import { getLatestRoomStateService } from "@/server/rooms/services/get-latest-room-state-service";

function mapLatestErrorStatus(code: string): number {
  if (code === "ROOM_NOT_FOUND" || code === "SNAPSHOT_NOT_FOUND") return 404;
  return 400;
}

function mapLatestErrorMessage(code: string): string {
  if (code === "ROOM_NOT_FOUND") return "找不到房間。";
  if (code === "SNAPSHOT_NOT_FOUND") return "找不到最新局面。";
  if (code === "REJOIN_FAILED") return "無法驗證房間身分，請重新入房。";
  return "讀取最新房間狀態失敗。";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const roomCode = String(body?.roomCode ?? "").trim();
    const joinToken = String(body?.joinToken ?? "").trim();

    if (!roomCode) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "ROOM_CODE_REQUIRED", message: "請提供房間代碼。" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!joinToken) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: "REJOIN_FAILED", message: "缺少 join token，無法確認房間身分。" },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const result = await getLatestRoomStateService({ client, roomCode, joinToken });

    if (!result.ok) {
      const response: ApiResponse<never> = {
        ok: false,
        error: { code: result.error, message: mapLatestErrorMessage(result.error) },
      };
      return NextResponse.json(response, { status: mapLatestErrorStatus(result.error) });
    }

    const response: ApiResponse<typeof result> = { ok: true, data: result };
    return NextResponse.json(response);
  } catch {
    const response: ApiResponse<never> = {
      ok: false,
      error: { code: "UNKNOWN_ACTION_ERROR", message: "讀取最新房間狀態失敗。" },
    };
    return NextResponse.json(response, { status: 400 });
  }
}
