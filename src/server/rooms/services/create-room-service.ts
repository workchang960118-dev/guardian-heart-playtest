import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GameSnapshot,
  RoomPlayerSummary,
  RoomSummary,
  ViewerRole,
} from "@/domain/guardian-heart/types/game";
import type { RoomServiceErrorCode } from "@/domain/guardian-heart/types/errors";
import { createRoomRow, type RoomRow } from "../repositories/rooms-repository";
import {
  insertRoomPlayer,
  listRoomPlayers,
  type RoomPlayerRow,
} from "../repositories/room-players-repository";
import { insertRoomSnapshot } from "../repositories/room-snapshots-repository";
import { withRoomTransaction } from "../transactions/with-room-transaction";
import { hashJoinToken } from "../auth/resolve-room-actor";
import { DEFAULT_ROOM_CONFIG } from "@/domain/guardian-heart/seeds/config/default-room-config";

function generateRoomCode(): string {
  return randomUUID().slice(0, 6).toUpperCase();
}

function generateJoinToken(): string {
  return randomUUID();
}

function generateActorBindingKey(): string {
  return randomUUID();
}

function createInitialLobbySnapshot(params: {
  roomId: string;
  displayName: string;
  at: string;
}): GameSnapshot {
  const { roomId, displayName, at } = params;

  return {
    roomId,
    roomRevision: 1,
    phase: "lobby",
    status: "lobby",
    round: 0,
    pressure: 0,
    roomConfig: structuredClone(DEFAULT_ROOM_CONFIG),
    mapTiles: [],
    players: [
      {
        seatId: "P1",
        displayName,
        isAi: false,
        roleId: null,
        roleNameZh: null,
        currentSr: 0,
        currentSp: 0,
        remainingAp: 0,
        positionTileId: null,
        companionTokensRemaining: 0,
        handCardIds: [],
        roleAbilityUsesRemaining: 0,
        perRoundFlags: {
          hasInvestedEvent: false,
          hasAdjacentHelped: false,
        },
      },
    ],
    currentEvent: null,
    eventDeck: [],
    eventDiscardPile: [],
    tasks: [],
    actionDeck: [],
    discardPile: [],
    activeSeat: null,
    turnOrder: [],
    blockingWindow: null,
    pendingLossQueue: [],
    pendingCampfireResolution: null,
    pendingTaskReview: null,
    actionLog: [],
    flags: {
      adjacentHelpPairsThisRound: [],
      adjacentHelpResourceTypesThisRound: [],
    },
    turnContext: {
      actedSeatOrder: [],
      perSeat: {
        P1: { hasEndedTurn: false },
        P2: { hasEndedTurn: false },
        P3: { hasEndedTurn: false },
        P4: { hasEndedTurn: false },
      },
    },
    createdAt: at,
    updatedAt: at,
  };
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

export type CreateRoomServiceSuccess = {
  ok: true;
  room: RoomSummary;
  players: RoomPlayerSummary[];
  snapshot: GameSnapshot;
  viewerSeat: "P1";
  joinToken: string;
  displayName: string;
  viewerRole: ViewerRole;
};

export type CreateRoomServiceFailure = {
  ok: false;
  error: RoomServiceErrorCode;
};

export type CreateRoomServiceResult =
  | CreateRoomServiceSuccess
  | CreateRoomServiceFailure;

export async function createRoomService(params: {
  client: SupabaseClient;
  displayName: string;
}): Promise<CreateRoomServiceResult> {
  const { client, displayName } = params;

  if (!displayName.trim()) {
    return { ok: false, error: "DISPLAY_NAME_REQUIRED" };
  }

  const at = new Date().toISOString();

  try {
    const roomCode = generateRoomCode();
    const joinToken = generateJoinToken();
    const joinTokenHash = hashJoinToken(joinToken);
    const actorBindingKey = generateActorBindingKey();

    const result = await withRoomTransaction({
      client,
      run: async (tx) => {
        const room = await createRoomRow({
          client: tx,
          code: roomCode,
          at,
        });

        await insertRoomPlayer({
          client: tx,
          roomId: room.id,
          displayName,
          seatId: "P1",
          isHost: true,
          isObserver: false,
          joinTokenHash,
          reconnectKeyHash: null,
          actorBindingKey,
          at,
        });

        const snapshot = createInitialLobbySnapshot({
          roomId: room.id,
          displayName,
          at,
        });

        await insertRoomSnapshot({
          client: tx,
          roomId: room.id,
          version: 1,
          snapshot,
        });

        const roomPlayers = await listRoomPlayers({
          client: tx,
          roomId: room.id,
        });

        return { room, snapshot, roomPlayers };
      },
    });

    return {
      ok: true,
      room: buildRoomSummary(result.room),
      players: result.roomPlayers
        .filter((row) => row.seat_id !== null)
        .map(buildRoomPlayerSummary),
      snapshot: result.snapshot,
      viewerSeat: "P1",
      joinToken,
      displayName,
      viewerRole: "host",
    };
  } catch {
    return { ok: false, error: "CREATE_ROOM_FAILED" };
  }
}
