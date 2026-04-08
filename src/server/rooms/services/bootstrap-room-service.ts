import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GameSnapshot,
  RoomPlayerSummary,
  RoomSummary,
  ViewerRole,
} from "@/domain/guardian-heart/types/game";
import type { RoomServiceErrorCode } from "@/domain/guardian-heart/types/errors";
import { findRoomByCode, type RoomRow } from "../repositories/rooms-repository";
import {
  insertRoomPlayer,
  listRoomPlayers,
  markRoomPlayerConnected,
  type RoomPlayerRow,
} from "../repositories/room-players-repository";
import { getLatestRoomSnapshot } from "../repositories/room-snapshots-repository";
import { resolveRoomActor, hashJoinToken } from "../auth/resolve-room-actor";

function generateJoinToken(): string {
  return randomUUID();
}

function generateActorBindingKey(): string {
  return randomUUID();
}

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

export type BootstrapRoomServiceSuccess = {
  ok: true;
  room: RoomSummary;
  players: RoomPlayerSummary[];
  snapshot: GameSnapshot;
  viewerSeat: "P1" | "P2" | "P3" | "P4" | null;
  joinToken: string;
  displayName: string;
  viewerRole: ViewerRole;
};

export type BootstrapRoomServiceFailure = {
  ok: false;
  error: RoomServiceErrorCode;
};

export type BootstrapRoomServiceResult =
  | BootstrapRoomServiceSuccess
  | BootstrapRoomServiceFailure;

export async function bootstrapRoomService(params: {
  client: SupabaseClient;
  roomCode: string;
  joinToken?: string | null;
  displayName?: string | null;
  bootstrapAsObserver?: boolean;
}): Promise<BootstrapRoomServiceResult> {
  const {
    client,
    roomCode,
    joinToken,
    displayName,
    bootstrapAsObserver = false,
  } = params;

  const at = new Date().toISOString();

  try {
    const room = await findRoomByCode({ client, roomCode });
    if (!room) {
      return { ok: false, error: "ROOM_NOT_FOUND" };
    }

    const latestSnapshot = await getLatestRoomSnapshot({
      client,
      roomId: room.id,
    });
    if (!latestSnapshot) {
      return { ok: false, error: "SNAPSHOT_NOT_FOUND" };
    }

    if (joinToken) {
      const resolved = await resolveRoomActor({
        client,
        roomCode,
        joinToken,
      });

      if (resolved.ok) {
        await markRoomPlayerConnected({
          client,
          roomId: resolved.actor.roomId,
          actorBindingKey: resolved.actor.actorBindingKey,
          at,
        });

        const roomPlayers = await listRoomPlayers({
          client,
          roomId: room.id,
        });

        return {
          ok: true,
          room: buildRoomSummary(room),
          players: roomPlayers
            .filter((row) => row.seat_id !== null)
            .map(buildRoomPlayerSummary),
          snapshot: latestSnapshot.snapshot_json,
          viewerSeat: resolved.actor.seatId,
          joinToken,
          displayName: resolved.actor.displayName,
          viewerRole: resolved.actor.isObserver
            ? "observer"
            : resolved.actor.isHost
              ? "host"
              : "player",
        };
      }
    }

    if (!bootstrapAsObserver) {
      return { ok: false, error: "REJOIN_FAILED" };
    }

    const observerDisplayName = displayName?.trim() || "觀察者";
    const observerJoinToken = generateJoinToken();
    const observerJoinTokenHash = hashJoinToken(observerJoinToken);
    const actorBindingKey = generateActorBindingKey();

    await insertRoomPlayer({
      client,
      roomId: room.id,
      displayName: observerDisplayName,
      seatId: null,
      isHost: false,
      isObserver: true,
      joinTokenHash: observerJoinTokenHash,
      reconnectKeyHash: null,
      actorBindingKey,
      at,
    });

    const roomPlayers = await listRoomPlayers({
      client,
      roomId: room.id,
    });

    return {
      ok: true,
      room: buildRoomSummary(room),
      players: roomPlayers
        .filter((row) => row.seat_id !== null)
        .map(buildRoomPlayerSummary),
      snapshot: latestSnapshot.snapshot_json,
      viewerSeat: null,
      joinToken: observerJoinToken,
      displayName: observerDisplayName,
      viewerRole: "observer",
    };
  } catch {
    return { ok: false, error: "REJOIN_FAILED" };
  }
}
