import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionLogEntry } from "@/domain/guardian-heart/types/game";
import type { RoomServiceErrorCode } from "@/domain/guardian-heart/types/errors";
import { findRoomByCode } from "../repositories/rooms-repository";
import { listRoomActionLogs, mapRoomActionLogRowToEntry } from "../repositories/room-action-logs-repository";
import { resolveRoomActor } from "../auth/resolve-room-actor";

export type GetRoomActionLogsServiceResult =
  | { ok: true; roomCode: string; logs: ActionLogEntry[] }
  | { ok: false; error: RoomServiceErrorCode };

export async function getRoomActionLogsService(params: {
  client: SupabaseClient;
  roomCode: string;
  joinToken: string;
  limit?: number;
}): Promise<GetRoomActionLogsServiceResult> {
  const { client, roomCode, joinToken, limit } = params;
  try {
    const room = await findRoomByCode({ client, roomCode });
    if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
    const resolved = await resolveRoomActor({ client, roomCode, joinToken });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const rows = await listRoomActionLogs({ client, roomId: room.id, limit });
    return { ok: true, roomCode: room.code, logs: rows.map(mapRoomActionLogRowToEntry) };
  } catch {
    return { ok: false, error: "UNKNOWN_ACTION_ERROR" };
  }
}
