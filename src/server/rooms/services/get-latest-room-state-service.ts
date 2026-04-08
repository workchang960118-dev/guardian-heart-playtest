import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GameSnapshot,
  RoomPlayerSummary,
  RoomSummary,
  ViewerRole,
} from "@/domain/guardian-heart/types/game";
import type { RoomServiceErrorCode } from "@/domain/guardian-heart/types/errors";
import { findRoomByCode, type RoomRow } from "../repositories/rooms-repository";
import { listRoomPlayers, type RoomPlayerRow } from "../repositories/room-players-repository";
import { getLatestRoomSnapshot } from "../repositories/room-snapshots-repository";
import { resolveRoomActor } from "../auth/resolve-room-actor";
import { buildStateUpdatedPayload, type StateUpdatedPayload } from "@/domain/guardian-heart/types/realtime";

function buildRoomSummary(room: RoomRow): RoomSummary {
  return {
    roomId: room.id,
    roomCode: room.code,
    status: room.status,
    phase: room.phase,
    round: room.round,
    version: room.version,
    hostSeat: "P1",
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

function buildRoomPlayerSummary(row: RoomPlayerRow): RoomPlayerSummary {
  return {
    seatId: row.seat_id ?? "P1",
    displayName: row.display_name,
    isConnected: row.is_connected,
    isAi: false,
    joinedAt: row.created_at,
  };
}

export type GetLatestRoomStateServiceSuccess = {
  ok: true;
  room: RoomSummary;
  players: RoomPlayerSummary[];
  snapshot: GameSnapshot;
  viewerSeat: "P1" | "P2" | "P3" | "P4" | null;
  displayName: string;
  viewerRole: ViewerRole;
  stateUpdatedPayload: StateUpdatedPayload;
};

export type GetLatestRoomStateServiceFailure = {
  ok: false;
  error: RoomServiceErrorCode;
};

export type GetLatestRoomStateServiceResult =
  | GetLatestRoomStateServiceSuccess
  | GetLatestRoomStateServiceFailure;

export async function getLatestRoomStateService(params: {
  client: SupabaseClient;
  roomCode: string;
  joinToken: string;
}): Promise<GetLatestRoomStateServiceResult> {
  const { client, roomCode, joinToken } = params;

  try {
    const room = await findRoomByCode({ client, roomCode });
    if (!room) {
      return { ok: false, error: "ROOM_NOT_FOUND" };
    }

    const resolved = await resolveRoomActor({ client, roomCode, joinToken });
    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }

    const latestSnapshot = await getLatestRoomSnapshot({ client, roomId: room.id });
    if (!latestSnapshot) {
      return { ok: false, error: "SNAPSHOT_NOT_FOUND" };
    }

    const roomPlayers = await listRoomPlayers({ client, roomId: room.id });

    return {
      ok: true,
      room: buildRoomSummary(room),
      players: roomPlayers.filter((row) => row.seat_id !== null).map(buildRoomPlayerSummary),
      snapshot: latestSnapshot.snapshot_json,
      viewerSeat: resolved.actor.seatId,
      displayName: resolved.actor.displayName,
      viewerRole: resolved.actor.isObserver ? "observer" : resolved.actor.isHost ? "host" : "player",
      stateUpdatedPayload: buildStateUpdatedPayload({
        roomId: room.id,
        roomCode: room.code,
        version: room.version,
        roomRevision: latestSnapshot.snapshot_json.roomRevision,
        phase: latestSnapshot.snapshot_json.phase,
        round: latestSnapshot.snapshot_json.round,
        activeSeat: latestSnapshot.snapshot_json.activeSeat,
        blockingWindowKind: latestSnapshot.snapshot_json.blockingWindow?.kind ?? null,
        updatedAt: latestSnapshot.snapshot_json.updatedAt,
      }),
    };
  } catch {
    return { ok: false, error: "UNKNOWN_ACTION_ERROR" };
  }
}
