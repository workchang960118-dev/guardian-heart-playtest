import { NextResponse } from "next/server";
import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import type { RoomAction } from "@/domain/guardian-heart/types/room-actions";
import { getSupabaseServerClient } from "@/server/rooms/supabase/server-client";
import { applyRoomActionService } from "@/server/rooms/services/apply-room-action-service";

function mapActionErrorStatus(code: string): number {
  if (
    code === "OBSERVER_CANNOT_ACT" ||
    code === "FORGED_SEAT_ACTION" ||
    code === "UNAUTHORIZED_HOST_ACTION" ||
    code === "NOT_ACTIVE_SEAT"
  ) {
    return 403;
  }
  if (code === "ROOM_NOT_FOUND" || code === "SNAPSHOT_NOT_FOUND") return 404;
  return 400;
}

function mapActionErrorMessage(code: string): string {
  if (code === "OBSERVER_CANNOT_ACT") return "觀察者模式不可操作正式局面。";
  if (code === "FORGED_SEAT_ACTION") return "你目前的玩家身分與此操作座位不一致，系統已拒絕請求。";
  if (code === "UNAUTHORIZED_HOST_ACTION") return "只有房主可以執行這個操作。";
  if (code === "NOT_ACTIVE_SEAT") return "目前不是你的行動時機。";
  if (code === "INVALID_PHASE") return "目前階段不可執行這個操作。";
  if (code === "ROLE_ALREADY_TAKEN") return "這個角色已被其他座位使用。";
  if (code === "SEAT_NOT_FOUND") return "找不到指定座位。";
  if (code === "MISSING_ROLE_ASSIGNMENTS") return "仍有座位尚未指派角色。";
  if (code === "TILE_NOT_FOUND") return "找不到目標地格。";
  if (code === "MOVE_NOT_ADJACENT") return "只能移動到相鄰地格。";
  if (code === "NOT_ON_FUNCTION_TILE") return "你目前不在物資站或庇護所上。";
  if (code === "RESOURCE_AT_MAX") return "該資源目前不可再增加。";
  if (code === "EVENT_NOT_AVAILABLE") return "目前沒有可投入的事件。";
  if (code === "EVENT_INVEST_LIMIT_REACHED") return "你本輪已投入過事件。";
  if (code === "INSUFFICIENT_RESOURCE") return "你的資源不足，無法執行這個操作。";
  if (code === "EVENT_REQUIREMENT_EXCEEDED") return "投入量超過事件剩餘需求。";
  if (code === "TARGET_NOT_REACHABLE") return "目標隊友距離不符合這張牌的使用條件。";
  if (code === "HELP_LIMIT_REACHED") return "你本輪已進行過相鄰互助。";
  if (code === "TARGET_RESOURCE_FULL") return "目標玩家該資源目前不可再增加。";
  if (code === "ACTION_CARD_DISABLED") return "這張行動卡目前被關閉或未啟用。";
  if (code === "ACTION_CARD_EFFECT_NOT_AVAILABLE") return "目前條件不足，無法使用這張行動卡。";
  if (code === "DISCARD_WINDOW_NOT_FOUND") return "目前沒有等待中的棄牌視窗。";
  if (code === "DISCARD_NOT_OWNER") return "目前正在等待其他玩家完成棄牌。";
  if (code === "DISCARD_COUNT_MISMATCH") return "棄牌數量不正確。";
  if (code === "CARD_NOT_IN_HAND") return "你選擇了不在手上的卡牌。";
  if (code === "LOSS_WINDOW_NOT_FOUND") return "目前沒有等待中的損失處理視窗。";
  if (code === "LOSS_REACTION_NOT_ELIGIBLE") return "你目前不能介入這筆損失。";
  if (code === "LOSS_REACTION_SELF_TARGET") return "受影響玩家不能對自己使用陪伴標記。";
  if (code === "ABILITY_WINDOW_NOT_FOUND") return "目前沒有等待中的角色技能回應視窗。";
  if (code === "ABILITY_RESPONSE_NOT_ELIGIBLE") return "目前不是你回應這個角色技能的時機。";
  if (code === "ABILITY_TARGET_NOT_VALID") return "你選擇的角色技能目標不合法。";
  if (code === "COMPANION_ALREADY_USED") return "這次損失已使用過陪伴標記。";
  if (code === "NO_COMPANION_TOKEN_LEFT") return "你已沒有可用的陪伴標記。";
  if (code === "INVALID_PREVENT_RESOURCE") return "這次損失不能這樣抵銷。";
  if (code === "TASK_NOT_FOUND") return "找不到指定任務。";
  if (code === "TASK_ALREADY_DECLARED_THIS_ROUND") return "本輪已宣告過任務。";
  if (code === "TASK_ALREADY_COMPLETED") return "這張任務已完成，不能重複宣告。";
  if (code === "TASK_CONDITION_NOT_MET") return "目前條件不足，不能宣告這張任務。";
  if (code === "TASK_DECLARATION_LOCKED") return "目前受壓力規則限制，不能宣告任務。";
  if (code === "CAMPFIRE_BLOCKING_WINDOW_PENDING") return "目前仍有等待中的損失或棄牌處理，不能直接繼續營火。";
  if (code === "ROOM_NOT_FOUND") return "找不到房間。";
  if (code === "SNAPSHOT_NOT_FOUND") return "找不到房間局面。";
  if (code === "UNSUPPORTED_ACTION") return "這個操作會在後續批次補上。";

  if (code === "TASK_REQUIRES_STATION_AND_SR") {
    return "需至少 1 名玩家位於物資站，且全隊至少有 2 名玩家的 SR 不低於 3。";
  }
  if (code === "TASK_REQUIRES_SHELTER_AND_SP") {
    return "需至少 1 名玩家位於庇護所，且全隊至少有 2 名玩家的 SP 不低於 3。";
  }
  if (code === "TASK_REQUIRES_TWO_ADJACENT_HELPS") {
    return "本輪至少要發生 2 次 0AP 相鄰互助。";
  }
  if (code === "TASK_REQUIRES_EVENT_RESOLVED_AND_NO_RISK") {
    return "本輪事件需成功解決，且無人位於風險地格。";
  }
  if (code === "TASK_REQUIRES_THREE_ON_SAME_TILE") {
    return "至少 3 名玩家需位於同一地格。";
  }
  if (code === "TASK_REQUIRES_SR_AND_SP_HELP") {
    return "本輪需至少 2 次 0AP 相鄰互助，且 SR / SP 互助各至少 1 次。";
  }
  return "操作失敗。";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const roomCode = String(body?.roomCode ?? "").trim();
    const joinToken = String(body?.joinToken ?? "").trim();
    const action = body?.action as RoomAction | undefined;

    if (!roomCode) {
      const response: ApiResponse<never> = { ok: false, error: { code: "ROOM_CODE_REQUIRED", message: "請提供房間代碼。" } };
      return NextResponse.json(response, { status: 400 });
    }
    if (!joinToken || !action) {
      const response: ApiResponse<never> = { ok: false, error: { code: "ACTION_REQUIRED", message: "缺少操作內容或房間身分資訊。" } };
      return NextResponse.json(response, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const result = await applyRoomActionService({ client, roomCode, joinToken, action });
    if (!result.ok) {
      const response: ApiResponse<never> = { ok: false, error: { code: result.error, message: mapActionErrorMessage(result.error) } };
      return NextResponse.json(response, { status: mapActionErrorStatus(result.error) });
    }

    const response: ApiResponse<typeof result> = { ok: true, data: result };
    return NextResponse.json(response);
  } catch {
    const response: ApiResponse<never> = { ok: false, error: { code: "UNKNOWN_ACTION_ERROR", message: "操作失敗。" } };
    return NextResponse.json(response, { status: 400 });
  }
}
