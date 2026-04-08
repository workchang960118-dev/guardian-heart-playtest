import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionLogEntry } from "@/domain/guardian-heart/types/game";

export type RoomActionLogRow = {
  room_id: string;
  room_revision: number;
  round: number;
  phase: ActionLogEntry["phase"];
  actor_seat: ActionLogEntry["actorSeat"];
  action_type: string;
  payload_summary_zh: string;
  result_summary_zh: string;
  status_before_json: ActionLogEntry["statusBefore"];
  status_after_json: ActionLogEntry["statusAfter"];
  timestamp: string;
  created_at: string;
};

const ROOM_ACTION_LOG_COLUMNS =
  "room_id, room_revision, round, phase, actor_seat, action_type, payload_summary_zh, result_summary_zh, status_before_json, status_after_json, timestamp, created_at";

export async function insertRoomActionLog(params: {
  client: SupabaseClient;
  roomId: string;
  entry: ActionLogEntry;
}): Promise<void> {
  const { client, roomId, entry } = params;
  const { error } = await client.from("room_action_logs").insert({
    room_id: roomId,
    room_revision: entry.roomRevision,
    round: entry.round,
    phase: entry.phase,
    actor_seat: entry.actorSeat,
    action_type: entry.actionType,
    payload_summary_zh: entry.payloadSummaryZh,
    result_summary_zh: entry.resultSummaryZh,
    status_before_json: entry.statusBefore,
    status_after_json: entry.statusAfter,
    timestamp: entry.timestamp,
    created_at: entry.timestamp,
  });
  if (error) throw error;
}

export async function listRoomActionLogs(params: {
  client: SupabaseClient;
  roomId: string;
  limit?: number;
}): Promise<RoomActionLogRow[]> {
  const { client, roomId, limit = 200 } = params;
  const { data, error } = await client
    .from("room_action_logs")
    .select(ROOM_ACTION_LOG_COLUMNS)
    .eq("room_id", roomId)
    .order("room_revision", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as RoomActionLogRow[]) ?? [];
}

export function mapRoomActionLogRowToEntry(row: RoomActionLogRow): ActionLogEntry {
  return {
    roomRevision: row.room_revision,
    round: row.round,
    phase: row.phase,
    actorSeat: row.actor_seat,
    actorKind: row.actor_seat === "SYSTEM" ? "system" : "human",
    actorLabelZh: row.actor_seat === "SYSTEM" ? "系統" : String(row.actor_seat),
    actionType: row.action_type,
    payloadSummaryZh: row.payload_summary_zh,
    resultSummaryZh: row.result_summary_zh,
    statusBefore: row.status_before_json,
    statusAfter: row.status_after_json,
    timestamp: row.timestamp,
  };
}
