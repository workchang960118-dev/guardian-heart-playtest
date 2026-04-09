import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeatId } from "@/domain/guardian-heart/types/game";

export type RoomPlayerRow = {
  room_id: string;
  seat_id: SeatId | null;
  display_name: string;
  actor_binding_key: string;
  join_token_hash: string | null;
  reconnect_key_hash: string | null;
  assigned_role_id: string | null;
  is_host: boolean;
  is_observer: boolean;
  is_connected: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

const ROOM_PLAYER_COLUMNS =
  "room_id, seat_id, display_name, actor_binding_key, join_token_hash, reconnect_key_hash, assigned_role_id, is_host, is_observer, is_connected, last_seen_at, created_at, updated_at";

export async function insertRoomPlayer(params: {
  client: SupabaseClient;
  roomId: string;
  displayName: string;
  seatId: SeatId | null;
  isHost: boolean;
  isObserver: boolean;
  joinTokenHash: string;
  reconnectKeyHash: string | null;
  actorBindingKey: string;
  at: string;
}): Promise<RoomPlayerRow> {
  const {
    client,
    roomId,
    displayName,
    seatId,
    isHost,
    isObserver,
    joinTokenHash,
    reconnectKeyHash,
    actorBindingKey,
    at,
  } = params;

  const { data, error } = await client
    .from("room_players")
    .insert({
      room_id: roomId,
      seat_id: seatId,
      display_name: displayName,
      actor_binding_key: actorBindingKey,
      join_token_hash: joinTokenHash,
      reconnect_key_hash: reconnectKeyHash,
      assigned_role_id: null,
      is_host: isHost,
      is_observer: isObserver,
      is_connected: true,
      last_seen_at: at,
      created_at: at,
      updated_at: at,
    })
    .select(ROOM_PLAYER_COLUMNS)
    .single();

  if (error) throw error;
  return data as RoomPlayerRow;
}

export async function listRoomPlayers(params: {
  client: SupabaseClient;
  roomId: string;
}): Promise<RoomPlayerRow[]> {
  const { client, roomId } = params;

  const { data, error } = await client
    .from("room_players")
    .select(ROOM_PLAYER_COLUMNS)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as RoomPlayerRow[]) ?? [];
}

export async function listRoomPlayersForRoomIds(params: {
  client: SupabaseClient;
  roomIds: string[];
}): Promise<RoomPlayerRow[]> {
  const { client, roomIds } = params;

  if (roomIds.length === 0) return [];

  const { data, error } = await client
    .from("room_players")
    .select(ROOM_PLAYER_COLUMNS)
    .in("room_id", roomIds)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as RoomPlayerRow[]) ?? [];
}

export async function findRoomPlayerByJoinTokenHash(params: {
  client: SupabaseClient;
  roomId: string;
  joinTokenHash: string;
}): Promise<RoomPlayerRow | null> {
  const { client, roomId, joinTokenHash } = params;

  const { data, error } = await client
    .from("room_players")
    .select(ROOM_PLAYER_COLUMNS)
    .eq("room_id", roomId)
    .eq("join_token_hash", joinTokenHash)
    .maybeSingle();

  if (error) throw error;
  return (data as RoomPlayerRow | null) ?? null;
}

export async function markRoomPlayerConnected(params: {
  client: SupabaseClient;
  roomId: string;
  actorBindingKey: string;
  at: string;
}): Promise<void> {
  const { client, roomId, actorBindingKey, at } = params;

  const { error } = await client
    .from("room_players")
    .update({
      is_connected: true,
      last_seen_at: at,
      updated_at: at,
    })
    .eq("room_id", roomId)
    .eq("actor_binding_key", actorBindingKey);

  if (error) throw error;
}

export async function markRoomPlayerDisconnected(params: {
  client: SupabaseClient;
  roomId: string;
  actorBindingKey: string;
  at: string;
}): Promise<void> {
  const { client, roomId, actorBindingKey, at } = params;

  const { error } = await client
    .from("room_players")
    .update({
      is_connected: false,
      last_seen_at: at,
      updated_at: at,
    })
    .eq("room_id", roomId)
    .eq("actor_binding_key", actorBindingKey);

  if (error) throw error;
}


export async function updateAssignedRoleIdForSeat(params: {
  client: SupabaseClient;
  roomId: string;
  seatId: SeatId;
  roleId: string;
  at: string;
}): Promise<void> {
  const { client, roomId, seatId, roleId, at } = params;

  const { error } = await client
    .from("room_players")
    .update({
      assigned_role_id: roleId,
      updated_at: at,
    })
    .eq("room_id", roomId)
    .eq("seat_id", seatId);

  if (error) throw error;
}
