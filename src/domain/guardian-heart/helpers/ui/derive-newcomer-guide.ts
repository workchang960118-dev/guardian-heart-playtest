import type { GameSnapshot, SeatId, ViewerRole } from "@/domain/guardian-heart/types/game";

function getViewerPlayer(snapshot: GameSnapshot, viewerSeat: SeatId | null) {
  if (!viewerSeat) return null;
  return snapshot.players.find((player) => player.seatId === viewerSeat) ?? null;
}

function getOpenTaskHint(snapshot: GameSnapshot): string | null {
  const undeclaredTask = snapshot.tasks.find((task) => task.declaredAtRound === null);
  if (!undeclaredTask) return null;
  return `目前可留意任務「${undeclaredTask.nameZh}」是否適合在營火階段主動宣告。`;
}

export function deriveNewcomerGuide(params: {
  snapshot: GameSnapshot;
  viewerRole: ViewerRole;
  viewerSeat: SeatId | null;
}): string {
  const { snapshot, viewerRole, viewerSeat } = params;
  const viewerPlayer = getViewerPlayer(snapshot, viewerSeat);

  if (!snapshot.roomConfig.newcomerGuideEnabled) {
    return "新手導引已關閉。目前仍可查看階段摘要、視窗狀態與回合紀錄。";
  }

  if (viewerRole === "observer") {
    if (snapshot.blockingWindow?.kind === "discard") {
      return `你正在觀察棄牌處理。系統目前在等待 ${snapshot.blockingWindow.targetSeat} 棄掉 ${snapshot.blockingWindow.requiredDiscardCount} 張牌。`;
    }
    if (snapshot.blockingWindow?.kind === "loss") {
      const companionHint = snapshot.blockingWindow.companionUsed
        ? "本次損失已經使用過陪伴標記，接下來會等待損失正式結算。"
        : "目前仍可由符合資格的其他玩家使用陪伴標記。";
      return `你正在觀察損失反應。受影響玩家是 ${snapshot.blockingWindow.targetSeat}，損失為 SR ${snapshot.blockingWindow.srLoss} / SP ${snapshot.blockingWindow.spLoss}，來源是${snapshot.blockingWindow.sourceLabelZh}。${companionHint}`;
    }
    if (snapshot.phase === "campfire") {
      if (snapshot.pendingCampfireResolution) {
        const stageLabel = snapshot.pendingCampfireResolution.stage === "resolve_losses"
          ? "目前在處理營火損失。"
          : snapshot.pendingCampfireResolution.stage === "apply_pressure"
            ? "目前在套用壓力與里程碑。"
            : snapshot.pendingCampfireResolution.stage === "state_check"
              ? "目前在做狀態確認。"
              : "你正在觀察營火後段處理。";
        return `${stageLabel}${snapshot.pendingCampfireResolution.summaryZh}`;
      }
      return "你正在觀察營火流程。順序為：事件結果 → 任務宣告 → 風險地格扣損 → 其他損失 → 壓力 +1 → 狀態確認 → 勝敗檢查。";
    }
    return "你正在以觀察者模式查看本局。你可檢視局面、事件、任務、視窗狀態與回合紀錄，但不能操作正式流程。";
  }

  if (snapshot.phase === "lobby") {
    return viewerRole === "host"
      ? "目前在大廳階段。請先替每個座位完成角色指派，再開始遊戲。正式開局後，本局至少要完成 2 張任務才算達標。"
      : "目前在大廳階段。請等待房主完成角色指派並開始遊戲。正式開局後，本局至少要完成 2 張任務才算達標。";
  }

  if (snapshot.blockingWindow?.kind === "discard") {
    return snapshot.blockingWindow.targetSeat === viewerSeat
      ? `你目前正在處理舊版棄牌視窗。新版規則下，手牌達上限時不會再抽牌，而不是進入棄牌流程。`
      : `目前正在等待舊版棄牌流程完成。新版規則下，手牌達上限時會直接略過抽牌，不再進入棄牌。`;
  }

  if (snapshot.blockingWindow?.kind === "loss") {
    const lossLabel = `SR ${snapshot.blockingWindow.srLoss} / SP ${snapshot.blockingWindow.spLoss}`;
    if (snapshot.blockingWindow.targetSeat === viewerSeat) {
      return `你正受到一筆損失影響（${lossLabel}，來源：${snapshot.blockingWindow.sourceLabelZh}）。請等待其他玩家是否使用陪伴標記，之後系統才會正式結算。`;
    }
    if (viewerSeat && snapshot.blockingWindow.eligibleCompanionSeatIds.includes(viewerSeat)) {
      const usedHint = snapshot.blockingWindow.companionUsed
        ? "但本次損失已經用過陪伴標記，你現在不能再介入。"
        : "你可以選擇使用陪伴標記，協助抵銷 1 點 SR / SP，或改成安撫回復 1SP。";
      return `目前有一筆損失等待即時處理（${lossLabel}，來源：${snapshot.blockingWindow.sourceLabelZh}）。${usedHint}`;
    }
    return `目前正在處理 ${snapshot.blockingWindow.targetSeat} 的損失反應。請等待可介入的玩家或系統完成結算。`;
  }

  if (snapshot.phase === "crisis") {
    return viewerRole === "host"
      ? "本輪危機已準備完成，請由你開始本輪，翻出事件並進入行動階段。"
      : "目前在危機階段。請等待房主開始本輪，翻出事件後就會進入行動階段。";
  }

  if (snapshot.phase === "action") {
    const eventHint = snapshot.currentEvent
      ? `目前事件是「${snapshot.currentEvent.nameZh}」，需求為 SR ${snapshot.currentEvent.requirement.srRequired} / SP ${snapshot.currentEvent.requirement.spRequired}。`
      : "目前事件資料載入中。";
    if (snapshot.activeSeat === viewerSeat) {
      return `現在輪到你行動。你有 ${viewerPlayer?.remainingAp ?? 0} AP，可移動、使用地格、投入事件、相鄰互助或結束回合。${eventHint}`;
    }
    return `現在輪到 ${snapshot.activeSeat ?? "其他玩家"} 行動。${eventHint} 你可以先觀察局面，準備後續互助、事件投入或營火階段宣告。`;
  }

  if (snapshot.phase === "campfire") {
    if (snapshot.pendingCampfireResolution) {
      const stageLabel = snapshot.pendingCampfireResolution.stage === "resolve_losses"
        ? "營火損失處理中。"
        : snapshot.pendingCampfireResolution.stage === "apply_pressure"
          ? "壓力與里程碑處理中。"
          : snapshot.pendingCampfireResolution.stage === "state_check"
            ? "營火狀態確認中。"
            : "營火後段處理中。";
      return `${stageLabel}${snapshot.pendingCampfireResolution.summaryZh}`;
    }

    const taskHint = getOpenTaskHint(snapshot);
    const pressureHint =
      snapshot.pressure >= 6
        ? "注意：目前壓力已達 6，若本輪沒有 0AP 相鄰互助，將不能宣告任務。"
        : snapshot.pressure >= 3
          ? "注意：壓力已達 3，之後事件若要成功，需至少 2 名不同玩家實際投入。"
          : null;

    return [
      "營火階段會依序處理：事件結果 → 任務宣告 → 風險地格扣損 → 其他損失 → 壓力 +1 → 狀態確認 → 勝敗檢查。",
      taskHint,
      pressureHint,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "本局已結束。你可以檢視事件、任務、回合紀錄與最終局面。";
}
