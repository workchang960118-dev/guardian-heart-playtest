import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameSnapshot } from "@/domain/guardian-heart/types/game";

export type RoomSnapshotRow = {
  room_id: string;
  version: number;
  snapshot_json: GameSnapshot;
  created_at: string;
};

export async function insertRoomSnapshot(params: {
  client: SupabaseClient;
  roomId: string;
  version: number;
  snapshot: GameSnapshot;
}): Promise<void> {
  const { client, roomId, version, snapshot } = params;

  const { error } = await client.from("room_snapshots").insert({
    room_id: roomId,
    version,
    snapshot_json: snapshot,
    created_at: snapshot.updatedAt,
  });

  if (error) throw error;
}

export async function getLatestRoomSnapshot(params: {
  client: SupabaseClient;
  roomId: string;
}): Promise<RoomSnapshotRow | null> {
  const { client, roomId } = params;

  const { data, error } = await client
    .from("room_snapshots")
    .select("room_id, version, snapshot_json, created_at")
    .eq("room_id", roomId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as RoomSnapshotRow | null) ?? null;
}
