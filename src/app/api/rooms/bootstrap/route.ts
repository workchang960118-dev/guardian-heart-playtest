import { NextResponse } from "next/server";
import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import { getSupabaseServerClient } from "@/server/rooms/supabase/server-client";
import { bootstrapRoomService } from "@/server/rooms/services/bootstrap-room-service";

function mapBootstrapErrorToStatus(code: string): number {
  if (code === "ROOM_NOT_FOUND" || code === "SNAPSHOT_NOT_FOUND") return 404;
  if (code === "ROOM_FULL") return 409;
  return 400;
}

function mapBootstrapErrorToMessage(code: string): string {
  if (code === "ROOM_NOT_FOUND") return "找不到房間。";
  if (code === "SNAPSHOT_NOT_FOUND") return "找不到房間局面。";
  if (code === "DISPLAY_NAME_REQUIRED") return "請先輸入顯示名稱。";
  if (code === "ROOM_PLAYER_JOIN_LOCKED") return "這個房間目前不能再加入新玩家，請改用旁觀模式。";
  if (code === "ROOM_FULL") return "這局的真人席位已滿，請改用旁觀模式。";
  return "無法恢復房間身分。";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const roomCode = String(body?.roomCode ?? "").trim();
    const joinToken = body?.joinToken ? String(body.joinToken) : null;
    const displayName = body?.displayName ? String(body.displayName) : null;
    const bootstrapAsObserver = Boolean(body?.bootstrapAsObserver);

    if (!roomCode) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "ROOM_CODE_REQUIRED",
          message: "請提供房間代碼。",
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const result = await bootstrapRoomService({
      client,
      roomCode,
      joinToken,
      displayName,
      bootstrapAsObserver,
    });

    if (!result.ok) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: result.error,
          message: mapBootstrapErrorToMessage(result.error),
        },
      };
      return NextResponse.json(response, {
        status: mapBootstrapErrorToStatus(result.error),
      });
    }

    const response: ApiResponse<typeof result> = {
      ok: true,
      data: result,
    };

    return NextResponse.json(response);
  } catch {
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "REJOIN_FAILED",
        message: "無法恢復房間身分。",
      },
    };
    return NextResponse.json(response, { status: 400 });
  }
}
