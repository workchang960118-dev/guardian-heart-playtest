import { NextResponse } from "next/server";
import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import { getSupabaseServerClient } from "@/server/rooms/supabase/server-client";
import { leaveRoomService } from "@/server/rooms/services/leave-room-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const roomCode = String(body?.roomCode ?? "").trim();
    const joinToken = String(body?.joinToken ?? "").trim();

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

    if (!joinToken) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "ACTION_REQUIRED",
          message: "缺少房間身分資訊。",
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const result = await leaveRoomService({ client, roomCode, joinToken });

    if (!result.ok) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: result.error,
          message: "離開房間失敗。",
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const response: ApiResponse<{ left: true }> = {
      ok: true,
      data: { left: true },
    };

    return NextResponse.json(response);
  } catch {
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "REJOIN_FAILED",
        message: "離開房間失敗。",
      },
    };
    return NextResponse.json(response, { status: 400 });
  }
}
