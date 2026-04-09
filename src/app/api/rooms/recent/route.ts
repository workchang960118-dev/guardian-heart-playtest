import { NextResponse } from "next/server";
import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import { listRecentRoomRows } from "@/server/rooms/repositories/rooms-repository";
import { listRoomPlayersForRoomIds } from "@/server/rooms/repositories/room-players-repository";
import { getSupabaseServerClient } from "@/server/rooms/supabase/server-client";

export type RecentRoomEntry = {
  roomCode: string;
  status: "lobby" | "in_progress" | "finished";
  phase: "lobby" | "crisis" | "action" | "campfire" | "gameover";
  round: number;
  updatedAt: string;
  participantCount: number;
  connectedParticipantCount: number;
  observerCount: number;
};

export async function GET() {
  try {
    const client = getSupabaseServerClient();
    const rooms = await listRecentRoomRows({ client, limit: 2 });

    if (rooms.length === 0) {
      const response: ApiResponse<RecentRoomEntry[]> = { ok: true, data: [] };
      return NextResponse.json(response);
    }

    const roomPlayers = await listRoomPlayersForRoomIds({
      client,
      roomIds: rooms.map((room) => room.id),
    });

    const playersByRoomId = new Map<string, typeof roomPlayers>();
    for (const player of roomPlayers) {
      const current = playersByRoomId.get(player.room_id);
      if (current) current.push(player);
      else playersByRoomId.set(player.room_id, [player]);
    }

    const data: RecentRoomEntry[] = rooms.map((room) => {
      const players = playersByRoomId.get(room.id) ?? [];
      const participantPlayers = players.filter((player) => player.seat_id !== null && !player.is_observer);
      return {
        roomCode: room.code,
        status: room.status,
        phase: room.phase,
        round: room.round,
        updatedAt: room.updated_at,
        participantCount: participantPlayers.length,
        connectedParticipantCount: participantPlayers.filter((player) => player.is_connected).length,
        observerCount: players.filter((player) => player.is_observer).length,
      };
    });

    const response: ApiResponse<RecentRoomEntry[]> = {
      ok: true,
      data,
    };

    return NextResponse.json(response);
  } catch {
    const response: ApiResponse<never> = {
      ok: false,
      error: {
        code: "ROOM_LIST_FAILED",
        message: "目前無法讀取近期房間。",
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}
