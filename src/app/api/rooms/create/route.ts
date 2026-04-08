import { NextResponse } from "next/server";
import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import { getSupabaseServerClient } from "@/server/rooms/supabase/server-client";
import { createRoomService } from "@/server/rooms/services/create-room-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const displayName = String(body?.displayName ?? "").trim();

    if (!displayName) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: "DISPLAY_NAME_REQUIRED",
          message: "請先輸入顯示名稱。",
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const result = await createRoomService({ client, displayName });

    if (!result.ok) {
      const response: ApiResponse<never> = {
        ok: false,
        error: {
          code: result.error,
          message: "建立房間失敗。",
        },
      };
      return NextResponse.json(response, { status: 400 });
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
        code: "CREATE_ROOM_FAILED",
        message: "建立房間失敗。",
      },
    };
    return NextResponse.json(response, { status: 400 });
  }
}
