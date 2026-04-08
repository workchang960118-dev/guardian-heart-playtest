import { findRoomByCode } from "@/server/rooms/repositories/rooms-repository";
import { resolveRoomActor } from "@/server/rooms/auth/resolve-room-actor";
import { subscribeStateUpdated } from "@/server/rooms/realtime/realtime-hub";
import { getSupabaseServerClient } from "@/server/rooms/supabase/server-client";
import { ROOM_STATE_UPDATED_EVENT } from "@/domain/guardian-heart/types/realtime";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomCode = url.searchParams.get("roomCode")?.trim() ?? "";
  const joinToken = url.searchParams.get("joinToken")?.trim() ?? "";

  if (!roomCode || !joinToken) {
    return new Response("缺少房間代碼或 join token。", { status: 400 });
  }

  const client = getSupabaseServerClient();
  const room = await findRoomByCode({ client, roomCode });
  if (!room) {
    return new Response("找不到房間。", { status: 404 });
  }

  const resolved = await resolveRoomActor({ client, roomCode, joinToken });
  if (!resolved.ok) {
    return new Response("無法驗證房間身分。", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send("ready", {
        roomCode,
        actorSeat: resolved.actor.seatId,
        viewerRole: resolved.actor.isObserver ? "observer" : resolved.actor.isHost ? "host" : "player",
      });

      const unsubscribe = subscribeStateUpdated({
        roomCode,
        onStateUpdated: (payload) => send(ROOM_STATE_UPDATED_EVENT, payload),
      });

      const heartbeat = setInterval(() => {
        send("ping", { at: new Date().toISOString() });
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
