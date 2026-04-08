import type { BlockingWindow, GameSnapshot, RoomPlayerSummary, RoomSummary, SeatId, ViewerRole } from "@/domain/guardian-heart/types/game";

export type RoomUiState = {
  roomRoleLabelZh: string;
  canAssignRole: boolean;
  canStartGame: boolean;
  canStartRound: boolean;
  canResolveCampfire: boolean;
  actionBlockedReasonZh: string | null;
  hostActionReasonZh: string | null;
  activePlayerActionReasonZh: string | null;
  viewerPlayerSummary: RoomPlayerSummary | null;
  viewerStatusHintZh: string;
  blockingWindowSummaryZh: string | null;
  phaseSummaryZh: string;
};

function deriveBlockingWindowSummaryZh(blockingWindow: BlockingWindow): string | null {
  if (!blockingWindow) return null;

  if (blockingWindow.kind === "discard") {
    return `目前正在等待 ${blockingWindow.targetSeat} 棄掉 ${blockingWindow.requiredDiscardCount} 張牌。`;
  }
  if (blockingWindow.kind === "ability") {
    return blockingWindow.abilityId === "merchant_guard"
      ? `目前正在等待 ${blockingWindow.actorSeat} 回應〈穩住陣腳〉。`
      : `目前正在等待 ${blockingWindow.actorSeat} 回應〈協調分工〉。`;
  }

  return `目前正在處理 ${blockingWindow.targetSeat} 的損失反應：SR ${blockingWindow.srLoss} / SP ${blockingWindow.spLoss}。來源：${blockingWindow.sourceLabelZh}`;
}

function derivePhaseSummaryZh(snapshot: GameSnapshot): string {
  switch (snapshot.phase) {
    case "lobby":
      return "大廳階段：先完成角色指派，再開始遊戲。";
    case "crisis":
      return "危機階段：請由房主開始本輪，翻出事件並準備進入行動階段。";
    case "action":
      return snapshot.activeSeat
        ? `行動階段：目前輪到 ${snapshot.activeSeat} 行動。`
        : "行動階段：等待系統確認目前可行動玩家。";
    case "campfire":
      return "營火階段：依序處理事件結果、任務宣告、風險扣損、其他損失、壓力與勝敗檢查。";
    case "gameover":
      return "本局已結束，請檢視紀錄、任務與最終局面。";
    default:
      return "目前階段資訊載入中。";
  }
}

export function deriveRoomUiState(params: {
  room: RoomSummary;
  snapshot: GameSnapshot;
  players: RoomPlayerSummary[];
  viewerRole: ViewerRole;
  viewerSeat: SeatId | null;
}): RoomUiState {
  const { room, snapshot, players, viewerRole, viewerSeat } = params;
  const viewerPlayerSummary = players.find((player) => player.seatId === viewerSeat) ?? null;

  const hostActionReasonZh = viewerRole !== "host" ? "只有房主可以執行這項操作。" : null;
  const blockingWindowSummaryZh = deriveBlockingWindowSummaryZh(snapshot.blockingWindow);

  const actionBlockedReasonZh =
    snapshot.blockingWindow?.kind === "discard"
      ? snapshot.blockingWindow.targetSeat === viewerSeat
        ? null
        : "目前正在等待其他玩家完成棄牌。"
      : snapshot.blockingWindow?.kind === "loss"
        ? "目前正在處理損失反應，請先完成陪伴標記或損失結算。"
        : snapshot.blockingWindow?.kind === "ability"
          ? snapshot.blockingWindow.actorSeat === viewerSeat
            ? null
            : "目前正在等待其他玩家回應角色技能。"
          : null;

  const activePlayerActionReasonZh =
    viewerRole === "observer"
      ? "觀察者模式不可操作正式局面。"
      : actionBlockedReasonZh
        ? actionBlockedReasonZh
        : snapshot.activeSeat !== viewerSeat
          ? "現在不是你的回合。"
          : null;

  const allSeatsAssigned = snapshot.players.every((player) => {
    if (player.isAi) return true;
    return Boolean(player.roleId);
  });

  const viewerStatusHintZh =
    viewerRole === "observer"
      ? "你目前是觀察者，可查看局面、紀錄、事件、任務與視窗狀態，但不能操作正式流程。"
      : viewerSeat
        ? `你目前綁定座位 ${viewerSeat}，可依權限與目前階段執行操作。`
        : "目前尚未綁定座位。";

  return {
    roomRoleLabelZh:
      viewerRole === "host" ? "房主" : viewerRole === "observer" ? "觀察者" : "玩家",
    canAssignRole: viewerRole === "host" && room.phase === "lobby",
    canStartGame: viewerRole === "host" && room.phase === "lobby" && allSeatsAssigned,
    canStartRound: viewerRole === "host" && room.phase === "crisis" && !snapshot.blockingWindow,
    canResolveCampfire: viewerRole === "host" && room.phase === "campfire" && !snapshot.blockingWindow,
    actionBlockedReasonZh,
    hostActionReasonZh,
    activePlayerActionReasonZh,
    viewerPlayerSummary,
    viewerStatusHintZh,
    blockingWindowSummaryZh,
    phaseSummaryZh: derivePhaseSummaryZh(snapshot),
  };
}
