import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoomServiceErrorCode } from "@/domain/guardian-heart/types/errors";
import { markRoomPlayerDisconnected } from "../repositories/room-players-repository";
import { resolveRoomActor } from "../auth/resolve-room-actor";

export type LeaveRoomServiceSuccess = {
  ok: true;
  left: true;
};

export type LeaveRoomServiceFailure = {
  ok: false;
  error: RoomServiceErrorCode;
};

export type LeaveRoomServiceResult =
  | LeaveRoomServiceSuccess
  | LeaveRoomServiceFailure;

export async function leaveRoomService(params: {
  client: SupabaseClient;
  roomCode: string;
  joinToken: string;
}): Promise<LeaveRoomServiceResult> {
  const { client, roomCode, joinToken } = params;
  const at = new Date().toISOString();

  try {
    const resolved = await resolveRoomActor({
      client,
      roomCode,
      joinToken,
    });

    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }

    await markRoomPlayerDisconnected({
      client,
      roomId: resolved.actor.roomId,
      actorBindingKey: resolved.actor.actorBindingKey,
      at,
    });

    return { ok: true, left: true };
  } catch {
    return { ok: false, error: "REJOIN_FAILED" };
  }
}
