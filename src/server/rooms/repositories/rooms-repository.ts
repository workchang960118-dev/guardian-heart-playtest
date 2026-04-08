import type { SupabaseClient } from "@supabase/supabase-js";
import type { GamePhase, RoomStatus } from "@/domain/guardian-heart/types/game";

export type RoomRow = {
  id: string;
  code: string;
  status: RoomStatus;
  phase: GamePhase;
  round: number;
  version: number;
  created_at: string;
  updated_at: string;
};

export async function createRoomRow(params: {
  client: SupabaseClient;
  code: string;
  at: string;
}): Promise<RoomRow> {
  const { client, code, at } = params;

  const { data, error } = await client
    .from("rooms")
    .insert({
      code,
      status: "lobby",
      phase: "lobby",
      round: 0,
      version: 1,
      created_at: at,
      updated_at: at,
    })
    .select("id, code, status, phase, round, version, created_at, updated_at")
    .single();

  if (error) throw error;
  return data as RoomRow;
}

export async function findRoomByCode(params: {
  client: SupabaseClient;
  roomCode: string;
}): Promise<RoomRow | null> {
  const { client, roomCode } = params;

  const { data, error } = await client
    .from("rooms")
    .select("id, code, status, phase, round, version, created_at, updated_at")
    .eq("code", roomCode)
    .maybeSingle();

  if (error) throw error;
  return (data as RoomRow | null) ?? null;
}

export async function updateRoomVersionAndState(params: {
  client: SupabaseClient;
  roomId: string;
  version: number;
  status: RoomStatus;
  phase: GamePhase;
  round: number;
  updatedAt: string;
}): Promise<void> {
  const { client, roomId, version, status, phase, round, updatedAt } = params;

  const { error } = await client
    .from("rooms")
    .update({
      version,
      status,
      phase,
      round,
      updated_at: updatedAt,
    })
    .eq("id", roomId);

  if (error) throw error;
}
