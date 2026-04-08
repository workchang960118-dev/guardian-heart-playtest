import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findRoomByCode } from "../repositories/rooms-repository";
import { findRoomPlayerByJoinTokenHash } from "../repositories/room-players-repository";
import type { SeatId } from "@/domain/guardian-heart/types/game";

export type ResolvedRoomActor = {
  roomId: string;
  roomCode: string;
  actorBindingKey: string;
  displayName: string;
  seatId: SeatId | null;
  isHost: boolean;
  isObserver: boolean;
  isConnected: boolean;
};

export function hashJoinToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function resolveRoomActor(params: {
  client: SupabaseClient;
  roomCode: string;
  joinToken: string | null | undefined;
}): Promise<
  | { ok: true; actor: ResolvedRoomActor }
  | { ok: false; error: "ROOM_NOT_FOUND" | "REJOIN_FAILED" }
> {
  const { client, roomCode, joinToken } = params;

  const room = await findRoomByCode({ client, roomCode });
  if (!room) {
    return { ok: false, error: "ROOM_NOT_FOUND" };
  }

  if (!joinToken) {
    return { ok: false, error: "REJOIN_FAILED" };
  }

  const joinTokenHash = hashJoinToken(joinToken);
  const roomPlayer = await findRoomPlayerByJoinTokenHash({
    client,
    roomId: room.id,
    joinTokenHash,
  });

  if (!roomPlayer) {
    return { ok: false, error: "REJOIN_FAILED" };
  }

  return {
    ok: true,
    actor: {
      roomId: room.id,
      roomCode: room.code,
      actorBindingKey: roomPlayer.actor_binding_key,
      displayName: roomPlayer.display_name,
      seatId: roomPlayer.seat_id,
      isHost: roomPlayer.is_host,
      isObserver: roomPlayer.is_observer,
      isConnected: roomPlayer.is_connected,
    },
  };
}
