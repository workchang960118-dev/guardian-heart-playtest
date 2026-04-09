"use client";

import { deriveRoomUiState } from "@/domain/guardian-heart/helpers/ui/derive-room-ui-state";
import { verifyTaskDeclaration } from "@/domain/guardian-heart/helpers/tasks/task-verifier";
import { getRoleLoadout } from "@/domain/guardian-heart/helpers/roles/role-loadout";
import { ROLE_OPENING_LOADOUT_MAP } from "@/domain/guardian-heart/helpers/roles/role-loadout";
import { ACTION_CARD_DEFINITION_MAP } from "@/domain/guardian-heart/seeds/cards/minimal-action-cards";
import { GuardianHeartMapStage } from "@/components/guardian-heart/guardian-heart-map-stage";
import { DesktopCardMetaStrip } from "@/components/guardian-heart/room-client-desktop-card-channels";
import { DesktopSinglePageSurface } from "@/components/guardian-heart/room-client-desktop-surface";
import { MINIMAL_MAP } from "@/domain/guardian-heart/seeds/map/minimal-map";
import { areTilesSameOrAdjacent } from "@/domain/guardian-heart/helpers/map/tile-lookup";
import { canRecoverResource } from "@/domain/guardian-heart/helpers/resources/resource-policy";
import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import type { GameSnapshot, MapTile, PlayerState, RoomPlayerSummary, RoomSummary, SeatId, TaskState, ViewerRole } from "@/domain/guardian-heart/types/game";
import type { StateUpdatedPayload } from "@/domain/guardian-heart/types/realtime";
import type { RoomAction } from "@/domain/guardian-heart/types/room-actions";
import type { CardChannelSection, CardMetaPill } from "@/components/guardian-heart/room-client-desktop-types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type BootstrapData = {
  stateUpdatedPayload?: StateUpdatedPayload;
  room: RoomSummary;
  players: RoomPlayerSummary[];
  snapshot: GameSnapshot;
  viewerSeat: SeatId | null;
  joinToken: string;
  displayName: string;
  viewerRole: ViewerRole;
};

type ActionResponse = {
  ok: boolean;
  data?: {
    snapshot: GameSnapshot;
    version: number;
    logEntry: {
      actionType: RoomAction["type"];
      messageZh: string;
      at: string;
    };
  };
  error?: { message: string };
};

const ROLE_OPTIONS = Object.values(ROLE_OPENING_LOADOUT_MAP);

type ActionFeedbackState = {
  tone: "success" | "error";
  actionType: RoomAction["type"];
  titleZh: string;
  text: string;
  detailsZh: string[];
  occurredAt: string;
  broadcastTextZh?: string;
  suppressCenterBroadcast?: boolean;
};

type PersonalGuideStepId = "event" | "tasks" | "map" | "roster" | "hand" | "controls";
type PersonalGuideContextId = "event_intro" | "action_intro" | "help_intro" | "campfire_intro";
type PersonalGuidePrefs = {
  openingSeen: boolean;
  guideEnabled: boolean;
  zoneGuideCompleted: boolean;
  seenContexts: PersonalGuideContextId[];
};

type GuideHighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

const DEFAULT_PERSONAL_GUIDE_PREFS: PersonalGuidePrefs = {
  openingSeen: false,
  guideEnabled: false,
  zoneGuideCompleted: false,
  seenContexts: [],
};

function canReachWithinStepsClient(mapTiles: MapTile[], fromTileId: string, toTileId: string, maxSteps: number) {
  if (fromTileId === toTileId) return true;
  const queue: Array<{ tileId: string; steps: number }> = [{ tileId: fromTileId, steps: 0 }];
  const visited = new Set<string>([fromTileId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.steps >= maxSteps) continue;
    const tile = mapTiles.find((item) => item.tileId === current.tileId);
    if (!tile) continue;
    for (const adjacentTileId of tile.adjacentTileIds) {
      if (adjacentTileId === toTileId) return true;
      if (visited.has(adjacentTileId)) continue;
      visited.add(adjacentTileId);
      queue.push({ tileId: adjacentTileId, steps: current.steps + 1 });
    }
  }

  return false;
}

function countReadyTasksForSnapshot(snapshot: GameSnapshot) {
  if (snapshot.phase !== "campfire" || snapshot.blockingWindow || snapshot.pendingCampfireResolution) return 0;
  return snapshot.tasks.filter((task) => verifyTaskDeclaration(snapshot, task).ok).length;
}

function buildPlayActionCardPayload(params: {
  actorSeat: SeatId;
  cardId: string;
  targetSeat?: SeatId;
  toTileId?: string;
  resourceType?: "SR" | "SP";
  teammateResourceType?: "SR" | "SP";
}): Extract<RoomAction, { type: "play_action_card" }> {
  return {
    type: "play_action_card",
    actorSeat: params.actorSeat,
    cardId: params.cardId,
    ...(params.targetSeat ? { targetSeat: params.targetSeat } : {}),
    ...(params.toTileId ? { toTileId: params.toTileId } : {}),
    ...(params.resourceType ? { resourceType: params.resourceType } : {}),
    ...(params.teammateResourceType ? { teammateResourceType: params.teammateResourceType } : {}),
  };
}

function getCardTargetRequirement(cardId: string | "") {
  switch (cardId) {
    case "card_same_tile_care":
    case "card_hold_together":
      return "same_tile" as const;
    case "card_pull_you_a_bit":
    case "card_respond_together":
      return "same_or_adjacent" as const;
    default:
      return null;
  }
}

function getCardTargetPromptZh(cardId: string | "", requirement: ReturnType<typeof getCardTargetRequirement>) {
  if (cardId === "card_respond_together") return "請選擇 1 名同格或相鄰，且本輪尚未投入事件的隊友";
  if (requirement === "same_tile") return "請選擇 1 名同格隊友";
  if (requirement === "same_or_adjacent") return "請選擇 1 名同格或相鄰隊友";
  return null;
}

function getCardTitleZh(cardId: string | "") {
  return cardId ? ACTION_CARD_DEFINITION_MAP[cardId]?.nameZh ?? cardId : "這張牌";
}

function getPlayerLabelZh(player: PlayerState | null) {
  return player ? `${player.seatId}｜${player.displayName}` : "目標隊友";
}

function getTileLabelZh(tile: MapTile | null) {
  return tile ? `${tile.tileId}｜${tile.nameZh}` : "目標地格";
}

function getPlayerStateBySeat(snapshot: GameSnapshot, seatId: SeatId) {
  return snapshot.players.find((player) => player.seatId === seatId) ?? null;
}

function appendActionFeedbackHistory(history: ActionFeedbackState[], feedback: ActionFeedbackState, maxLength = 6) {
  return [feedback, ...history].slice(0, maxLength);
}

function buildActionFeedbackSummary(feedback: ActionFeedbackState) {
  if (feedback.broadcastTextZh) {
    return feedback.broadcastTextZh;
  }
  return [feedback.text, ...feedback.detailsZh.slice(0, 3)].join(" ");
}

function formatSignedDeltaZh(value: number) {
  return `${value > 0 ? "+" : "-"}${Math.abs(value)}`;
}

function deriveGroupedResourceChangeZh(beforeSnapshot: GameSnapshot, afterSnapshot: GameSnapshot) {
  const playerCount = afterSnapshot.players.length;
  if (playerCount === 0) return null;

  const groupedLinesZh: string[] = [];
  for (const resourceKey of ["SR", "SP"] as const) {
    const groupedSeats = new Map<number, string[]>();

    for (const playerAfter of afterSnapshot.players) {
      const playerBefore = beforeSnapshot.players.find((item) => item.seatId === playerAfter.seatId);
      if (!playerBefore) continue;
      const delta = resourceKey === "SR"
        ? playerAfter.currentSr - playerBefore.currentSr
        : playerAfter.currentSp - playerBefore.currentSp;
      if (delta === 0) continue;
      const currentSeats = groupedSeats.get(delta) ?? [];
      currentSeats.push(playerAfter.seatId);
      groupedSeats.set(delta, currentSeats);
    }

    for (const [delta, seats] of groupedSeats.entries()) {
      if (seats.length < 2) continue;
      const deltaZh = formatSignedDeltaZh(delta);
      groupedLinesZh.push(seats.length === playerCount ? `全體 ${resourceKey}${deltaZh}` : `${seats.join("、")} ${resourceKey}${deltaZh}`);
    }
  }

  return groupedLinesZh.length > 0 ? groupedLinesZh.join("｜") : null;
}

function deriveQueuedLossBroadcastZh(snapshot: GameSnapshot) {
  const losses: Array<{ seatId: SeatId; srLoss: number; spLoss: number }> = [];
  if (snapshot.blockingWindow?.kind === "loss") {
    losses.push({
      seatId: snapshot.blockingWindow.targetSeat,
      srLoss: snapshot.blockingWindow.srLoss,
      spLoss: snapshot.blockingWindow.spLoss,
    });
  }
  for (const item of snapshot.pendingLossQueue) {
    losses.push({ seatId: item.targetSeat, srLoss: item.srLoss, spLoss: item.spLoss });
  }
  if (losses.length === 0) return null;

  const playerCount = snapshot.players.length;
  const groupedLinesZh: string[] = [];
  for (const resourceKey of ["SR", "SP"] as const) {
    const groupedSeats = new Map<number, string[]>();
    for (const loss of losses) {
      const delta = resourceKey === "SR" ? -loss.srLoss : -loss.spLoss;
      if (delta === 0) continue;
      const currentSeats = groupedSeats.get(delta) ?? [];
      currentSeats.push(loss.seatId);
      groupedSeats.set(delta, currentSeats);
    }
    for (const [delta, seats] of groupedSeats.entries()) {
      if (seats.length < 2) continue;
      const deltaZh = formatSignedDeltaZh(delta);
      groupedLinesZh.push(seats.length === playerCount ? `全體${resourceKey}${deltaZh}` : `${seats.join("、")} ${resourceKey}${deltaZh}`);
    }
  }

  return groupedLinesZh.length > 0 ? groupedLinesZh.join("｜") : null;
}

type TaskSurfaceStatus = {
  key: "not_ready" | "ready_wait_campfire" | "ready_to_declare" | "declared" | "completed";
  badgeZh: string;
  tone: "stone" | "amber" | "emerald" | "sky";
  summaryZh: string;
  reasonsZh: string[];
  canDeclare: boolean;
};

function getTaskContentReadiness(snapshot: GameSnapshot, task: TaskState): { ok: true; reasonsZh: string[] } | { ok: false; reasonsZh: string[] } {
  const simulatedSnapshot: GameSnapshot = { ...snapshot, phase: "campfire", blockingWindow: null, pressure: Math.min(snapshot.pressure, 5) };
  const verification = verifyTaskDeclaration(simulatedSnapshot, task);
  if (verification.ok) {
    return { ok: true, reasonsZh: ["任務內容條件已達成。"] };
  }

  return { ok: false, reasonsZh: [verification.messageZh] };
}

function deriveTaskSurfaceStatus(snapshot: GameSnapshot, task: TaskState): TaskSurfaceStatus {
  if (task.completionCheckedByHost) {
    return {
      key: "completed",
      badgeZh: "已完成",
      tone: "emerald",
      summaryZh: `獎勵已於第 ${task.rewardGrantedAtRound ?? task.declaredAtRound ?? "—"} 輪套用。`,
      reasonsZh: ["這張任務已完成，不需再次宣告。"],
      canDeclare: false,
    };
  }

  if (task.declaredBySeat) {
    return {
      key: "declared",
      badgeZh: "已宣告",
      tone: "sky",
      summaryZh: `${task.declaredBySeat} 已於第 ${task.declaredAtRound ?? "—"} 輪宣告，等待系統處理。`,
      reasonsZh: ["這張任務已送出宣告，等待系統完成後續結算。"],
      canDeclare: false,
    };
  }

  const contentReadiness = getTaskContentReadiness(snapshot, task);
  const flowReasonsZh: string[] = [];
  if (snapshot.phase !== "campfire") flowReasonsZh.push("目前不是營火階段，還不能正式宣告任務。");
  if (snapshot.blockingWindow) flowReasonsZh.push(`目前有 ${snapshot.blockingWindow.kind} 視窗待處理，需先清空阻塞。`);
  if (snapshot.pressure >= 6 && snapshot.flags.adjacentHelpPairsThisRound.length === 0) flowReasonsZh.push("壓力已達 6，本輪需先完成 0AP 相鄰互助，任務宣告才會解鎖。");

  if (contentReadiness.ok && flowReasonsZh.length === 0) {
    return {
      key: "ready_to_declare",
      badgeZh: "可宣告",
      tone: "emerald",
      summaryZh: "條件已滿足，現在可直接宣告完成。",
      reasonsZh: ["任務內容條件已達成。", "目前流程條件也已放行。"],
      canDeclare: true,
    };
  }

  if (contentReadiness.ok) {
    return {
      key: "ready_wait_campfire",
      badgeZh: "待營火",
      tone: "amber",
      summaryZh: "條件已滿足，但還沒到正式宣告窗口。",
      reasonsZh: [...flowReasonsZh, "內容條件已達成；請等流程解鎖後再宣告。"],
      canDeclare: false,
    };
  }

  return {
    key: "not_ready",
    badgeZh: "未達成",
    tone: "stone",
    summaryZh: "這張任務目前仍有內容條件未達成。",
    reasonsZh: [...contentReadiness.reasonsZh, ...flowReasonsZh],
    canDeclare: false,
  };
}

function buildTaskProgressLines(snapshot: GameSnapshot, task: TaskState): string[] {
  const lines: string[] = [];
  const tileById = new Map(snapshot.mapTiles.map((tile) => [tile.tileId, tile] as const));
  const playersOnStations = snapshot.players.filter((player) => player.positionTileId && tileById.get(player.positionTileId)?.kind === "station");
  const playersOnShelters = snapshot.players.filter((player) => player.positionTileId && tileById.get(player.positionTileId)?.kind === "shelter");
  const srEnoughPlayers = snapshot.players.filter((player) => player.currentSr >= 3);
  const spEnoughPlayers = snapshot.players.filter((player) => player.currentSp >= 3);
  const helpCount = snapshot.flags.adjacentHelpPairsThisRound.length;
  const helpResources = new Set(snapshot.flags.adjacentHelpResourceTypesThisRound ?? []);
  const riskTileIds = new Set(snapshot.mapTiles.filter((tile) => tile.kind === "risk").map((tile) => tile.tileId));
  const riskCampers = snapshot.players.filter((player) => player.positionTileId && riskTileIds.has(player.positionTileId));
  const countsByTile = new Map<string, string[]>();
  for (const player of snapshot.players) {
    if (!player.positionTileId) continue;
    const current = countsByTile.get(player.positionTileId) ?? [];
    current.push(player.seatId);
    countsByTile.set(player.positionTileId, current);
  }
  const largestStack = Array.from(countsByTile.entries()).sort((a, b) => b[1].length - a[1].length)[0];
  const currentEventResolved = snapshot.currentEvent
    ? snapshot.currentEvent.contributions.reduce((sum, item) => sum + item.srCounted, 0) >= snapshot.currentEvent.requirement.srRequired
      && snapshot.currentEvent.contributions.reduce((sum, item) => sum + item.spCounted, 0) >= snapshot.currentEvent.requirement.spRequired
    : false;

  switch (task.taskId) {
    case "task_temporary_supply_line":
      lines.push(playersOnStations.length > 0 ? `位於物資站：${playersOnStations.map((player) => player.seatId).join("、")}` : "目前還沒有人位於物資站。");
      lines.push(`SR ≧ 3：${srEnoughPlayers.length}/2 名（${srEnoughPlayers.map((player) => player.seatId).join("、") || "尚未達標"}）`);
      break;
    case "task_comfort_circle":
      lines.push(playersOnShelters.length > 0 ? `位於庇護所：${playersOnShelters.map((player) => player.seatId).join("、")}` : "目前還沒有人位於庇護所。");
      lines.push(`SP ≧ 3：${spEnoughPlayers.length}/2 名（${spEnoughPlayers.map((player) => player.seatId).join("、") || "尚未達標"}）`);
      break;
    case "task_neighborhood_relay":
      lines.push(`0AP 相鄰互助：${helpCount}/2 次`);
      lines.push(helpCount > 0 ? `已記錄互助資源：${Array.from(helpResources).join("、") || "尚未分類"}` : "本輪尚未發生任何 0AP 相鄰互助。");
      break;
    case "task_crisis_control":
      lines.push(snapshot.currentEvent ? (currentEventResolved ? "本輪事件已達數值需求。" : "本輪事件尚未完全解決。") : "目前沒有事件可判定。" );
      lines.push(riskCampers.length === 0 ? "目前無人停留在風險地格。" : `仍位於風險地格：${riskCampers.map((player) => player.seatId).join("、")}`);
      break;
    case "task_small_gathering_point":
      lines.push(largestStack ? `${largestStack[0]} 目前有 ${largestStack[1].length} 人同格（${largestStack[1].join("、")}）` : "目前沒有可用位置資訊。" );
      lines.push(`距離達標還差 ${Math.max(0, 3 - (largestStack?.[1].length ?? 0))} 人。`);
      break;
    case "task_support_network_formed":
      lines.push(`0AP 相鄰互助：${helpCount}/2 次`);
      lines.push(`SR 互助：${helpResources.has("SR") ? "已出現" : "尚未出現"}｜SP 互助：${helpResources.has("SP") ? "已出現" : "尚未出現"}`);
      break;
    default:
      lines.push("請依任務條件與目前場上狀態判讀。");
      break;
  }

  lines.push(snapshot.phase === "campfire" ? "目前位於營火階段，可檢查是否已解鎖正式宣告。" : `目前是${phaseLabel(snapshot.phase)}，還沒進到任務宣告窗口。`);
  return lines.filter(Boolean);
}

function splitEventRulesText(rulesTextZh: string) {
  const [effectPart, requirementPart] = rulesTextZh.split("解決條件：");
  return {
    immediateEffectZh: effectPart?.replace(/^立即效果：/, "").trim() || "請查看正式事件效果。",
    requirementDetailZh: requirementPart?.trim() || rulesTextZh,
  };
}

function formatEventTagZh(tag: string): string | null {
  const labelMap: Record<string, string> = {
    sr: "SR 壓力",
    sp: "SP 壓力",
    all_players: "全體影響",
    sealed: "固定池",
    first_round_pool: "首輪池",
    mixed: "混合需求",
    two_targets: "雙目標",
    tempo: "節奏壓力",
    choice: "自選懲罰",
    mutual_aid: "互助檢驗",
    isolation: "孤立檢驗",
    observe_4sp: "高 SP 需求",
    high_pressure: "高壓事件",
  };

  return labelMap[tag] ?? null;
}

function buildHandCardInstanceKey(cardId: string, index: number) {
  return `${cardId}::${index}`;
}

function getInitialHandCardSelection(handCardIds: string[]) {
  return {
    cardId: "",
    instanceKey: "",
  };
}

function buildActionCardMetaPills(cardId: string): CardMetaPill[] {
  const card = ACTION_CARD_DEFINITION_MAP[cardId];
  if (!card) return [];
  const categoryTone = card.category === "mobility" ? "sky" : card.category === "event_response" ? "amber" : "emerald";
  const categoryLabelZh = card.category === "mobility" ? "機動" : card.category === "event_response" ? "事件應對" : "支援";
  return [
    { key: `${cardId}-category`, labelZh: categoryLabelZh, tone: categoryTone },
    { key: `${cardId}-ap`, labelZh: `AP ${card.apCost}`, tone: "stone" },
  ];
}

function buildActionCardChannels(cardId: string): CardChannelSection[] {
  const card = ACTION_CARD_DEFINITION_MAP[cardId];
  if (!card) return [];
  return [
    { key: `${cardId}-rules`, titleZh: "牌面規則", bodyZh: card.rulesTextZh, tone: "stone" },
    { key: `${cardId}-hint`, titleZh: "戰術提示", bodyZh: card.noteZh || "正式版可接入更完整的使用提示。", tone: "violet" },
  ];
}

function buildEventCardMetaPills(snapshot: GameSnapshot): CardMetaPill[] {
  if (!snapshot.currentEvent) return [];
  const event = snapshot.currentEvent;
  return [
    { key: `${event.cardId}-round`, labelZh: `R${event.revealedAtRound}`, tone: "stone" },
    ...event.tags
      .map((tag) => ({ tag, labelZh: formatEventTagZh(tag) }))
      .filter((item): item is { tag: string; labelZh: string } => Boolean(item.labelZh))
      .slice(0, 3)
      .map((item) => ({ key: `${event.cardId}-${item.tag}`, labelZh: item.labelZh, tone: "amber" as const })),
  ];
}

function buildEventCardChannels(snapshot: GameSnapshot): CardChannelSection[] {
  if (!snapshot.currentEvent) return [];
  const event = snapshot.currentEvent;
  const { immediateEffectZh } = splitEventRulesText(event.rulesTextZh);
  return [{ key: `${event.cardId}-immediate`, titleZh: "立即效果", bodyZh: immediateEffectZh, tone: "rose" }];
}

function buildEnvironmentPills(snapshot: GameSnapshot): CardMetaPill[] {
  return buildEventCardMetaPills(snapshot);
}

function buildActionFeedbackState(params: {
  action: RoomAction;
  beforeSnapshot: GameSnapshot;
  afterSnapshot?: GameSnapshot;
  logMessageZh?: string;
  errorMessageZh?: string;
}) : ActionFeedbackState {
  const { action, beforeSnapshot, afterSnapshot, logMessageZh, errorMessageZh } = params;
  const titleZh = describeRoomActionZh(action, beforeSnapshot);

  if (!afterSnapshot) {
    return {
      tone: "error",
      actionType: action.type,
      titleZh,
      text: `${titleZh}失敗`,
      detailsZh: [errorMessageZh ?? "請稍後再試。"],
      occurredAt: new Date().toISOString(),
    };
  }

  const detailsZh: string[] = [];
  if (logMessageZh) detailsZh.push(logMessageZh);
  const groupedResourceChangeZh = deriveGroupedResourceChangeZh(beforeSnapshot, afterSnapshot);
  let broadcastTextZh: string | undefined;
  let suppressCenterBroadcast = false;

  switch (action.type) {
    case "move": {
      const actorAfter = getPlayerStateBySeat(afterSnapshot, action.actorSeat);
      if (actorAfter) {
        detailsZh.push(`你目前位於 ${actorAfter.positionTileId ?? "—"}，剩餘 AP ${actorAfter.remainingAp}。`);
      }
      break;
    }
    case "use_station_or_shelter": {
      const actorAfter = getPlayerStateBySeat(afterSnapshot, action.actorSeat);
      if (actorAfter) {
        detailsZh.push(`使用後資源：SR ${actorAfter.currentSr} / SP ${actorAfter.currentSp}，剩餘 AP ${actorAfter.remainingAp}。`);
      }
      break;
    }
    case "invest_event": {
      const event = afterSnapshot.currentEvent;
      if (event) {
        const totalSr = event.contributions.reduce((sum, item) => sum + item.srCounted, 0);
        const totalSp = event.contributions.reduce((sum, item) => sum + item.spCounted, 0);
        detailsZh.push(`事件處理區目前累計 SR ${totalSr}/${event.requirement.srRequired}、SP ${totalSp}/${event.requirement.spRequired}。`);
      }
      const actorAfter = getPlayerStateBySeat(afterSnapshot, action.actorSeat);
      if (actorAfter) {
        detailsZh.push(`投入後你剩餘：SR ${actorAfter.currentSr} / SP ${actorAfter.currentSp}。`);
      }
      break;
    }
    case "adjacent_help": {
      const actorBefore = getPlayerStateBySeat(beforeSnapshot, action.actorSeat);
      const actorAfter = getPlayerStateBySeat(afterSnapshot, action.actorSeat);
      const targetBefore = getPlayerStateBySeat(beforeSnapshot, action.targetSeat);
      const targetAfter = getPlayerStateBySeat(afterSnapshot, action.targetSeat);
      if (actorAfter && targetAfter) {
        detailsZh.push(`互助後 ${action.actorSeat}：SR ${actorAfter.currentSr} / SP ${actorAfter.currentSp}；${action.targetSeat}：SR ${targetAfter.currentSr} / SP ${targetAfter.currentSp}。`);
      }
      if (action.resourceType === "SP" && actorBefore?.roleId === "medic_apprentice" && actorBefore.roleAbilityUsesRemaining > 0) {
        const targetSpDelta = (targetAfter?.currentSp ?? 0) - (targetBefore?.currentSp ?? 0);
        const abilitySpent = (actorBefore?.roleAbilityUsesRemaining ?? 0) > (actorAfter?.roleAbilityUsesRemaining ?? 0);
        if (abilitySpent || targetSpDelta >= 2) {
          detailsZh.push("〈安定陪伴〉已觸發：目標額外回復 1SP。")
        } else {
          detailsZh.push("這次是 SP 互助，但沒有額外回復 1SP；可能是目標回復後已達上限，或能力條件未成立。")
        }
      }
      if (action.freeMoveSeat && action.freeMoveToTileId && actorBefore?.roleId === "alley_messenger") {
        const movedPlayerBefore = getPlayerStateBySeat(beforeSnapshot, action.freeMoveSeat);
        const movedPlayerAfter = getPlayerStateBySeat(afterSnapshot, action.freeMoveSeat);
        if (movedPlayerBefore?.positionTileId !== movedPlayerAfter?.positionTileId) {
          detailsZh.push(`〈牽起連結〉已生效：${action.freeMoveSeat} ${movedPlayerBefore?.positionTileId ?? "—"} → ${movedPlayerAfter?.positionTileId ?? action.freeMoveToTileId}。`)
        }
      }
      break;
    }
    case "play_action_card": {
      const actorAfter = getPlayerStateBySeat(afterSnapshot, action.actorSeat);
      const card = ACTION_CARD_DEFINITION_MAP[action.cardId];
      if (card) {
        detailsZh.push(`已處理〈${card.nameZh}〉，你目前手牌 ${actorAfter?.handCardIds.length ?? "—"} 張，剩餘 AP ${actorAfter?.remainingAp ?? "—"}。`);
      }
      break;
    }
    case "declare_task": {
      const completedCount = afterSnapshot.tasks.filter((task) => task.completionCheckedByHost).length;
      detailsZh.push(`目前任務進度：已完成 ${completedCount}/${afterSnapshot.tasks.length} 張可見任務。`);
      break;
    }
    case "start_round": {
      const isInitialRoundReveal = beforeSnapshot.phase === "lobby" || beforeSnapshot.round === 0;
      if (isInitialRoundReveal) {
        suppressCenterBroadcast = true;
        break;
      }
      if (afterSnapshot.currentEvent) {
        const currentRoundZh = afterSnapshot.round > 0 ? `第 ${afterSnapshot.round} 輪` : "新一輪";
        broadcastTextZh = `${currentRoundZh}｜抽出事件〈${afterSnapshot.currentEvent.nameZh}〉`;
        detailsZh.unshift(`抽出事件：${afterSnapshot.currentEvent.nameZh}。`);
      }
      break;
    }
    case "resolve_campfire": {
      const queuedLossBroadcastZh = deriveQueuedLossBroadcastZh(afterSnapshot);
      if (queuedLossBroadcastZh) {
        broadcastTextZh = queuedLossBroadcastZh;
      }
      break;
    }
    case "finalize_pending_loss": {
      suppressCenterBroadcast = true;
      break;
    }
    case "resolve_role_ability": {
      suppressCenterBroadcast = true;
      break;
    }
    case "start_game": {
      suppressCenterBroadcast = true;
      break;
    }
    default:
      break;
  }

  if (!broadcastTextZh && groupedResourceChangeZh) {
    broadcastTextZh = groupedResourceChangeZh;
  }

  return {
    tone: "success",
    actionType: action.type,
    titleZh,
    text: `${titleZh}成功`,
    detailsZh,
    occurredAt: new Date().toISOString(),
    broadcastTextZh,
    suppressCenterBroadcast,
  };
}

function describeRoomActionZh(action: RoomAction, snapshot: GameSnapshot) {
  switch (action.type) {
    case "start_game":
      return "開始遊戲";
    case "start_round":
      return "開始本輪";
    case "move": {
      const tile = snapshot.mapTiles.find((item) => item.tileId === action.toTileId);
      return `移動到 ${tile?.nameZh ?? action.toTileId}`;
    }
    case "use_station_or_shelter":
      return "使用目前地格效果";
    case "invest_event":
      return `投入事件（SR ${action.srPaid} / SP ${action.spPaid}）`;
    case "adjacent_help":
      return action.freeMoveSeat && action.freeMoveToTileId
        ? `對 ${action.targetSeat} 進行相鄰互助（${action.resourceType}），並連動免費移動`
        : `對 ${action.targetSeat} 進行相鄰互助（${action.resourceType}）`;
    case "play_action_card": {
      const card = ACTION_CARD_DEFINITION_MAP[action.cardId];
      return `使用行動卡：${card?.nameZh ?? action.cardId}`;
    }
    case "end_turn":
      return "結束回合";
    case "discard_cards":
      return `棄牌 ${action.discardedCardIds.length} 張`;
    case "use_companion_token":
      return action.mode === "comfort" ? "使用陪伴標記（安撫）" : "使用陪伴標記（抵銷損失）";
    case "finalize_pending_loss":
      return "完成目前損失處理";
    case "declare_task": {
      const task = snapshot.tasks.find((item) => item.taskId === action.taskId);
      return `宣告任務：${task?.nameZh ?? action.taskId}`;
    }
    case "resolve_campfire":
      return "處理營火";
    case "resolve_role_ability":
      return action.mode === "use" ? "發動角色技能" : "略過角色技能";
    case "assign_role":
      return `指派 ${action.targetSeat} 角色`;
    case "update_room_config":
      return "更新房間設定";
    case "run_ai_turn":
      return "執行 AI 推進";
    default:
      return "送出操作";
  }
}

export function RoomClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoleBySeat, setSelectedRoleBySeat] = useState<Record<string, string>>({
    P1: "merchant_guard",
    P2: "medic_apprentice",
    P3: "bell_tower_observer",
    P4: "alley_messenger",
  });
  const [selectedMoveTileId, setSelectedMoveTileId] = useState("");
  const [selectedMapTileId, setSelectedMapTileId] = useState("");
  const [selectedHelpTargetSeat, setSelectedHelpTargetSeat] = useState<SeatId>("P2");
  const [selectedHelpResource, setSelectedHelpResource] = useState<"SR" | "SP">("SP");
  const [investSr, setInvestSr] = useState(1);
  const [investSp, setInvestSp] = useState(0);
  const [selectedInvestConversion, setSelectedInvestConversion] = useState<"" | "SR_TO_SP" | "SP_TO_SR">("");
  const [selectedHelpFreeMoveSeat, setSelectedHelpFreeMoveSeat] = useState<"" | SeatId>("");
  const [selectedHelpFreeMoveTileId, setSelectedHelpFreeMoveTileId] = useState("");
  const [selectedRangerAbilityMode, setSelectedRangerAbilityMode] = useState<"" | "use" | "skip">("");
  const [selectedMedicAbilityMode, setSelectedMedicAbilityMode] = useState<"" | "use" | "skip">("");
  const [selectedMessengerAbilityMode, setSelectedMessengerAbilityMode] = useState<"" | "use" | "skip">("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedActionCardId, setSelectedActionCardId] = useState("");
  const [selectedActionCardInstanceKey, setSelectedActionCardInstanceKey] = useState("");
  const [selectedCardTargetSeat, setSelectedCardTargetSeat] = useState<"" | SeatId>("");
  const [selectedCardTileId, setSelectedCardTileId] = useState("");
  const [selectedCardResourceType, setSelectedCardResourceType] = useState<"SR" | "SP">("SP");
  const [selectedCardTeammateResourceType, setSelectedCardTeammateResourceType] = useState<"SR" | "SP">("SP");
  const [persistedLogStatusZh, setPersistedLogStatusZh] = useState("正式回合紀錄尚未同步");
  const [mapActionFeedbackZh, setMapActionFeedbackZh] = useState<string | null>(null);
  const [latestActionFeedback, setLatestActionFeedback] = useState<ActionFeedbackState | null>(null);
  const [actionFeedbackHistory, setActionFeedbackHistory] = useState<ActionFeedbackState[]>([]);
  const [showSettlement, setShowSettlement] = useState(false);
  const [showNewcomerGuideModal, setShowNewcomerGuideModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showWorldviewModal, setShowWorldviewModal] = useState(false);
  const [openingOnboardingStep, setOpeningOnboardingStep] = useState<null | "worldview" | "victory" | "ask_guide">(null);
  const [personalGuideWalkthroughStep, setPersonalGuideWalkthroughStep] = useState<number | null>(null);
  const [personalGuideContextPrompt, setPersonalGuideContextPrompt] = useState<PersonalGuideContextId | null>(null);
  const [personalGuidePrefs, setPersonalGuidePrefs] = useState<PersonalGuidePrefs>(DEFAULT_PERSONAL_GUIDE_PREFS);
  const [personalGuidePrefsReady, setPersonalGuidePrefsReady] = useState(false);
  const [showEventRevealModal, setShowEventRevealModal] = useState(false);
  const [showMobileTasksDrawer, setShowMobileTasksDrawer] = useState(false);
  const [showMobileHandDrawer, setShowMobileHandDrawer] = useState(false);
  const [showMobileActionFeedDrawer, setShowMobileActionFeedDrawer] = useState(false);
  const [showCenterBroadcast, setShowCenterBroadcast] = useState(false);
  const [showTurnToast, setShowTurnToast] = useState(false);
  const [lobbyShareFeedbackZh, setLobbyShareFeedbackZh] = useState("");
  const [pulsePressure, setPulsePressure] = useState(false);
  const [pulseTaskRail, setPulseTaskRail] = useState(false);
  const [showNightTransitionModal, setShowNightTransitionModal] = useState(false);
  const [nightTransitionInfo, setNightTransitionInfo] = useState<{ pressureBefore: number; pressureAfter: number; remainingDays: number; previousRemainingDays: number } | null>(null);
  const [nightTransitionAnimated, setNightTransitionAnimated] = useState(false);
  const [guideHighlightRect, setGuideHighlightRect] = useState<GuideHighlightRect | null>(null);
  const [guideDialogPlacement, setGuideDialogPlacement] = useState<{ top: number; left: number; width: number; maxHeight: string } | null>(null);
  const [pendingEventRevealKey, setPendingEventRevealKey] = useState<string | null>(null);
  const [dismissedCampfireTaskWindowKey, setDismissedCampfireTaskWindowKey] = useState("");
  const isGuideOverlayActive = Boolean(openingOnboardingStep || showNewcomerGuideModal || personalGuideContextPrompt);

  const suggestedSimulationLinks = useMemo(() => {
    if (!data) return [] as Array<{ href: string; labelZh: string }>;
    const links: Array<{ href: string; labelZh: string }> = [];
    links.push({ href: "/simulation?presetId=cap_mode_baseline", labelZh: data.snapshot.roomConfig.resourceCapMode === "uncapped" ? "比較無上限與有上限" : "回看資源上限比較" });
    if (data.snapshot.roomConfig.actionDeckProfileId !== "core_baseline") {
      links.push({ href: "/simulation?presetId=action_profile_response", labelZh: "回看行動牌池差異" });
    }
    if (data.snapshot.roomConfig.eventPoolProfileId !== "first_round_full_8" || data.snapshot.roomConfig.taskPoolProfileId !== "first_round_full_6") {
      links.push({ href: "/simulation?presetId=pool_profile_compact", labelZh: "回看事件／任務池差異" });
    }
    if (!links.find((item) => item.href.includes("action_profile_response"))) {
      links.push({ href: "/simulation?presetId=action_profile_response", labelZh: "看行動牌池比較" });
    }
    if (!links.find((item) => item.href.includes("pool_profile_compact"))) {
      links.push({ href: "/simulation?presetId=pool_profile_compact", labelZh: "看事件／任務池比較" });
    }
    return links.slice(0, 3);
  }, [data]);
  const [showFullLog, setShowFullLog] = useState(false);
  const latestVersionRef = useRef(0);
  const latestRevisionRef = useRef(0);
  const aiTickRef = useRef<number | null>(null);
  const lastEventRevealKeyRef = useRef("");
  const autoStartRoundKeyRef = useRef("");
  const autoCampfireKeyRef = useRef("");
  const previousPressureRef = useRef<number | null>(null);
  const previousCompletedTasksRef = useRef<number | null>(null);
  const previousActiveSeatRef = useRef<SeatId | null>(null);
  const previousPhaseRef = useRef<GameSnapshot["phase"] | null>(null);
  const lastGuideScrollKeyRef = useRef("");
  const lobbyShareFeedbackTimeoutRef = useRef<number | null>(null);

  const joinToken = searchParams.get("joinToken") ?? "";
  const displayName = searchParams.get("displayName") ?? "";
  const personalGuideStorageKey = useMemo(() => {
    if (!roomCode) return null;
    const actorKey = joinToken || data?.joinToken || data?.viewerSeat || data?.viewerRole || "viewer";
    return `guardian-heart-personal-guide:${roomCode}:${actorKey}`;
  }, [roomCode, joinToken, data?.joinToken, data?.viewerSeat, data?.viewerRole]);
  const campfireTaskWindowKey = data && data.snapshot.phase === "campfire" && !data.snapshot.blockingWindow && !data.snapshot.pendingCampfireResolution
    ? `${data.snapshot.roomRevision}:campfire-task-window`
    : "";
  const preResolveCampfireReadyTaskCount = data ? countReadyTasksForSnapshot(data.snapshot) : 0;
  const campfireTaskWindowVisible = Boolean(campfireTaskWindowKey) && dismissedCampfireTaskWindowKey !== campfireTaskWindowKey;

  function clearSelectedActionCard() {
    setSelectedActionCardId("");
    setSelectedActionCardInstanceKey("");
    setSelectedCardTargetSeat("");
    setSelectedCardTileId("");
    setSelectedCardResourceType("SP");
    setSelectedCardTeammateResourceType("SP");
  }

  function toggleSelectedActionCard(cardId: string, instanceKey: string = cardId) {
    const shouldClear = selectedActionCardId === cardId && selectedActionCardInstanceKey === instanceKey;
    if (shouldClear) {
      clearSelectedActionCard();
      return;
    }
    setSelectedActionCardId(cardId);
    setSelectedActionCardInstanceKey(instanceKey);
    setSelectedCardTargetSeat("");
    setSelectedCardTileId("");
    setSelectedCardResourceType("SP");
    setSelectedCardTeammateResourceType("SP");
  }

  function setLobbyShareFeedback(messageZh: string) {
    setLobbyShareFeedbackZh(messageZh);
    if (typeof window === "undefined") return;
    if (lobbyShareFeedbackTimeoutRef.current) {
      window.clearTimeout(lobbyShareFeedbackTimeoutRef.current);
    }
    lobbyShareFeedbackTimeoutRef.current = window.setTimeout(() => {
      setLobbyShareFeedbackZh("");
      lobbyShareFeedbackTimeoutRef.current = null;
    }, 2600);
  }

  async function copyLobbyRoomCode() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setLobbyShareFeedback(`已複製房號 ${roomCode}。玩家可用房號加入。`);
    } catch {
      setLobbyShareFeedback("複製失敗，請手動分享房號。");
    }
  }

  async function copyLobbyObserverLink() {
    if (typeof window === "undefined") return;
    const observerUrl = `${window.location.origin}/rooms/${roomCode}`;
    try {
      await navigator.clipboard.writeText(observerUrl);
      setLobbyShareFeedback("已複製旁觀連結。分享給其他人可直接旁觀。");
    } catch {
      setLobbyShareFeedback("複製失敗，請手動複製旁觀連結。");
    }
  }

  async function bootstrap() {
    setLoading(true);

    try {
      const body = {
        roomCode,
        joinToken: joinToken || null,
        displayName: displayName || null,
        bootstrapAsObserver: !joinToken,
      };
      const response = await fetch("/api/rooms/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ApiResponse<BootstrapData>;

      if (!result.ok) {
        return;
      }

      setData(result.data);
      setLatestActionFeedback(null);
      setActionFeedbackHistory([]);
      setSelectedTaskId("");
      {
        const viewerHandCardIds = result.data.snapshot.players.find((player) => player.seatId === result.data.viewerSeat)?.handCardIds ?? [];
        const initialSelection = getInitialHandCardSelection(viewerHandCardIds);
        setSelectedActionCardId(initialSelection.cardId);
        setSelectedActionCardInstanceKey(initialSelection.instanceKey);
      }
      setSelectedMapTileId("");

      if (result.data.joinToken !== joinToken || result.data.displayName !== displayName) {
        const query = new URLSearchParams({
          joinToken: result.data.joinToken,
          displayName: result.data.displayName,
        });
        router.replace(`/rooms/${roomCode}?${query.toString()}`);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && lobbyShareFeedbackTimeoutRef.current) {
        window.clearTimeout(lobbyShareFeedbackTimeoutRef.current);
      }
    };
  }, []);


  useEffect(() => {
    if (!data) return;
    if (data.snapshot.phase === "gameover" || data.snapshot.status === "finished") {
      setShowSettlement(true);
    }
  }, [data?.snapshot.phase, data?.snapshot.status]);

  useEffect(() => {
    if (!data) return;
    latestVersionRef.current = data.room.version;
    latestRevisionRef.current = data.snapshot.roomRevision;
  }, [data]);

  useEffect(() => {
    if (!data) return;

    setSelectedMapTileId((current) => {
      const uiMapTiles = data.snapshot.mapTiles.length > 0 ? data.snapshot.mapTiles : MINIMAL_MAP;
      if (current && uiMapTiles.some((tile) => tile.tileId === current)) {
        return current;
      }

      return "";
    });

    setSelectedMoveTileId((current) => {
      if (!current) return current;
      const viewerPlayer = data.viewerSeat
        ? data.snapshot.players.find((player) => player.seatId === data.viewerSeat) ?? null
        : null;
      const viewerTile = viewerPlayer?.positionTileId
        ? data.snapshot.mapTiles.find((tile) => tile.tileId === viewerPlayer.positionTileId) ?? null
        : null;
      if (!viewerTile) return "";
      return viewerTile.adjacentTileIds.includes(current) ? current : "";
    });
  }, [data]);

  const uiState = useMemo(() => {
    if (!data) return null;
    return deriveRoomUiState({
      room: data.room,
      snapshot: data.snapshot,
      players: data.players,
      viewerRole: data.viewerRole,
      viewerSeat: data.viewerSeat,
    });
  }, [data]);

  useEffect(() => {
    if (!personalGuideStorageKey || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(personalGuideStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersonalGuidePrefs>;
        setPersonalGuidePrefs({
          openingSeen: parsed.openingSeen ?? false,
          guideEnabled: parsed.guideEnabled ?? false,
          zoneGuideCompleted: parsed.zoneGuideCompleted ?? false,
          seenContexts: Array.isArray(parsed.seenContexts) ? parsed.seenContexts.filter(Boolean) as PersonalGuideContextId[] : [],
        });
      } else {
        setPersonalGuidePrefs(DEFAULT_PERSONAL_GUIDE_PREFS);
      }
    } catch {
      setPersonalGuidePrefs(DEFAULT_PERSONAL_GUIDE_PREFS);
    } finally {
      setPersonalGuidePrefsReady(true);
    }
  }, [personalGuideStorageKey]);

  useEffect(() => {
    if (!personalGuidePrefsReady || !personalGuideStorageKey || typeof window === "undefined") return;
    window.sessionStorage.setItem(personalGuideStorageKey, JSON.stringify(personalGuidePrefs));
  }, [personalGuidePrefs, personalGuidePrefsReady, personalGuideStorageKey]);

  useEffect(() => {
    if (isGuideOverlayActive) {
      setShowCenterBroadcast(false);
      setShowTurnToast(false);
    }
  }, [isGuideOverlayActive]);

  useEffect(() => {
    if (!latestActionFeedback) return;
    if (isGuideOverlayActive) {
      setShowCenterBroadcast(false);
      return;
    }
    if (latestActionFeedback.suppressCenterBroadcast) {
      setShowCenterBroadcast(false);
      return;
    }
    setShowCenterBroadcast(true);
    const timeout = window.setTimeout(() => setShowCenterBroadcast(false), latestActionFeedback.tone === "error" ? 3200 : 2600);
    return () => window.clearTimeout(timeout);
  }, [isGuideOverlayActive, latestActionFeedback?.occurredAt, latestActionFeedback?.tone, latestActionFeedback?.suppressCenterBroadcast]);

  useEffect(() => {
    if (!data || !uiState || submitting || data.viewerRole !== "host") return;
    if (showNightTransitionModal) return;
    if (data.room.phase !== "crisis" || !uiState.canStartRound) return;
    const autoKey = `${data.snapshot.roomRevision}:${data.room.phase}:start_round`;
    if (autoStartRoundKeyRef.current === autoKey) return;
    autoStartRoundKeyRef.current = autoKey;
    void runAction({ type: "start_round", actorSeat: data.viewerSeat ?? "P1" });
  }, [data?.room.phase, data?.snapshot.roomRevision, data?.viewerRole, data?.viewerSeat, uiState?.canStartRound, showNightTransitionModal, submitting]);

  useEffect(() => {
    if (!data || !uiState || submitting || data.viewerRole !== "host") return;
    if (data.room.phase !== "campfire" || !uiState.canResolveCampfire || data.snapshot.blockingWindow || data.snapshot.pendingCampfireResolution) return;
    const autoKey = `${data.snapshot.roomRevision}:${data.room.phase}:resolve_campfire`;
    if (autoCampfireKeyRef.current === autoKey) return;
    if (campfireTaskWindowVisible && preResolveCampfireReadyTaskCount > 0) return;
    autoCampfireKeyRef.current = autoKey;
    const timer = window.setTimeout(() => {
      void runAction({ type: "resolve_campfire", actorSeat: data.viewerSeat ?? "P1" });
    }, campfireTaskWindowVisible ? 900 : 0);
    return () => window.clearTimeout(timer);
  }, [
    data?.room.phase,
    data?.snapshot.roomRevision,
    data?.snapshot.blockingWindow,
    data?.snapshot.pendingCampfireResolution,
    data?.viewerRole,
    data?.viewerSeat,
    uiState?.canResolveCampfire,
    submitting,
    campfireTaskWindowVisible,
    preResolveCampfireReadyTaskCount,
  ]);

  useEffect(() => {
    if (!campfireTaskWindowKey && dismissedCampfireTaskWindowKey) {
      setDismissedCampfireTaskWindowKey("");
    }
  }, [campfireTaskWindowKey, dismissedCampfireTaskWindowKey]);

  useEffect(() => {
    if (!data) return;
    if (previousPressureRef.current !== null && previousPressureRef.current !== data.snapshot.pressure) {
      setPulsePressure(true);
      if (data.snapshot.pressure > previousPressureRef.current && data.snapshot.phase !== "lobby") {
        const remainingDays = Math.max(7 - data.snapshot.round, 0);
        setNightTransitionInfo({
          pressureBefore: previousPressureRef.current,
          pressureAfter: data.snapshot.pressure,
          remainingDays,
          previousRemainingDays: Math.min(7, remainingDays + 1),
        });
        setShowNightTransitionModal(true);
      }
      const timeout = window.setTimeout(() => setPulsePressure(false), 1200);
      previousPressureRef.current = data.snapshot.pressure;
      return () => window.clearTimeout(timeout);
    }
    previousPressureRef.current = data.snapshot.pressure;
  }, [data?.snapshot.pressure, data?.snapshot.phase, data?.snapshot.round]);

  useEffect(() => {
    if (!data) return;
    const completedCount = data.snapshot.tasks.filter((task) => task.completionCheckedByHost).length;
    if (previousCompletedTasksRef.current !== null && previousCompletedTasksRef.current < completedCount) {
      setPulseTaskRail(true);
      const timeout = window.setTimeout(() => setPulseTaskRail(false), 1400);
      previousCompletedTasksRef.current = completedCount;
      return () => window.clearTimeout(timeout);
    }
    previousCompletedTasksRef.current = completedCount;
  }, [data?.snapshot.tasks]);

  useEffect(() => {
    if (!data || data.snapshot.phase !== "action") return;
    const nextSeat = data.snapshot.activeSeat ?? null;
    if (previousActiveSeatRef.current && previousActiveSeatRef.current !== nextSeat && nextSeat === data.viewerSeat) {
      setShowTurnToast(true);
      const timeout = window.setTimeout(() => setShowTurnToast(false), 1200);
      previousActiveSeatRef.current = nextSeat;
      return () => window.clearTimeout(timeout);
    }
    previousActiveSeatRef.current = nextSeat;
  }, [data?.snapshot.activeSeat, data?.snapshot.phase, data?.viewerSeat]);


  useEffect(() => {
    if (!data || !personalGuidePrefsReady) return;
    const currentPhase = data.snapshot.phase;
    const previousPhase = previousPhaseRef.current;

    if (currentPhase === "lobby") {
      previousPhaseRef.current = currentPhase;
      setOpeningOnboardingStep(null);
      setPersonalGuideWalkthroughStep(null);
      setPersonalGuideContextPrompt(null);
      return;
    }

    if (previousPhase === "lobby" && data.viewerRole !== "observer" && !personalGuidePrefs.openingSeen) {
      setOpeningOnboardingStep("worldview");
      setPersonalGuidePrefs((current) => ({ ...current, openingSeen: true }));
    }

    previousPhaseRef.current = currentPhase;
  }, [data?.snapshot.phase, data?.viewerRole, personalGuidePrefs.openingSeen, personalGuidePrefsReady]);

  useEffect(() => {
    if (!data?.snapshot.currentEvent) return;
    if (data.snapshot.phase === "lobby") return;
    const revealKey = `${data.snapshot.currentEvent.cardId}:${data.snapshot.currentEvent.revealedAtRound}`;
    if (lastEventRevealKeyRef.current === revealKey) return;
    lastEventRevealKeyRef.current = revealKey;
    if (showNightTransitionModal || openingOnboardingStep || personalGuideWalkthroughStep !== null || personalGuideContextPrompt) {
      setPendingEventRevealKey(revealKey);
      return;
    }
    setShowEventRevealModal(true);
  }, [data?.snapshot.currentEvent?.cardId, data?.snapshot.currentEvent?.revealedAtRound, data?.snapshot.phase, showNightTransitionModal, openingOnboardingStep, personalGuideWalkthroughStep, personalGuideContextPrompt]);

  useEffect(() => {
    if (!showNightTransitionModal) return;
    const timer = window.setTimeout(() => {
      setShowNightTransitionModal(false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [showNightTransitionModal]);

  useEffect(() => {
    if (showNightTransitionModal || !pendingEventRevealKey) return;
    if (openingOnboardingStep || personalGuideWalkthroughStep !== null || personalGuideContextPrompt) return;
    setShowEventRevealModal(true);
    setPendingEventRevealKey(null);
  }, [showNightTransitionModal, pendingEventRevealKey, openingOnboardingStep, personalGuideWalkthroughStep, personalGuideContextPrompt]);

  useEffect(() => {
    if (!data || !personalGuidePrefsReady || data.viewerRole === "observer") return;
    if (data.snapshot.phase === "lobby") return;
    if (openingOnboardingStep || personalGuideContextPrompt || showEventRevealModal || showNightTransitionModal) return;
    if (personalGuidePrefs.guideEnabled && !personalGuidePrefs.zoneGuideCompleted && personalGuideWalkthroughStep === null) {
      setPersonalGuideWalkthroughStep(0);
      setShowNewcomerGuideModal(true);
    }
  }, [data?.snapshot.phase, data?.viewerRole, personalGuidePrefs.guideEnabled, personalGuidePrefs.zoneGuideCompleted, personalGuidePrefsReady, openingOnboardingStep, personalGuideWalkthroughStep, personalGuideContextPrompt, showEventRevealModal, showNightTransitionModal]);

  useEffect(() => {
    if (!data || !personalGuidePrefsReady || data.viewerRole === "observer") return;
    if (!personalGuidePrefs.guideEnabled || !personalGuidePrefs.zoneGuideCompleted) return;
    if (data.snapshot.round !== 1) return;
    if (openingOnboardingStep || personalGuideWalkthroughStep !== null || personalGuideContextPrompt || showEventRevealModal || showNightTransitionModal) return;

    const seenContexts = new Set(personalGuidePrefs.seenContexts);
    if (!seenContexts.has("event_intro") && data.snapshot.currentEvent && data.snapshot.phase !== "lobby") {
      setPersonalGuideContextPrompt("event_intro");
      return;
    }

    if (!seenContexts.has("action_intro") && data.snapshot.phase === "action" && data.snapshot.activeSeat === data.viewerSeat) {
      setPersonalGuideContextPrompt("action_intro");
      return;
    }

    const viewerPlayer = data.viewerSeat
      ? data.snapshot.players.find((player) => player.seatId === data.viewerSeat) ?? null
      : null;
    const viewerTile = viewerPlayer?.positionTileId
      ? data.snapshot.mapTiles.find((tile) => tile.tileId === viewerPlayer.positionTileId) ?? null
      : null;
    const hasAdjacentHelpOpportunity = Boolean(
      viewerTile
      && data?.snapshot.phase === "action"
      && data?.snapshot.activeSeat === data?.viewerSeat
      && data.snapshot.players.some((player) => player.seatId !== data.viewerSeat && viewerTile.adjacentTileIds.includes(player.positionTileId ?? "")),
    );

    if (!seenContexts.has("help_intro") && hasAdjacentHelpOpportunity) {
      setPersonalGuideContextPrompt("help_intro");
      return;
    }

    if (!seenContexts.has("campfire_intro") && data.snapshot.phase === "campfire") {
      setPersonalGuideContextPrompt("campfire_intro");
    }
  }, [data?.snapshot.round, data?.snapshot.phase, data?.snapshot.activeSeat, data?.snapshot.currentEvent?.cardId, data?.snapshot.currentEvent?.revealedAtRound, data?.snapshot.players, data?.snapshot.mapTiles, data?.viewerSeat, data?.viewerRole, personalGuidePrefs, personalGuidePrefsReady, openingOnboardingStep, personalGuideWalkthroughStep, personalGuideContextPrompt, showEventRevealModal, showNightTransitionModal]);

  const markPersonalGuideContextSeen = (contextId: PersonalGuideContextId) => {
    setPersonalGuidePrefs((current) => current.seenContexts.includes(contextId)
      ? current
      : { ...current, seenContexts: [...current.seenContexts, contextId] });
    setPersonalGuideContextPrompt(null);
  };

  useEffect(() => {
    if (!showNightTransitionModal || !nightTransitionInfo) {
      setNightTransitionAnimated(false);
      return;
    }
    setNightTransitionAnimated(false);
    const timer = window.setTimeout(() => setNightTransitionAnimated(true), 80);
    return () => window.clearTimeout(timer);
  }, [showNightTransitionModal, nightTransitionInfo]);


  useEffect(() => {
    if (!data?.joinToken) return;

    const params = new URLSearchParams({ roomCode: data.room.roomCode, joinToken: data.joinToken });
    const eventSource = new EventSource(`/api/rooms/subscribe?${params.toString()}`);

    eventSource.addEventListener("state_updated", async (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as StateUpdatedPayload;
        if (payload.version <= latestVersionRef.current && payload.roomRevision <= latestRevisionRef.current) {
          return;
        }

        const response = await fetch("/api/rooms/latest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: data.room.roomCode, joinToken: data.joinToken }),
        });
        const result = (await response.json()) as ApiResponse<BootstrapData>;
        if (!result.ok) {
        return;
      }

        latestVersionRef.current = result.data.room.version;
        latestRevisionRef.current = result.data.snapshot.roomRevision;
        setData((current) =>
          current
            ? {
                ...current,
                room: result.data.room,
                players: result.data.players,
                snapshot: result.data.snapshot,
                viewerRole: result.data.viewerRole,
                viewerSeat: result.data.viewerSeat,
                displayName: result.data.displayName,
                stateUpdatedPayload: result.data.stateUpdatedPayload,
              }
            : current,
        );
      } catch {}
    });

    return () => eventSource.close();
  }, [data?.joinToken, data?.room.roomCode]);

  useEffect(() => {
    if (!data?.joinToken) return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/rooms/latest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: data.room.roomCode, joinToken: data.joinToken }),
        });
        const result = (await response.json()) as ApiResponse<BootstrapData>;

        if (!result.ok) return;

        const incomingVersion = result.data.room.version;
        const incomingRevision = result.data.snapshot.roomRevision;
        const currentVersion = latestVersionRef.current;
        const currentRevision = latestRevisionRef.current;

        if (incomingVersion > currentVersion || incomingRevision > currentRevision) {
          setData((current) =>
            current
              ? {
                  ...current,
                  room: result.data.room,
                  players: result.data.players,
                  snapshot: result.data.snapshot,
                  viewerRole: result.data.viewerRole,
                  viewerSeat: result.data.viewerSeat,
                  displayName: result.data.displayName,
                  stateUpdatedPayload: result.data.stateUpdatedPayload,
                }
              : current,
          );
          latestVersionRef.current = incomingVersion;
          latestRevisionRef.current = incomingRevision;
          return;
        }
      } catch {}
    }, 4000);

    return () => window.clearInterval(timer);
  }, [data?.joinToken, data?.room.roomCode, data?.room.version, data?.snapshot.roomRevision]);


  useEffect(() => {
    if (!data?.joinToken) return;

    const refreshPersistedLogs = async () => {
      try {
        const response = await fetch("/api/rooms/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode: data.room.roomCode, joinToken: data.joinToken, limit: 100 }),
        });
        const result = (await response.json()) as ApiResponse<{ roomCode: string; logs: GameSnapshot["actionLog"] }>;
        if (!result.ok) {
          setPersistedLogStatusZh(result.error.message);
          return;
        }
        setData((current) => current ? { ...current, snapshot: { ...current.snapshot, actionLog: result.data.logs } } : current);
        setPersistedLogStatusZh(result.data.logs.length === 0 ? "正式回合紀錄資料表目前尚未有資料" : `已同步正式回合紀錄 ${result.data.logs.length} 筆`);
      } catch {
        setPersistedLogStatusZh("正式回合紀錄資料表讀取失敗");
      }
    };

    void refreshPersistedLogs();
  }, [data?.joinToken, data?.room.roomCode, data?.room.version, data?.snapshot.roomRevision]);

  useEffect(() => {
    if (!data || data.viewerRole !== "host" || !data.viewerSeat || !data.snapshot.roomConfig.aiSimulationModeEnabled || submitting) return;

    const blockingWindow = data.snapshot.blockingWindow;
    const activeSeat = data.snapshot.activeSeat;
    const shouldRunAi =
      (data.snapshot.phase === "action" && Boolean(activeSeat && data.snapshot.players.find((player) => player.seatId === activeSeat)?.isAi)) ||
      (blockingWindow?.kind === "discard" && Boolean(data.snapshot.players.find((player) => player.seatId === blockingWindow.targetSeat)?.isAi)) ||
      (blockingWindow?.kind === "loss" && (
        Boolean(data.snapshot.players.find((player) => player.seatId === blockingWindow.targetSeat)?.isAi) ||
        blockingWindow.eligibleCompanionSeatIds.some((seatId) => data.snapshot.players.find((player) => player.seatId === seatId)?.isAi)
      ));

    if (!shouldRunAi) return;
    if (aiTickRef.current) window.clearTimeout(aiTickRef.current);
    aiTickRef.current = window.setTimeout(() => {
      void runAction({ type: "run_ai_turn", actorSeat: data.viewerSeat! });
    }, 700);

    return () => {
      if (aiTickRef.current) {
        window.clearTimeout(aiTickRef.current);
        aiTickRef.current = null;
      }
    };
  }, [data, submitting]);

  async function runAction(action: RoomAction) {
    if (!data) return;
    setSubmitting(true);
    const actionLabelZh = describeRoomActionZh(action, data.snapshot);
    const isMapAction = action.type === "move" || action.type === "adjacent_help" || action.type === "use_station_or_shelter";

    try {
      const response = await fetch("/api/rooms/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: data.room.roomCode,
          joinToken: data.joinToken,
          action,
        }),
      });
      const result = (await response.json()) as ActionResponse;

      if (!result.ok || !result.data) {
        const feedback = buildActionFeedbackState({
          action,
          beforeSnapshot: data.snapshot,
          errorMessageZh: result.error?.message ?? "請稍後再試。",
        });
        setLatestActionFeedback(feedback);
        setActionFeedbackHistory((current) => appendActionFeedbackHistory(current, feedback));
        if (isMapAction) setMapActionFeedbackZh(buildActionFeedbackSummary(feedback));
        return;
      }

      const responseData = result.data;
      const feedback = buildActionFeedbackState({
        action,
        beforeSnapshot: data.snapshot,
        afterSnapshot: responseData.snapshot,
        logMessageZh: responseData.logEntry.messageZh,
      });
      setData((current) =>
        current
          ? {
              ...current,
              room: {
                ...current.room,
                phase: responseData.snapshot.phase,
                status: responseData.snapshot.status,
                round: responseData.snapshot.round,
                version: responseData.version,
                updatedAt: responseData.snapshot.updatedAt,
              },
              snapshot: responseData.snapshot,
            }
          : current,
      );
      {
        const viewerHandCardIds = responseData.snapshot.players.find((player) => player.seatId === data.viewerSeat)?.handCardIds ?? [];
        const initialSelection = getInitialHandCardSelection(viewerHandCardIds);
        setSelectedActionCardId(initialSelection.cardId);
        setSelectedActionCardInstanceKey(initialSelection.instanceKey);
      }
      setLatestActionFeedback(feedback);
      setActionFeedbackHistory((current) => appendActionFeedbackHistory(current, feedback));
      if (isMapAction) {
        setMapActionFeedbackZh(buildActionFeedbackSummary(feedback));
      }
    } catch {
      const feedback = buildActionFeedbackState({
        action,
        beforeSnapshot: data.snapshot,
        errorMessageZh: "網路或伺服器暫時無法完成這次操作。",
      });
      setLatestActionFeedback(feedback);
      setActionFeedbackHistory((current) => appendActionFeedbackHistory(current, feedback));
      if (isMapAction) setMapActionFeedbackZh(buildActionFeedbackSummary(feedback));
    } finally {
      setSubmitting(false);
    }
  }

  const personalGuideTargetOrder = [
    "gh-guide-zone-event",
    "gh-guide-zone-tasks",
    "gh-guide-zone-map",
    "gh-guide-zone-roster",
    "gh-guide-zone-hand",
    "gh-guide-zone-controls",
  ] as const;
  const activePersonalGuideTargetId = personalGuideWalkthroughStep !== null
    ? personalGuideTargetOrder[personalGuideWalkthroughStep] ?? null
    : null;

  useEffect(() => {
    if (!showNewcomerGuideModal || !activePersonalGuideTargetId || typeof window === "undefined") return;
    const element = document.getElementById(activePersonalGuideTargetId);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const needsScroll = rect.top < 88 || rect.bottom > window.innerHeight - 88 || rect.left < 24 || rect.right > window.innerWidth - 24;
    const scrollKey = `${activePersonalGuideTargetId}:${personalGuideWalkthroughStep ?? 0}`;
    if (!needsScroll || lastGuideScrollKeyRef.current === scrollKey) return;
    lastGuideScrollKeyRef.current = scrollKey;
    const block = activePersonalGuideTargetId === "gh-guide-zone-tasks"
      ? "start"
      : activePersonalGuideTargetId === "gh-guide-zone-map"
        ? "center"
        : "nearest";
    element.scrollIntoView({ block, inline: "center", behavior: "smooth" });
  }, [showNewcomerGuideModal, activePersonalGuideTargetId, personalGuideWalkthroughStep]);

  useLayoutEffect(() => {
    if (!showNewcomerGuideModal || !activePersonalGuideTargetId || typeof window === "undefined") {
      setGuideHighlightRect(null);
      setGuideDialogPlacement(null);
      return;
    }

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const measure = () => {
      const element = document.getElementById(activePersonalGuideTargetId);
      if (!element) {
        setGuideHighlightRect(null);
        setGuideDialogPlacement(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const padding = 10;
      const top = Math.max(rect.top - padding, 8);
      const left = Math.max(rect.left - padding, 8);
      const right = Math.min(rect.right + padding, window.innerWidth - 8);
      const bottom = Math.min(rect.bottom + padding, window.innerHeight - 8);
      const width = Math.max(right - left, 32);
      const height = Math.max(bottom - top, 32);
      setGuideHighlightRect({ top, left, width, height, right, bottom });

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 16;
      const isDesktop = viewportWidth >= 1280;
      const baseDialogWidth = activePersonalGuideTargetId === "gh-guide-zone-map"
        ? 620
        : activePersonalGuideTargetId === "gh-guide-zone-tasks"
          ? 640
          : 660;
      const dialogWidth = Math.min(baseDialogWidth, viewportWidth - margin * 2);
      const estimatedDialogHeight = Math.min(activePersonalGuideTargetId === "gh-guide-zone-map" || activePersonalGuideTargetId === "gh-guide-zone-tasks" ? 420 : 560, viewportHeight - margin * 2);
      const centeredLeft = clamp(left + width / 2 - dialogWidth / 2, margin, viewportWidth - dialogWidth - margin);
      const topAligned = clamp(top + height / 2 - estimatedDialogHeight / 2, margin, viewportHeight - estimatedDialogHeight - margin);
      const spaceRight = viewportWidth - right - margin;
      const spaceLeft = left - margin;
      const spaceBelow = viewportHeight - bottom - margin;
      const spaceAbove = top - margin;

      let dialogLeft = centeredLeft;
      let dialogTop = topAligned;

      if (isDesktop && activePersonalGuideTargetId === "gh-guide-zone-tasks") {
        dialogLeft = centeredLeft;
        dialogTop = clamp(viewportHeight - estimatedDialogHeight - margin - 8, margin, viewportHeight - estimatedDialogHeight - margin);
      } else if (isDesktop && activePersonalGuideTargetId === "gh-guide-zone-map") {
        dialogLeft = clamp(viewportWidth - dialogWidth - margin - 24, margin, viewportWidth - dialogWidth - margin);
        dialogTop = clamp(viewportHeight - estimatedDialogHeight - margin - 8, margin, viewportHeight - estimatedDialogHeight - margin);
      } else if (spaceRight >= Math.min(360, dialogWidth * 0.58)) {
        dialogLeft = clamp(right + 18, margin, viewportWidth - dialogWidth - margin);
        dialogTop = topAligned;
      } else if (spaceLeft >= Math.min(360, dialogWidth * 0.58)) {
        dialogLeft = clamp(left - dialogWidth - 18, margin, viewportWidth - dialogWidth - margin);
        dialogTop = topAligned;
      } else if (spaceBelow >= 240) {
        dialogLeft = centeredLeft;
        dialogTop = clamp(bottom + 18, margin, viewportHeight - estimatedDialogHeight - margin);
      } else if (spaceAbove >= 240) {
        dialogLeft = centeredLeft;
        dialogTop = clamp(top - estimatedDialogHeight - 18, margin, viewportHeight - estimatedDialogHeight - margin);
      }

      setGuideDialogPlacement({
        top: dialogTop,
        left: dialogLeft,
        width: dialogWidth,
        maxHeight: `calc(100vh - ${Math.round(dialogTop + margin)}px)`,
      });
    };

    measure();
    const raf = window.requestAnimationFrame(measure);
    const followUp = window.setTimeout(measure, 260);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(followUp);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [showNewcomerGuideModal, activePersonalGuideTargetId]);

  useEffect(() => {
    if (!data?.viewerSeat) {
      if (selectedCardTargetSeat) setSelectedCardTargetSeat("");
      if (selectedCardTileId) setSelectedCardTileId("");
      return;
    }

    const actor = data.snapshot.players.find((player) => player.seatId === data.viewerSeat) ?? null;
    const mapTiles = data.snapshot.mapTiles.length > 0 ? data.snapshot.mapTiles : MINIMAL_MAP;
    const cardTargetRequirement = getCardTargetRequirement(selectedActionCardId);
    const legalTargetSeatIds = actor?.positionTileId && cardTargetRequirement
      ? data.snapshot.players
          .filter((player) => player.seatId !== actor.seatId)
          .filter((player) => {
            if (!player.positionTileId) return false;
            if (selectedActionCardId === "card_respond_together") {
              if (!data.snapshot.currentEvent || player.perRoundFlags.hasInvestedEvent) return false;
            }
            return cardTargetRequirement === "same_tile"
              ? player.positionTileId === actor.positionTileId
              : areTilesSameOrAdjacent(mapTiles, actor.positionTileId ?? "", player.positionTileId);
          })
          .map((player) => player.seatId)
      : [];
    if (selectedCardTargetSeat && !legalTargetSeatIds.includes(selectedCardTargetSeat)) {
      setSelectedCardTargetSeat("");
    }

    const legalTileIds = (() => {
      if (!actor?.positionTileId) return [] as string[];
      if (selectedActionCardId === "card_pull_you_a_bit") {
        const target = selectedCardTargetSeat
          ? data.snapshot.players.find((player) => player.seatId === selectedCardTargetSeat) ?? null
          : null;
        const targetTile = target?.positionTileId ? mapTiles.find((tile) => tile.tileId === target.positionTileId) ?? null : null;
        return targetTile ? targetTile.adjacentTileIds.slice() : [];
      }
      if (selectedActionCardId === "card_dash_to_goal") {
        return mapTiles
          .filter((tile) => tile.tileId !== actor.positionTileId)
          .filter((tile) => ["station", "shelter", "center"].includes(tile.kind))
          .filter((tile) => canReachWithinStepsClient(mapTiles, actor.positionTileId!, tile.tileId, 2))
          .map((tile) => tile.tileId);
      }
      return [] as string[];
    })();
    if (selectedCardTileId && !legalTileIds.includes(selectedCardTileId)) {
      setSelectedCardTileId("");
    }

    const legalActorResources = (() => {
      if (!actor) return [] as Array<"SR" | "SP">;
      if (selectedActionCardId === "card_same_tile_care") {
        const target = selectedCardTargetSeat
          ? data.snapshot.players.find((player) => player.seatId === selectedCardTargetSeat) ?? null
          : null;
        if (!target) return [] as Array<"SR" | "SP">;
        return (["SR", "SP"] as const).filter((resourceType) => canRecoverResource(target, resourceType, 1, data.snapshot.roomConfig));
      }
      if (selectedActionCardId === "card_focus_the_point") {
        if (!data.snapshot.currentEvent) return [] as Array<"SR" | "SP">;
        return (["SR", "SP"] as const).filter((resourceType) => resourceType === "SR"
          ? data.snapshot.currentEvent!.requirement.srRequired > 1
          : data.snapshot.currentEvent!.requirement.spRequired > 1);
      }
      if (selectedActionCardId === "card_respond_together") {
        if (!data.snapshot.currentEvent) return [] as Array<"SR" | "SP">;
        const totals = data.snapshot.currentEvent.contributions.reduce((acc, contribution) => ({ sr: acc.sr + contribution.srCounted, sp: acc.sp + contribution.spCounted }), { sr: 0, sp: 0 });
        const remainingSr = Math.max(0, data.snapshot.currentEvent.requirement.srRequired - totals.sr);
        const remainingSp = Math.max(0, data.snapshot.currentEvent.requirement.spRequired - totals.sp);
        return (["SR", "SP"] as const).filter((resourceType) => resourceType === "SR"
          ? actor.currentSr > 0 && remainingSr > 0
          : actor.currentSp > 0 && remainingSp > 0);
      }
      return [] as Array<"SR" | "SP">;
    })();
    if (["card_same_tile_care", "card_focus_the_point", "card_respond_together"].includes(selectedActionCardId) && !legalActorResources.includes(selectedCardResourceType)) {
      setSelectedCardResourceType(legalActorResources[0] ?? "SP");
    }

    const legalTeammateResources = (() => {
      if (selectedActionCardId !== "card_respond_together" || !actor || !selectedCardTargetSeat || !data.snapshot.currentEvent) return [] as Array<"SR" | "SP">;
      const target = data.snapshot.players.find((player) => player.seatId === selectedCardTargetSeat) ?? null;
      if (!target || target.perRoundFlags.hasInvestedEvent) return [] as Array<"SR" | "SP">;
      const totals = data.snapshot.currentEvent.contributions.reduce((acc, contribution) => ({ sr: acc.sr + contribution.srCounted, sp: acc.sp + contribution.spCounted }), { sr: 0, sp: 0 });
      let remainingSr = Math.max(0, data.snapshot.currentEvent.requirement.srRequired - totals.sr);
      let remainingSp = Math.max(0, data.snapshot.currentEvent.requirement.spRequired - totals.sp);
      if (selectedCardResourceType === "SR") remainingSr -= 1;
      else remainingSp -= 1;
      return (["SR", "SP"] as const).filter((resourceType) => resourceType === "SR"
        ? target.currentSr > 0 && remainingSr > 0
        : target.currentSp > 0 && remainingSp > 0);
    })();
    if (selectedActionCardId === "card_respond_together" && !legalTeammateResources.includes(selectedCardTeammateResourceType)) {
      setSelectedCardTeammateResourceType(legalTeammateResources[0] ?? "SP");
    }
  }, [data, selectedActionCardId, selectedCardTargetSeat, selectedCardTileId, selectedCardResourceType, selectedCardTeammateResourceType]);

  useEffect(() => {
    if (loading || !data) {
      if (selectedInvestConversion !== "") setSelectedInvestConversion("");
      return;
    }
    const viewer = data.viewerSeat ? data.snapshot.players.find((player) => player.seatId === data.viewerSeat) ?? null : null;
    const canUseConversion = viewer?.roleId === "bell_tower_observer"
      && viewer.roleAbilityUsesRemaining > 0
      && data.snapshot.roomConfig.roleAbilityToggles["bell_tower_observer"] !== false
      && Boolean(data.snapshot.currentEvent);
    const totals = data.snapshot.currentEvent
      ? data.snapshot.currentEvent.contributions.reduce((acc, contribution) => ({ sr: acc.sr + contribution.srCounted, sp: acc.sp + contribution.spCounted }), { sr: 0, sp: 0 })
      : { sr: 0, sp: 0 };
    const remainingSr = data.snapshot.currentEvent ? Math.max(0, data.snapshot.currentEvent.requirement.srRequired - totals.sr) : 0;
    const remainingSp = data.snapshot.currentEvent ? Math.max(0, data.snapshot.currentEvent.requirement.spRequired - totals.sp) : 0;
    const legalValues: Array<"" | "SR_TO_SP" | "SP_TO_SR"> = [""];
    if (canUseConversion && investSr >= 1 && remainingSp > 0) legalValues.push("SR_TO_SP");
    if (canUseConversion && investSp >= 1 && remainingSr > 0) legalValues.push("SP_TO_SR");
    if (!legalValues.includes(selectedInvestConversion)) {
      setSelectedInvestConversion("");
    }
  }, [loading, data, investSr, investSp, selectedInvestConversion]);


  const viewerPlayerState = data?.viewerSeat
    ? data.snapshot.players.find((player) => player.seatId === data.viewerSeat) ?? null
    : null;
  const participantPlayers = data?.snapshot.players ?? [];
  const nonViewerParticipants = participantPlayers.filter((player) => player.seatId !== data?.viewerSeat);
  const lobbyRoleSelectionBySeat = new Map<SeatId, string>(participantPlayers.map((player) => [
    player.seatId,
    selectedRoleBySeat[player.seatId] ?? player.roleId ?? ROLE_OPTIONS[0]?.roleId ?? "",
  ]));
  const lobbyRoleSeatMap = new Map<string, SeatId[]>();
  for (const [seatId, roleId] of lobbyRoleSelectionBySeat.entries()) {
    if (!roleId) continue;
    const seats = lobbyRoleSeatMap.get(roleId) ?? [];
    seats.push(seatId);
    lobbyRoleSeatMap.set(roleId, seats);
  }
  const roleCatalogEntries = ROLE_OPTIONS.map((role) => {
    const selectedSeats = lobbyRoleSeatMap.get(role.roleId) ?? [];
    return {
      ...role,
      selectedSeats,
      isTaken: selectedSeats.length > 0,
      statusZh: selectedSeats.length > 0 ? `已由 ${selectedSeats.join("、")} 選擇` : "目前可選",
    };
  });
  const displayMapTiles = (data?.snapshot.mapTiles.length ?? 0) > 0 ? data!.snapshot.mapTiles : MINIMAL_MAP;
  const isLobbyMapPreview = (data?.snapshot.mapTiles.length ?? 0) === 0;

  const currentTile = viewerPlayerState
    ? displayMapTiles.find((tile) => tile.tileId === viewerPlayerState.positionTileId) ?? null
    : null;

  const viewerRoleId = viewerPlayerState?.roleId ?? null;
  const canUseBellTowerAbility = viewerRoleId === "bell_tower_observer" && (viewerPlayerState?.roleAbilityUsesRemaining ?? 0) > 0 && data?.snapshot.roomConfig.roleAbilityToggles["bell_tower_observer"] !== false;
  const canUseMessengerAbility = viewerRoleId === "alley_messenger" && (viewerPlayerState?.roleAbilityUsesRemaining ?? 0) > 0 && data?.snapshot.roomConfig.roleAbilityToggles["alley_messenger"] !== false;

  const moveOptions = currentTile
    ? displayMapTiles.filter((tile) => currentTile.adjacentTileIds.includes(tile.tileId))
    : [];
  const legalMoveTileIds = new Set<string>(moveOptions.map((tile) => tile.tileId));
  const rangerRiskMoveOptions = currentTile
    ? moveOptions.filter((tile) => currentTile.kind === "risk" || tile.kind === "risk")
    : [];
  const selectedMapTile = selectedMapTileId ? displayMapTiles.find((tile) => tile.tileId === selectedMapTileId) ?? null : null;
  const selectedMapTileNeighbors = selectedMapTile
    ? displayMapTiles.filter((tile) => selectedMapTile.adjacentTileIds.includes(tile.tileId))
    : [];
  const selectedMapTileOccupants = selectedMapTile
    ? participantPlayers.filter((player) => player.positionTileId === selectedMapTile.tileId)
    : [];
  const adjacentHelpOptions = viewerPlayerState && currentTile
    ? nonViewerParticipants
        .filter((player) => currentTile.adjacentTileIds.includes(player.positionTileId ?? ""))
        .map((player) => {
          const buildFollowMoveChoices = (moverSeat: SeatId, fromTileId: string | null) => {
            if (!fromTileId) return [] as Array<{ moveSeat: SeatId; moveToTileId: string; moveToTileNameZh: string; labelZh: string }>;
            const fromTile = displayMapTiles.find((tile) => tile.tileId === fromTileId) ?? null;
            if (!fromTile) return [] as Array<{ moveSeat: SeatId; moveToTileId: string; moveToTileNameZh: string; labelZh: string }>;
            return displayMapTiles
              .filter((tile) => fromTile.adjacentTileIds.includes(tile.tileId))
              .map((tile) => ({
                moveSeat: moverSeat,
                moveToTileId: tile.tileId,
                moveToTileNameZh: tile.nameZh,
                labelZh: `讓 ${moverSeat} → ${tile.tileId}｜${tile.nameZh}`,
              }));
          };

          const messengerAbilityAvailable = viewerRoleId === "alley_messenger"
            && (viewerPlayerState?.roleAbilityUsesRemaining ?? 0) > 0
            && data?.snapshot.roomConfig.roleAbilityToggles["alley_messenger"] !== false;
          const followMoveChoices = messengerAbilityAvailable
            ? [
                ...buildFollowMoveChoices(viewerPlayerState.seatId, viewerPlayerState.positionTileId),
                ...buildFollowMoveChoices(player.seatId, player.positionTileId),
              ]
            : [];

          return {
            ...player,
            followMoveChoices,
          };
        })
    : [];
  const canUseAdjacentHelpFromMap = Boolean(
    viewerPlayerState
      && data?.viewerSeat
      && data?.viewerRole !== "observer"
      && data?.snapshot.phase === "action"
      && data?.snapshot.activeSeat === data?.viewerSeat
      && !viewerPlayerState.perRoundFlags.hasAdjacentHelped,
  );
  const canUseMedicBonusHint = viewerRoleId === "medic_apprentice" && (viewerPlayerState?.roleAbilityUsesRemaining ?? 0) > 0 && data?.snapshot.roomConfig.roleAbilityToggles["medic_apprentice"] !== false;
  const selectedAdjacentHelpTarget = adjacentHelpOptions.find((option) => option.seatId === selectedHelpTargetSeat) ?? null;
  const selectedAdjacentHelpFollowChoices = selectedAdjacentHelpTarget?.followMoveChoices ?? [];
  const selectedMoveTile = selectedMoveTileId ? displayMapTiles.find((tile) => tile.tileId === selectedMoveTileId) ?? null : null;
  const rangerAbilitySelectable = Boolean(
    viewerPlayerState
      && currentTile
      && selectedMoveTile
      && viewerRoleId === "ranger_pathfinder"
      && (viewerPlayerState.roleAbilityUsesRemaining ?? 0) > 0
      && data?.snapshot.roomConfig.roleAbilityToggles["ranger_pathfinder"] !== false
      && (currentTile.kind === "risk" || selectedMoveTile.kind === "risk"),
  );
  const medicAbilitySelectable = Boolean(
    viewerPlayerState
      && selectedAdjacentHelpTarget
      && viewerRoleId === "medic_apprentice"
      && (viewerPlayerState.roleAbilityUsesRemaining ?? 0) > 0
      && data?.snapshot.roomConfig.roleAbilityToggles["medic_apprentice"] !== false
      && selectedHelpResource === "SP",
  );
  const messengerAbilitySelectable = Boolean(
    viewerPlayerState
      && selectedAdjacentHelpTarget
      && viewerRoleId === "alley_messenger"
      && (viewerPlayerState.roleAbilityUsesRemaining ?? 0) > 0
      && data?.snapshot.roomConfig.roleAbilityToggles["alley_messenger"] !== false
      && selectedAdjacentHelpFollowChoices.length > 0,
  );

  useEffect(() => {
    if (!rangerAbilitySelectable) {
      setSelectedRangerAbilityMode("");
    }
  }, [rangerAbilitySelectable, selectedMoveTileId]);

  useEffect(() => {
    if (!medicAbilitySelectable) {
      setSelectedMedicAbilityMode("");
    }
  }, [medicAbilitySelectable, selectedHelpTargetSeat, selectedHelpResource]);

  useEffect(() => {
    if (!messengerAbilitySelectable) {
      setSelectedMessengerAbilityMode("");
      setSelectedHelpFreeMoveSeat("");
      setSelectedHelpFreeMoveTileId("");
    }
  }, [messengerAbilitySelectable, selectedHelpTargetSeat]);
  const teamAdjacentHelpDoneThisRound = (data?.snapshot.flags.adjacentHelpPairsThisRound.length ?? 0) > 0;
  const pressureTaskUnlockStatusZh = (data?.snapshot.pressure ?? 0) >= 6
    ? teamAdjacentHelpDoneThisRound
      ? "壓力已達 6，但本輪已發生至少 1 次 0AP 相鄰互助；任務宣告前置已滿足。"
      : "壓力已達 6，本輪尚未發生 0AP 相鄰互助；若你想在營火宣告任務，需先完成一次互助。"
    : teamAdjacentHelpDoneThisRound
      ? "本輪已發生 0AP 相鄰互助。雖然現在還沒被壓力 6 鎖任務，但合作節點已完成。"
      : "壓力未達 6，任務目前不受互助門檻鎖定。";
  const roleAbilityHintsZh = [
    canUseMedicBonusHint ? "你是白衣見習生：若你以 SP 進行 0AP 相鄰互助，系統應同時檢查〈安定陪伴〉，讓對方額外回復 1SP。" : null,
    canUseMessengerAbility ? "你是街巷信使：地圖快捷互助現在也可直接帶入〈牽起連結〉的免費移動；下方完整表單則保留給更細的指定流程。" : null,
    viewerPlayerState?.perRoundFlags.hasAdjacentHelped ? "你本輪已使用過 0AP 相鄰互助，因此地圖快捷互助會鎖定到下一輪。" : canUseAdjacentHelpFromMap ? "你本輪仍可做 1 次 0AP 相鄰互助。" : null,
  ].filter((hint): hint is string => Boolean(hint));
  const viewerHandCardIds = viewerPlayerState?.handCardIds ?? [];

  useEffect(() => {
    if (!selectedActionCardInstanceKey) return;
    const validInstanceKeys = viewerHandCardIds.map((cardId, index) => buildHandCardInstanceKey(cardId, index));
    if (validInstanceKeys.includes(selectedActionCardInstanceKey)) return;
    setSelectedActionCardId("");
    setSelectedActionCardInstanceKey("");
    setSelectedCardTargetSeat("");
    setSelectedCardTileId("");
    setSelectedCardResourceType("SP");
    setSelectedCardTeammateResourceType("SP");
  }, [selectedActionCardInstanceKey, viewerHandCardIds]);


  if (loading || !data || !uiState) {
    return <div className="min-h-screen bg-stone-100 px-6 py-10">正在載入房間...</div>;
  }

  const zeroedPlayers = data.snapshot.players.filter((player) => player.currentSr <= 0 || player.currentSp <= 0);

  const currentCardDefinition = selectedActionCardId ? ACTION_CARD_DEFINITION_MAP[selectedActionCardId] : null;
  const currentEventContributionTotals = data.snapshot.currentEvent
    ? data.snapshot.currentEvent.contributions.reduce((sum, item) => ({ sr: sum.sr + item.srCounted, sp: sum.sp + item.spCounted }), { sr: 0, sp: 0 })
    : { sr: 0, sp: 0 };
  const currentEventRemainingSr = data.snapshot.currentEvent ? Math.max(0, data.snapshot.currentEvent.requirement.srRequired - currentEventContributionTotals.sr) : 0;
  const currentEventRemainingSp = data.snapshot.currentEvent ? Math.max(0, data.snapshot.currentEvent.requirement.spRequired - currentEventContributionTotals.sp) : 0;
  const investConversionOptions = canUseBellTowerAbility
    ? [
        { value: "" as const, labelZh: "不轉換", selected: selectedInvestConversion === "", disabled: false },
        { value: "SR_TO_SP" as const, labelZh: "1 SR→SP", selected: selectedInvestConversion === "SR_TO_SP", disabled: !(investSr >= 1 && currentEventRemainingSp > 0) },
        { value: "SP_TO_SR" as const, labelZh: "1 SP→SR", selected: selectedInvestConversion === "SP_TO_SR", disabled: !(investSp >= 1 && currentEventRemainingSr > 0) },
      ]
    : [];
  const cardTargetRequirement = getCardTargetRequirement(selectedActionCardId);
  const legalCardTargetPlayers = (() => {
    if (!viewerPlayerState?.positionTileId || !cardTargetRequirement) return [] as PlayerState[];
    return participantPlayers
      .filter((player) => player.seatId !== viewerPlayerState.seatId)
      .filter((player) => {
        if (!player.positionTileId) return false;
        if (selectedActionCardId === "card_respond_together") {
          if (!data.snapshot.currentEvent || player.perRoundFlags.hasInvestedEvent) return false;
        }
        if (cardTargetRequirement === "same_tile") {
          return player.positionTileId === viewerPlayerState.positionTileId;
        }
        return areTilesSameOrAdjacent(displayMapTiles, viewerPlayerState.positionTileId!, player.positionTileId);
      });
  })();
  const legalCardTargetSeatIds = legalCardTargetPlayers.map((player) => player.seatId);
  const legalCardTargetSeatSet = new Set<SeatId>(legalCardTargetSeatIds);
  const selectedCardTargetPlayer = selectedCardTargetSeat
    ? participantPlayers.find((player) => player.seatId === selectedCardTargetSeat) ?? null
    : null;
  const cardNeedsTargetSeat = Boolean(cardTargetRequirement);
  const cardTargetPromptZh = getCardTargetPromptZh(selectedActionCardId, cardTargetRequirement);
  const cardTargetSelectionSummaryZh = cardNeedsTargetSeat
    ? selectedCardTargetPlayer
      ? `目前已選：${getPlayerLabelZh(selectedCardTargetPlayer)}`
      : legalCardTargetSeatIds.length > 0
        ? "請先選擇目標隊友，再使用這張牌。"
        : selectedActionCardId === "card_respond_together"
          ? "目前沒有可指定的隊友：需同格或相鄰，且本輪尚未投入事件。"
          : cardTargetRequirement === "same_tile"
            ? "目前沒有可指定的同格隊友。"
            : "目前沒有可指定的同格或相鄰隊友。"
    : null;
  const cardTargetSelectionErrorZh = cardNeedsTargetSeat
    ? legalCardTargetSeatIds.length === 0
      ? selectedActionCardId === "card_respond_together"
        ? "目前沒有符合條件的隊友可共同投入事件。"
        : cardTargetRequirement === "same_tile"
          ? "目前沒有可指定的同格隊友。"
          : "目前沒有可指定的同格或相鄰隊友。"
      : !selectedCardTargetSeat
        ? "請先選擇這張牌要對哪位隊友使用。"
        : !legalCardTargetSeatSet.has(selectedCardTargetSeat)
          ? cardTargetRequirement === "same_tile"
            ? "目標隊友必須與你同格。"
            : "目標隊友必須與你同格或相鄰。"
          : null
    : null;

  const cardNeedsTileSelection = selectedActionCardId === "card_pull_you_a_bit" || selectedActionCardId === "card_dash_to_goal";
  const legalCardTileOptions = (() => {
    if (!viewerPlayerState?.positionTileId || !cardNeedsTileSelection) return [] as MapTile[];
    if (selectedActionCardId === "card_pull_you_a_bit") {
      const targetTile = selectedCardTargetPlayer?.positionTileId
        ? displayMapTiles.find((tile) => tile.tileId === selectedCardTargetPlayer.positionTileId) ?? null
        : null;
      if (!targetTile) return [] as MapTile[];
      return displayMapTiles.filter((tile) => targetTile.adjacentTileIds.includes(tile.tileId));
    }
    return displayMapTiles
      .filter((tile) => tile.tileId !== viewerPlayerState.positionTileId)
      .filter((tile) => ["station", "shelter", "center"].includes(tile.kind))
      .filter((tile) => canReachWithinStepsClient(displayMapTiles, viewerPlayerState.positionTileId!, tile.tileId, 2));
  })();
  const legalCardTileIdSet = new Set<string>(legalCardTileOptions.map((tile) => tile.tileId));
  const selectedCardTile = selectedCardTileId ? displayMapTiles.find((tile) => tile.tileId === selectedCardTileId) ?? null : null;
  const cardTilePromptZh = selectedActionCardId === "card_pull_you_a_bit"
    ? "請選擇要讓隊友移動到哪一格（需為該隊友相鄰地格）"
    : selectedActionCardId === "card_dash_to_goal"
      ? "請選擇 2 格內的物資站、庇護所或中央大道"
      : null;
  const cardTileSelectionSummaryZh = !cardNeedsTileSelection
    ? null
    : selectedCardTile
      ? `目前已選：${getTileLabelZh(selectedCardTile)}`
      : selectedActionCardId === "card_pull_you_a_bit" && !selectedCardTargetPlayer
        ? "請先選隊友，再選他要移動到哪一格。"
        : legalCardTileOptions.length > 0
          ? "請先選擇目標地格，再使用這張牌。"
          : selectedActionCardId === "card_pull_you_a_bit"
            ? "目前沒有合法的相鄰地格可供移動。"
            : "目前沒有可直奔的功能地格。";
  const cardTileSelectionErrorZh = !cardNeedsTileSelection
    ? null
    : selectedActionCardId === "card_pull_you_a_bit" && !selectedCardTargetPlayer
      ? "請先選擇要被帶動移動的隊友。"
      : legalCardTileOptions.length === 0
        ? selectedActionCardId === "card_pull_you_a_bit"
          ? "目前沒有合法的相鄰地格可供移動。"
          : "目前沒有可直奔的物資站、庇護所或中央大道。"
        : !selectedCardTileId
          ? "請先選擇這張牌要移動到哪一格。"
          : !legalCardTileIdSet.has(selectedCardTileId)
            ? "所選地格不符合這張牌的使用條件。"
            : null;

  const cardNeedsResourceSelection = ["card_same_tile_care", "card_focus_the_point", "card_respond_together"].includes(selectedActionCardId);
  const cardResourceOptions = (() => {
    if (!cardNeedsResourceSelection) return [] as Array<{ value: "SR" | "SP"; labelZh: string; selected: boolean; disabled?: boolean }>;
    if (selectedActionCardId === "card_same_tile_care") {
      if (!selectedCardTargetPlayer) return [] as Array<{ value: "SR" | "SP"; labelZh: string; selected: boolean; disabled?: boolean }>;
      return (["SR", "SP"] as const).map((resourceType) => ({
        value: resourceType,
        labelZh: resourceType === "SR" ? "回復 SR" : "回復 SP",
        selected: selectedCardResourceType == resourceType,
        disabled: !canRecoverResource(selectedCardTargetPlayer, resourceType, 1, data.snapshot.roomConfig),
      }));
    }
    if (selectedActionCardId === "card_focus_the_point") {
      return (["SR", "SP"] as const).map((resourceType) => ({
        value: resourceType,
        labelZh: resourceType === "SR" ? "事件 SR -1" : "事件 SP -1",
        selected: selectedCardResourceType == resourceType,
        disabled: resourceType === "SR" ? currentEventRemainingSr <= 1 : currentEventRemainingSp <= 1,
      }));
    }
    return (["SR", "SP"] as const).map((resourceType) => ({
      value: resourceType,
      labelZh: resourceType === "SR" ? "你先投入 SR" : "你先投入 SP",
      selected: selectedCardResourceType == resourceType,
      disabled: resourceType === "SR"
        ? !viewerPlayerState || viewerPlayerState.currentSr <= 0 || currentEventRemainingSr <= 0
        : !viewerPlayerState || viewerPlayerState.currentSp <= 0 || currentEventRemainingSp <= 0,
    }));
  })();
  const legalCardResourceValues = cardResourceOptions.filter((option) => !option.disabled).map((option) => option.value);
  const cardResourcePromptZh = selectedActionCardId === "card_same_tile_care"
    ? "請選擇要讓隊友回復 SR 或 SP"
    : selectedActionCardId === "card_focus_the_point"
      ? "請選擇要減少哪一種事件需求"
      : selectedActionCardId === "card_respond_together"
        ? "請選擇你要先投入的資源"
        : null;
  const cardResourceSelectionSummaryZh = !cardNeedsResourceSelection
    ? null
    : selectedActionCardId === "card_same_tile_care" && !selectedCardTargetPlayer
      ? "請先選隊友，再決定要回復 SR 還是 SP。"
      : legalCardResourceValues.length === 0
        ? selectedActionCardId === "card_same_tile_care"
          ? "目前沒有可回復的資源類型。"
          : selectedActionCardId === "card_focus_the_point"
            ? "事件需求已無法再降低任何一項。"
            : "目前你沒有可投入、且符合事件剩餘需求的資源。"
        : `目前已選：${selectedCardResourceType}`;
  const cardResourceSelectionErrorZh = !cardNeedsResourceSelection
    ? null
    : legalCardResourceValues.length === 0
      ? selectedActionCardId === "card_same_tile_care"
        ? "目前沒有可回復的資源類型。"
        : selectedActionCardId === "card_focus_the_point"
          ? "目前事件需求已不能再被降低。"
          : "目前你沒有可投入、且符合事件剩餘需求的資源。"
      : !legalCardResourceValues.includes(selectedCardResourceType)
        ? "請先選擇合法的資源類型。"
        : null;

  const cardNeedsTeammateResourceSelection = selectedActionCardId === "card_respond_together";
  const cardTeammateResourceOptions = (() => {
    if (!cardNeedsTeammateResourceSelection || !selectedCardTargetPlayer || !data.snapshot.currentEvent) return [] as Array<{ value: "SR" | "SP"; labelZh: string; selected: boolean; disabled?: boolean }>;
    const remainingSr = currentEventRemainingSr - (selectedCardResourceType === "SR" ? 1 : 0);
    const remainingSp = currentEventRemainingSp - (selectedCardResourceType === "SP" ? 1 : 0);
    return (["SR", "SP"] as const).map((resourceType) => ({
      value: resourceType,
      labelZh: resourceType === "SR" ? `${selectedCardTargetPlayer.seatId} 投入 SR` : `${selectedCardTargetPlayer.seatId} 投入 SP`,
      selected: selectedCardTeammateResourceType == resourceType,
      disabled: resourceType === "SR"
        ? selectedCardTargetPlayer.currentSr <= 0 || remainingSr <= 0
        : selectedCardTargetPlayer.currentSp <= 0 || remainingSp <= 0,
    }));
  })();
  const legalCardTeammateResourceValues = cardTeammateResourceOptions.filter((option) => !option.disabled).map((option) => option.value);
  const cardTeammateResourcePromptZh = cardNeedsTeammateResourceSelection ? "請選擇隊友要投入的資源" : null;
  const cardTeammateResourceSummaryZh = !cardNeedsTeammateResourceSelection
    ? null
    : !selectedCardTargetPlayer
      ? "請先選隊友，再決定他要投入哪種資源。"
      : legalCardTeammateResourceValues.length === 0
        ? "目前隊友沒有符合事件剩餘需求的可投入資源。"
        : `目前已選：${selectedCardTeammateResourceType}`;
  const cardTeammateResourceSelectionErrorZh = !cardNeedsTeammateResourceSelection
    ? null
    : !selectedCardTargetPlayer
      ? "請先選擇要一起投入事件的隊友。"
      : legalCardTeammateResourceValues.length === 0
        ? "目前隊友沒有符合事件剩餘需求的可投入資源。"
        : !legalCardTeammateResourceValues.includes(selectedCardTeammateResourceType)
          ? "請先為隊友選擇合法的投入資源。"
          : null;

  const selectedTask = data.snapshot.tasks.find((task) => task.taskId === selectedTaskId) ?? null;
  const allTileOptions = displayMapTiles;
  const completedTasks = data.snapshot.tasks.filter((task) => task.completionCheckedByHost).length;
  const totalTasks = data.snapshot.tasks.length;
  const missingHumanRoleSeats = data.snapshot.players
    .filter((player) => !player.isAi && !player.roleId)
    .map((player) => player.seatId);
  const lobbyTargetTaskCount = 2;
  const canViewerEndTurn = data.snapshot.phase === "action" && data.snapshot.activeSeat === data.viewerSeat && data.viewerRole !== "observer";
  const shouldPulseEndTurn = Boolean(canViewerEndTurn && (viewerPlayerState?.remainingAp ?? 0) === 0);
  const startGameHintZh = data.snapshot.phase !== "lobby"
    ? "目前已離開大廳階段。"
    : missingHumanRoleSeats.length > 0
      ? `尚未指派角色：${missingHumanRoleSeats.join("、")}。先在右側「大廳準備」完成角色指派後才能開始遊戲。`
      : "角色已準備完成；若有 AI 尚未指派角色，開局時會自動補齊剩餘角色。";
  const eventProgress = (() => {
    const event = data.snapshot.currentEvent;
    if (!event) return null;
    const totalSr = event.contributions.reduce((sum, item) => sum + item.srCounted, 0);
    const totalSp = event.contributions.reduce((sum, item) => sum + item.spCounted, 0);
    const remainingSr = Math.max(0, event.requirement.srRequired - totalSr);
    const remainingSp = Math.max(0, event.requirement.spRequired - totalSp);
    const contributorSeatIds = Array.from(new Set(event.contributions.map((item) => item.seatId)));
    const distinctContributorCount = contributorSeatIds.length;
    const contributorNamesZh = contributorSeatIds.length > 0
      ? contributorSeatIds.map((seatId) => {
          const player = data.snapshot.players.find((candidate) => candidate.seatId === seatId);
          return player ? `${seatId}｜${player.displayName}` : seatId;
        })
      : [];
    const viewerContribution = data.viewerSeat ? event.contributions.find((item) => item.seatId === data.viewerSeat) ?? null : null;
    const viewerCanInvest = Boolean(viewerPlayerState && !viewerPlayerState.perRoundFlags.hasInvestedEvent && data.snapshot.phase === "action" && data.snapshot.activeSeat === data.viewerSeat);
    const readinessLinesZh = [
      remainingSr > 0 || remainingSp > 0
        ? `目前還缺 SR ${remainingSr} / SP ${remainingSp}。`
        : "需求數值已滿足，接下來看是否符合多人投入等條件。",
      data.snapshot.pressure >= 3
        ? distinctContributorCount >= 2
          ? `壓力已達 3，本輪已有 ${distinctContributorCount} 名玩家投入；多人投入條件已滿足。`
          : "壓力已達 3，本輪事件若要成立，事件處理區需來自至少 2 名不同玩家。"
        : `目前已有 ${distinctContributorCount} 名玩家投入；壓力未達 3，尚未啟用多人投入硬性門檻。`,
      viewerContribution
        ? `你本輪已投入 SR ${viewerContribution.srPaid} / SP ${viewerContribution.spPaid}。`
        : viewerCanInvest
          ? "你本輪仍可投入 1 次事件處理區。"
          : data.snapshot.phase === "action"
            ? "你目前不能再投入事件；可能不是你的回合，或本輪已投入過。"
            : "目前不是行動階段，事件投入按鈕僅供預先查看。",
    ];

    return {
      totalSr,
      totalSp,
      remainingSr,
      remainingSp,
      distinctContributorCount,
      viewerCanInvest,
      contributorNamesZh,
      readinessLinesZh,
    };
  })();
  const selectedTaskSurfaceStatus = selectedTask ? deriveTaskSurfaceStatus(data.snapshot, selectedTask) : null;
  const taskDeclarationDiagnostic = (() => {
    if (!selectedTaskSurfaceStatus) return null;
    return {
      status:
        selectedTaskSurfaceStatus.key === "ready_to_declare"
          ? "ready"
          : selectedTaskSurfaceStatus.key === "completed"
            ? "done"
            : selectedTaskSurfaceStatus.key === "declared"
              ? "pending"
              : "blocked",
      reasonsZh: selectedTaskSurfaceStatus.reasonsZh.length > 0 ? selectedTaskSurfaceStatus.reasonsZh : [selectedTaskSurfaceStatus.summaryZh],
      summaryZh: selectedTaskSurfaceStatus.summaryZh,
    };
  })();
  const taskSurfaceEntries = data.snapshot.tasks.map((task) => ({
    task,
    status: deriveTaskSurfaceStatus(data.snapshot, task),
    progressLinesZh: buildTaskProgressLines(data.snapshot, task),
  }));
  const campfireReadyTaskEntries = taskSurfaceEntries.filter((entry) => entry.status.canDeclare);
  const settlementOutcome = (() => {
    const pressureDefeat = data.snapshot.pressure >= 10;
    const srZeroSeats = zeroedPlayers.filter((player) => player.currentSr <= 0).map((player) => player.seatId);
    const spZeroSeats = zeroedPlayers.filter((player) => player.currentSp <= 0).map((player) => player.seatId);
    const likelyVictory = data.snapshot.phase === "gameover" && !pressureDefeat && zeroedPlayers.length === 0 && completedTasks >= 2;
    const weakestPlayer = [...data.snapshot.players].sort((a, b) => (a.currentSr + a.currentSp) - (b.currentSr + b.currentSp))[0] ?? null;
    const unresolvedTasks = data.snapshot.tasks.filter((task) => !task.completionCheckedByHost);
    const nextStepsZh: string[] = [];
    if (pressureDefeat) nextStepsZh.push("這局是壓力線先崩；下一步可優先回看資源上限比較與事件／任務池比較。");
    if (srZeroSeats.length > 0) nextStepsZh.push(`SR 軸先撐不住的席位：${srZeroSeats.join("、")}；建議優先檢查物資站路徑、風險停留與支援牌效率。`);
    if (spZeroSeats.length > 0) nextStepsZh.push(`SP 軸先撐不住的席位：${spZeroSeats.join("、")}；建議回看庇護所可達性、白衣見習生與陪伴標記使用節點。`);
    if (!pressureDefeat && zeroedPlayers.length === 0 && completedTasks < 2) nextStepsZh.push("隊伍撐住了，但任務量沒達標；建議回看壓力 6 互助門檻與任務市場節奏。");
    if (nextStepsZh.length === 0) nextStepsZh.push("可直接用模擬比較檢查這版規則和牌池，確認本局是否只是單局波動。");
    return {
      tone: likelyVictory ? "emerald" as const : "rose" as const,
      verdictZh: likelyVictory ? "團隊撐過七輪並達成目標" : pressureDefeat ? "壓力線先崩，系統判定失敗" : zeroedPlayers.length > 0 ? "有玩家資源歸零，系統判定失敗" : "本局已結束，請檢查最後收尾原因",
      srZeroSeats,
      spZeroSeats,
      weakestPlayer,
      unresolvedTasks,
      nextStepsZh,
      likelyVictory,
    };
  })();
  const recentActionLogEntries = showFullLog ? data.snapshot.actionLog : data.snapshot.actionLog.slice(0, 8);
  const shouldShowLogToggle = data.snapshot.actionLog.length > 8;
  const latestEventNameZh = data.snapshot.currentEvent?.nameZh ?? data.snapshot.pendingLossQueue[0]?.sourceLabelZh ?? "本輪未記錄事件";
  const remainingDays = Math.max(7 - data.snapshot.round, 0);
  const headerRoundValueZh = data.snapshot.phase === "lobby" ? "尚未開始" : `第 ${data.snapshot.round} / 7 輪`;
  const headerTaskValueZh = `${completedTasks}/${data.snapshot.tasks.length}`;
  const headerCurrentActorZh = data.snapshot.phase === "lobby" ? "待開局" : data.snapshot.activeSeat ?? "—";
  const worldViewTitleZh = "風暴中的互助與守護";
  const worldViewIntroZh = "你們身處高壓混亂的城鎮，要在七輪內彼此撐住、一起完成任務。";
  const worldViewResourceLinesZh = [
    "SR：身體／生存狀態。",
    "SP：心理／安定狀態。",
    "AP：你本回合可做的行動數。",
  ];
  const victoryConditionLinesZh = [
    "撐過第 7 回合營火階段。",
    "整局至少完成 2 張任務。",
    "任何玩家的 SR 或 SP 都不能在最終檢查時歸零。",
    "壓力不能到 10。",
  ];
  const currentPendingLoss = data.snapshot.blockingWindow?.kind === "loss" ? data.snapshot.blockingWindow : null;
  const queuedPendingLosses = currentPendingLoss
    ? [
        {
          lossChainId: currentPendingLoss.lossChainId,
          targetSeat: currentPendingLoss.targetSeat,
          srLoss: currentPendingLoss.srLoss,
          spLoss: currentPendingLoss.spLoss,
          sourceLabelZh: currentPendingLoss.sourceLabelZh,
          sourceType: currentPendingLoss.sourceType,
          isCurrent: true,
        },
        ...data.snapshot.pendingLossQueue
          .filter((item) => item.lossChainId !== currentPendingLoss.lossChainId)
          .map((item) => ({ ...item, isCurrent: false })),
      ]
    : data.snapshot.pendingLossQueue.map((item) => ({ ...item, isCurrent: false }));
  const campfireQueueSummaryZh = queuedPendingLosses.length === 0
    ? "目前沒有待處理損失佇列。"
    : currentPendingLoss
      ? `目前正在處理第 1/${queuedPendingLosses.length} 筆損失，後面還有 ${Math.max(queuedPendingLosses.length - 1, 0)} 筆。`
      : `目前損失佇列共有 ${queuedPendingLosses.length} 筆，待營火步驟逐筆處理。`;
  const campfireStage = data.snapshot.pendingCampfireResolution?.stage ?? null;
  const campfireFlowLinesZh = (() => {
    const lines: string[] = [];
    if (data.snapshot.phase === "campfire") {
      lines.push("現在是營火階段：先看事件處理區，再看任務宣告，接著依序處理風險停留、其他損失、壓力與狀態確認。");
      if (campfireStage === "resolve_event") lines.push("目前子步驟：正在整理事件解決結果與營火損失佇列。");
      if (campfireStage === "resolve_losses") lines.push("目前子步驟：正在逐筆處理營火損失。");
      if (campfireStage === "apply_pressure") lines.push("目前子步驟：準備套用壓力＋1 與里程碑效果。");
      if (campfireStage === "state_check") lines.push("目前子步驟：正在做狀態確認與勝敗檢查。");
    }
    if (currentPendingLoss) {
      lines.push(`目前卡在損失處理：${currentPendingLoss.targetSeat} 正在承受 ${currentPendingLoss.srLoss} SR / ${currentPendingLoss.spLoss} SP。`)
      lines.push(currentPendingLoss.companionUsed ? "這筆損失已使用過陪伴標記，不會再次生效。" : "若要使用陪伴標記，請先確認本輪還有可用標記；否則就直接完成這筆損失處理。")
    }
    if (!currentPendingLoss && data.snapshot.phase === "campfire") {
      lines.push("目前沒有阻塞中的損失或任務判定，可往下完成營火流程。")
    }
    if (data.snapshot.pressure >= 6) {
      lines.push("壓力已達 6：本輪若沒有至少 1 次 0AP 相鄰互助，就不能宣告任務。")
    }
    return lines;
  })();
  const contributorSeatIdsThisRound = data.snapshot.currentEvent
    ? Array.from(new Set(data.snapshot.currentEvent.contributions.map((item) => item.seatId)))
    : [];
  const storytellerRecoveryTarget = contributorSeatIdsThisRound.length >= 2
    ? participantPlayers
        .filter((player) => contributorSeatIdsThisRound.includes(player.seatId))
        .sort((a, b) => a.currentSp - b.currentSp)[0] ?? null
    : null;
  const roleAbilityStatusBySeat = new Map<SeatId, { stateLabelZh: string; detailZh: string; tone: "stone" | "amber" | "emerald" | "sky"; interactionHintZh: string | undefined }>(participantPlayers.map((player) => {
    const loadout = getRoleLoadout(player.roleId);
    if (!loadout || !player.roleId) {
      return [player.seatId, {
        stateLabelZh: "未指派",
        detailZh: "尚未指派角色，因此沒有可追蹤的角色技能。",
        tone: "stone" as const,
        interactionHintZh: undefined as string | undefined,
      }];
    }
    const enabled = data.snapshot.roomConfig.roleAbilityToggles[player.roleId] !== false;
    const usedUp = player.roleAbilityUsesRemaining <= 0;
    const isViewerRole = player.seatId === data.viewerSeat;
    let stateLabelZh = "待條件";
    let detailZh = loadout.abilitySummaryZh;
    let tone: "stone" | "amber" | "emerald" | "sky" = "sky";
    let interactionHintZh: string | undefined;

    if (!enabled) {
      stateLabelZh = "已關閉";
      detailZh = "此房間目前已關閉該角色技能。";
      tone = "stone";
    } else if (usedUp) {
      stateLabelZh = "已用完";
      detailZh = "本輪可用次數已耗盡，需等下一輪重置。";
      tone = "stone";
    } else {
      switch (player.roleId) {
        case "merchant_guard": {
          const pendingTarget = currentPendingLoss ? participantPlayers.find((candidate) => candidate.seatId === currentPendingLoss.targetSeat) ?? null : null;
          const canGuardNow = Boolean(
            currentPendingLoss
            && currentPendingLoss.srLoss > 0
            && currentPendingLoss.targetSeat !== player.seatId
            && player.positionTileId
            && pendingTarget?.positionTileId
            && areTilesSameOrAdjacent(displayMapTiles, player.positionTileId, pendingTarget.positionTileId),
          );
          stateLabelZh = canGuardNow ? "可回應" : "待條件";
          detailZh = canGuardNow
            ? `目前若結算 ${currentPendingLoss?.targetSeat} 的損失，你可手動決定是否發動〈穩住陣腳〉。`
            : "當相鄰隊友將失去 SR 時，系統會跳出回應窗讓你決定是否發動。";
          tone = canGuardNow ? "emerald" : "amber";
          interactionHintZh = "符合條件時，會出現『發動／略過』的角色技能回應窗。";
          break;
        }
        case "medic_apprentice": {
          const adjacentTargets = player.positionTileId
            ? participantPlayers.filter((candidate) => candidate.seatId !== player.seatId && candidate.positionTileId && areTilesSameOrAdjacent(displayMapTiles, player.positionTileId!, candidate.positionTileId))
            : [];
          const canTrigger = isViewerRole && data.snapshot.phase === "action" && data.snapshot.activeSeat === player.seatId && !player.perRoundFlags.hasAdjacentHelped && player.currentSp > 0 && adjacentTargets.length > 0;
          stateLabelZh = canTrigger ? "可回應" : "待條件";
          detailZh = canTrigger
            ? `你現在若對 ${adjacentTargets[0]?.seatId ?? "相鄰隊友"} 進行 SP 互助，可手動決定是否額外回復 1 SP。`
            : "當你以 SP 進行 0AP 相鄰互助時，系統會先詢問是否發動〈安定陪伴〉。";
          tone = canTrigger ? "emerald" : "sky";
          interactionHintZh = "先指定互助，再在角色技能提醒中選『發動』或『略過』。";
          break;
        }
        case "bell_tower_observer": {
          const canTrigger = isViewerRole && investConversionOptions.some((option) => option.value !== "" && !option.disabled);
          stateLabelZh = canTrigger ? "可轉換" : "待投入";
          detailZh = canTrigger
            ? "你本次投入事件時，可把 1 點 SR 改按 SP，或把 1 點 SP 改按 SR 計算。"
            : data.snapshot.currentEvent
              ? "要先填入可投入的 SR / SP，且另一種資源需求仍有缺口，才會出現可選轉換。"
              : "需先有當前事件，才能使用資源轉換。";
          tone = canTrigger ? "emerald" : "amber";
          interactionHintZh = "請在上方『投入事件』區直接選擇資源轉換。";
          break;
        }
        case "alley_messenger": {
          const followMoveReady = isViewerRole && canUseMessengerAbility && adjacentHelpOptions.some((option) => (option.followMoveChoices?.length ?? 0) > 0) && !player.perRoundFlags.hasAdjacentHelped;
          stateLabelZh = followMoveReady ? "可回應" : "待互助";
          detailZh = followMoveReady
            ? "你現在可在互助送出前，手動決定是否連動免費移動 1 格。"
            : "完成 0AP 相鄰互助時，系統才會詢問是否發動〈牽起連結〉。";
          tone = followMoveReady ? "emerald" : "sky";
          interactionHintZh = "先選互助對象，再在角色技能提醒中決定發動或略過，若發動再指定免費移動。";
          break;
        }
        case "ranger_pathfinder": {
          const canTrigger = isViewerRole && rangerRiskMoveOptions.length > 0 && data.snapshot.phase === "action" && data.snapshot.activeSeat === player.seatId;
          stateLabelZh = canTrigger ? "可回應" : "待移動";
          detailZh = canTrigger
            ? `你下一次若移動到 ${rangerRiskMoveOptions[0]?.nameZh ?? "風險地格"}（或從風險地格離開），可手動決定是否不耗 AP。`
            : "當你移動進入或離開風險地格時，系統會先詢問是否發動〈越野突破〉。";
          tone = canTrigger ? "emerald" : "sky";
          interactionHintZh = "先選目標地格，再在角色技能提醒中選『發動』或『略過』。";
          break;
        }
        case "square_storyteller": {
          const canTrigger = contributorSeatIdsThisRound.length >= 2;
          stateLabelZh = canTrigger ? (data.snapshot.phase === "campfire" ? "可回應" : "已建立") : "待投入";
          detailZh = canTrigger
            ? `${contributorSeatIdsThisRound.length} 名玩家已投入事件；營火狀態確認時可手動指定 1 名投入者回復 1 SP。`
            : "要先讓至少 2 名不同玩家投入本輪事件，營火時才會跳出〈協調分工〉回應窗。";
          tone = canTrigger ? "emerald" : "sky";
          interactionHintZh = "營火尾聲會跳出角色技能回應窗，讓你決定要不要發動。";
          break;
        }
        default:
          break;
      }
    }

    return [player.seatId, { stateLabelZh, detailZh, tone, interactionHintZh }];
  }));
  const desktopRoleAbilityPanel = (() => {
    const loadout = getRoleLoadout(viewerPlayerState?.roleId ?? null);
    if (!viewerPlayerState || !loadout) return null;
    const status = roleAbilityStatusBySeat.get(viewerPlayerState.seatId);
    if (!status) return null;
    return {
      roleNameZh: loadout.roleNameZh,
      abilityNameZh: loadout.abilityNameZh,
      abilitySummaryZh: loadout.abilitySummaryZh,
      usesRemaining: viewerPlayerState.roleAbilityUsesRemaining,
      usesTotal: loadout.roleAbilityUses,
      stateLabelZh: status.stateLabelZh,
      detailZh: status.detailZh,
      tone: status.tone,
      interactionHintZh: status.interactionHintZh,
    };
  })();
  const desktopAbilityStatuses = participantPlayers.map((player) => {
    const loadout = getRoleLoadout(player.roleId);
    const status = roleAbilityStatusBySeat.get(player.seatId);
    if (!loadout || !status) return null;
    return {
      key: `role-status-${player.seatId}`,
      labelZh: `${player.seatId}｜${loadout.abilityNameZh}`,
      stateLabelZh: status.stateLabelZh,
      detailZh: `${loadout.roleNameZh}｜${status.detailZh}`,
      tone: status.tone,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const campfireStepCards = [
    {
      step: 1,
      titleZh: "事件處理區",
      statusZh: data.snapshot.phase === "campfire" ? (data.snapshot.currentEvent ? "正在檢查本輪事件是否達標" : "本輪沒有事件或事件已離場") : "待進入營火後檢查",
      active: data.snapshot.phase === "campfire" && (campfireStage === "resolve_event" || (!campfireStage && !currentPendingLoss)),
    },
    {
      step: 2,
      titleZh: "任務宣告",
      statusZh: data.snapshot.phase === "campfire"
        ? (taskDeclarationDiagnostic?.status === "ready" ? "可嘗試宣告任務" : taskDeclarationDiagnostic?.reasonsZh[0] ?? "目前尚未到任務判定")
        : "待進入營火後開放",
      active: data.snapshot.phase === "campfire" && (campfireStage === "resolve_event" || (!campfireStage && !currentPendingLoss)),
    },
    {
      step: 3,
      titleZh: "風險地格與其他損失",
      statusZh: currentPendingLoss
        ? `卡在 ${currentPendingLoss.targetSeat} 的損失處理`
        : data.snapshot.phase === "campfire"
          ? "若有人停在風險地格或有其他營火損失，會在這裡逐筆處理"
          : "尚未進入營火",
      active: data.snapshot.phase === "campfire" && (Boolean(currentPendingLoss) || campfireStage === "resolve_losses"),
    },
    {
      step: 4,
      titleZh: "壓力＋1與里程碑",
      statusZh: data.snapshot.phase === "campfire"
        ? `目前壓力 ${data.snapshot.pressure}；下一步會檢查里程碑與任務限制`
        : `目前壓力 ${data.snapshot.pressure}`,
      active: data.snapshot.phase === "campfire" && campfireStage === "apply_pressure",
    },
    {
      step: 5,
      titleZh: "狀態確認與勝敗檢查",
      statusZh: data.snapshot.phase === "gameover" || data.snapshot.status === "finished"
        ? "本局已進入結算"
        : data.snapshot.phase === "campfire"
          ? "營火尾聲會統一檢查歸零、壓力到頂與任務是否達標"
          : "待進入營火尾聲後檢查",
      active: data.snapshot.phase === "gameover" || data.snapshot.status === "finished" || (data.snapshot.phase === "campfire" && campfireStage === "state_check"),
    },
  ];
  const personalGuideSteps: Array<{ id: PersonalGuideStepId; titleZh: string; areaZh: string; summaryZh: string; bulletsZh: string[] }> = [
    {
      id: "event",
      titleZh: "此為事件卡區",
      areaZh: "上方事件列",
      summaryZh: "每輪先翻事件。先看需求與未解懲罰，再決定這輪要不要優先處理。",
      bulletsZh: [
        "先看事件名稱、需求與未解懲罰。",
        "投入事件不花 AP，但要在自己的回合內做。",
        "壓力到 3 後，至少要兩名玩家實際投入才算解掉。",
      ],
    },
    {
      id: "tasks",
      titleZh: "此為任務列",
      areaZh: "事件列下方的任務區",
      summaryZh: "任務不會自動完成。條件成立後，要在營火主動宣告。",
      bulletsZh: [
        "先觀察哪張任務快達成。",
        "壓力到 6 之後，如果本輪沒有 0AP 相鄰互助，就不能宣告任務。",
        "整局至少要完成 2 張任務才可能勝利。",
      ],
    },
    {
      id: "map",
      titleZh: "此為地圖主介面",
      areaZh: "中央大區塊",
      summaryZh: "移動、會合、進站點與風險停留，主要都在地圖上完成。",
      bulletsZh: [
        "移動 1 格通常花 1 AP。",
        "風險地格可以走，但若營火時還停在上面，會吃 SR 損失。",
        "地圖右上角會顯示目前行動玩家與 AP。",
      ],
    },
    {
      id: "roster",
      titleZh: "此為玩家狀態區",
      areaZh: "地圖左側",
      summaryZh: "這裡會顯示每位玩家的 SR、SP、位置與技能狀態，方便你判斷誰該先處理。",
      bulletsZh: [
        "SR 是生存／身體狀態，SP 是心理／安定狀態。",
        "有人接近 0 時，就要優先考慮互助或陪伴標記。",
        "角色能力大多是每輪 1 次，要留意何時用最賺。",
      ],
    },
    {
      id: "hand",
      titleZh: "此為手牌區",
      areaZh: "右側欄位",
      summaryZh: "行動卡能幫你補位、支援，或調整事件節奏，但不一定每回合都要打。",
      bulletsZh: [
        "大部分行動卡要花 1 AP。",
        "手牌上限是 3；滿手時不再抽牌，但也不用額外棄牌。",
        "先看卡牌效果，再決定要不要保留到更關鍵的時機。",
      ],
    },
    {
      id: "controls",
      titleZh: "此為操作列與流程按鈕",
      areaZh: "畫面最上方",
      summaryZh: "輪到你時，會在這裡結束回合、查看目標，也能重開教學。",
      bulletsZh: [
        "如果你已經做完這回合，按『結束回合』交棒給下一位。",
        "若有阻塞視窗，代表系統正在等某位玩家做裁定。",
        "看不懂時，可以再按一次『新手教學』重看引導。",
      ],
    },
  ];
  const personalGuideZoneTargetIdMap: Record<PersonalGuideStepId, string> = {
    event: "gh-guide-zone-event",
    tasks: "gh-guide-zone-tasks",
    map: "gh-guide-zone-map",
    roster: "gh-guide-zone-roster",
    hand: "gh-guide-zone-hand",
    controls: "gh-guide-zone-controls",
  };
  const activePersonalGuideStep = personalGuideWalkthroughStep !== null
    ? personalGuideSteps[personalGuideWalkthroughStep] ?? null
    : null;

  const personalGuideContextContent: Record<PersonalGuideContextId, { titleZh: string; summaryZh: string; bulletsZh: string[] }> = {
    event_intro: {
      titleZh: "第一次看到事件時",
      summaryZh: "事件是每輪的核心壓力來源。先看需求，再決定這輪是要硬解事件，還是先穩住隊友。",
      bulletsZh: [
        `目前事件：${data.snapshot.currentEvent?.nameZh ?? "尚未翻出"}`,
        `需求值：SR ${data.snapshot.currentEvent?.requirement.srRequired ?? 0} / SP ${data.snapshot.currentEvent?.requirement.spRequired ?? 0}`,
        `未解懲罰：${data.snapshot.currentEvent?.unresolvedPenaltyTextZh ?? "目前沒有未解懲罰"}`,
      ],
    },
    action_intro: {
      titleZh: "第一次輪到你行動",
      summaryZh: "輪到你時，先看地圖右上角的 AP，再決定這回合要移動、互助、投入事件，還是先出牌。",
      bulletsZh: [
        `你目前剩餘 AP：${viewerPlayerState?.remainingAp ?? 0}`,
        "移動與大多數行動卡通常要花 AP。",
        "投入事件與相鄰互助都是 0AP，但仍要在自己的回合內做。",
      ],
    },
    help_intro: {
      titleZh: "第一次可互助時",
      summaryZh: "當你和隊友相鄰時，可以用 0AP 互助，把自己的 1 點 SR 或 SP 轉給對方。這是救人和解任務都很關鍵的動作。",
      bulletsZh: [
        "互助每位玩家每回合最多 1 次。",
        "白衣見習生、街巷信使等角色，會在互助後有額外效果。",
        "壓力到 6 之後，若本輪完全沒有 0AP 相鄰互助，就不能宣告任務。",
      ],
    },
    campfire_intro: {
      titleZh: "第一次進營火階段",
      summaryZh: "營火不是休息，而是整輪的正式結算。事件、任務、損失、壓力與勝敗，都在這裡依序處理。",
      bulletsZh: campfireStepCards.map((item) => `${item.step}. ${item.titleZh}`),
    },
  };
  const blockingAbilityWindow = data.snapshot.blockingWindow?.kind === "ability" ? data.snapshot.blockingWindow : null;
  const merchantGuardAbilityWindow = blockingAbilityWindow?.abilityId === "merchant_guard" ? blockingAbilityWindow : null;
  const storytellerAbilityWindow = blockingAbilityWindow?.abilityId === "square_storyteller" ? blockingAbilityWindow : null;
  const storytellerAbilityOptions = storytellerAbilityWindow
    ? storytellerAbilityWindow.candidateSeatIds.map((seatId) => participantPlayers.find((player) => player.seatId === seatId)).filter((player): player is PlayerState => Boolean(player))
    : [];
  const selectedFollowMoveOption = selectedAdjacentHelpFollowChoices.find((choice) => choice.moveSeat === selectedHelpFreeMoveSeat && choice.moveToTileId === selectedHelpFreeMoveTileId) ?? null;
  const criticalPlayers = participantPlayers.filter((player) => player.currentSr <= 1 || player.currentSp <= 1);
  const criticalAlertZh = criticalPlayers.length === 0
    ? null
    : criticalPlayers
        .map((player) => `${player.seatId}｜${player.displayName} ${player.currentSr <= 1 ? `SR ${player.currentSr}` : ""}${player.currentSr <= 1 && player.currentSp <= 1 ? " / " : ""}${player.currentSp <= 1 ? `SP ${player.currentSp}` : ""}`)
        .join("　•　");
  const recentActionFeed = actionFeedbackHistory.slice(0, 4);
  const centerBroadcastBodyToneClasses = latestActionFeedback?.tone === "error"
    ? "text-rose-700 drop-shadow-[0_6px_28px_rgba(244,63,94,0.32)]"
    : "text-amber-950 drop-shadow-[0_8px_30px_rgba(245,158,11,0.24)]";
  const centerBroadcastMetaToneClasses = latestActionFeedback?.tone === "error"
    ? "text-rose-500/95 drop-shadow-[0_2px_12px_rgba(244,63,94,0.18)]"
    : "text-stone-600/95 drop-shadow-[0_2px_12px_rgba(15,23,42,0.12)]";
  const groupedPendingLossBroadcastZh = deriveQueuedLossBroadcastZh(data.snapshot);
  const centerBroadcastBodyZh = groupedPendingLossBroadcastZh
    ? groupedPendingLossBroadcastZh
    : showCenterBroadcast && latestActionFeedback
      ? latestActionFeedback.broadcastTextZh ?? buildActionFeedbackSummary(latestActionFeedback)
      : `輪到你了！你有 ${viewerPlayerState?.remainingAp ?? 0} AP，可以移動、投入事件、互助或結束回合。`;
  const centerBroadcastTitleZh = groupedPendingLossBroadcastZh
    ? "營火損失摘要"
    : showCenterBroadcast && latestActionFeedback
      ? latestActionFeedback.titleZh
      : "輪到你了";
  const settlementTitleZh = data.snapshot.pressure >= 10 ? "壓力失控，任務失敗" : zeroedPlayers.length > 0 ? "有玩家倒下，本局失敗" : data.snapshot.phase === "gameover" ? "本局結束" : "戰局持續中";
  const settlementReasonZh = data.snapshot.pressure >= 10
    ? "壓力值已達 10，系統依規則進入失敗結算。"
    : zeroedPlayers.length > 0
      ? `以下玩家資源歸零：${zeroedPlayers.map((player) => `${player.seatId}｜${player.displayName}`).join("、")}`
      : "本局已離開主流程，請查看紀錄確認最後一段結算。";
  async function updateRoomConfigPatch(patch: Extract<RoomAction, { type: "update_room_config" }>["patch"]) {
    if (!data?.viewerSeat) return;
    await runAction({ type: "update_room_config", actorSeat: data.viewerSeat, patch });
  }

  async function runMoveFromMap(tileId: string) {
    if (!data?.viewerSeat) return;
    setSelectedMoveTileId(tileId);
    const targetTile = displayMapTiles.find((tile) => tile.tileId === tileId) ?? null;
    const shouldPromptRanger = Boolean(
      viewerPlayerState
        && currentTile
        && targetTile
        && viewerRoleId === "ranger_pathfinder"
        && (viewerPlayerState.roleAbilityUsesRemaining ?? 0) > 0
        && data?.snapshot.roomConfig.roleAbilityToggles["ranger_pathfinder"] !== false
        && (currentTile.kind === "risk" || targetTile.kind === "risk"),
    );
    if (shouldPromptRanger && !selectedRangerAbilityMode) {
      setMapActionFeedbackZh(`請先選擇是否發動〈越野突破〉。
你可按下方技能提示中的「發動」或「略過」後，再執行移動。`);
      return;
    }
    await runAction({
      type: "move",
      actorSeat: data.viewerSeat,
      toTileId: tileId,
      useRangerAbility: shouldPromptRanger && selectedRangerAbilityMode === "use",
    });
    setSelectedRangerAbilityMode("");
  }

  async function runUseCurrentTileFromMap() {
    if (!data?.viewerSeat) return;
    await runAction({ type: "use_station_or_shelter", actorSeat: data.viewerSeat });
  }

  async function runAdjacentHelpFromMap(
    targetSeat: SeatId,
    resourceType: "SR" | "SP",
    followMove?: { moveSeat: SeatId; moveToTileId: string },
  ) {
    if (!data?.viewerSeat) return;
    setSelectedHelpTargetSeat(targetSeat);
    setSelectedHelpResource(resourceType);
    if (followMove) {
      setSelectedHelpFreeMoveSeat(followMove.moveSeat);
      setSelectedHelpFreeMoveTileId(followMove.moveToTileId);
    }
    const helpTarget = adjacentHelpOptions.find((option) => option.seatId === targetSeat) ?? null;
    const shouldPromptMedic = Boolean(
      viewerRoleId === "medic_apprentice"
        && (viewerPlayerState?.roleAbilityUsesRemaining ?? 0) > 0
        && data?.snapshot.roomConfig.roleAbilityToggles["medic_apprentice"] !== false
        && resourceType === "SP"
        && helpTarget,
    );
    const availableFollowMoves = helpTarget?.followMoveChoices ?? [];
    const shouldPromptMessenger = Boolean(
      viewerRoleId === "alley_messenger"
        && (viewerPlayerState?.roleAbilityUsesRemaining ?? 0) > 0
        && data?.snapshot.roomConfig.roleAbilityToggles["alley_messenger"] !== false
        && availableFollowMoves.length > 0,
    );
    if (shouldPromptMedic && !selectedMedicAbilityMode) {
      setMapActionFeedbackZh("請先選擇是否發動〈安定陪伴〉，再送出這次互助。");
      return;
    }
    if (shouldPromptMessenger && !selectedMessengerAbilityMode) {
      setMapActionFeedbackZh("請先選擇是否發動〈牽起連結〉。若要發動，還要指定免費移動對象與目的地。");
      return;
    }
    const resolvedFollowMove = selectedMessengerAbilityMode === "use"
      ? (followMove ?? (selectedHelpFreeMoveSeat && selectedHelpFreeMoveTileId ? { moveSeat: selectedHelpFreeMoveSeat as SeatId, moveToTileId: selectedHelpFreeMoveTileId } : undefined))
      : undefined;
    if (shouldPromptMessenger && selectedMessengerAbilityMode === "use" && !resolvedFollowMove) {
      setMapActionFeedbackZh("請先指定〈牽起連結〉的免費移動對象與目的地。");
      return;
    }
    await runAction({
      type: "adjacent_help",
      actorSeat: data.viewerSeat,
      targetSeat,
      resourceType,
      useMedicAbility: shouldPromptMedic && selectedMedicAbilityMode === "use",
      useMessengerAbility: shouldPromptMessenger && selectedMessengerAbilityMode === "use",
      freeMoveSeat: resolvedFollowMove?.moveSeat,
      freeMoveToTileId: resolvedFollowMove?.moveToTileId,
    });
    setSelectedMedicAbilityMode("");
    setSelectedMessengerAbilityMode("");
    setSelectedHelpFreeMoveSeat("");
    setSelectedHelpFreeMoveTileId("");
  }

  const actionDisabledReasonZh = uiState.activePlayerActionReasonZh;
  const canViewerQuickInvest = Boolean(data.viewerRole !== "observer" && data.viewerSeat && data.snapshot.phase === "action" && data.snapshot.currentEvent && !actionDisabledReasonZh);
  const selectedCardUseDisabledReasonZh = actionDisabledReasonZh
    ?? cardTargetSelectionErrorZh
    ?? cardTileSelectionErrorZh
    ?? cardResourceSelectionErrorZh
    ?? cardTeammateResourceSelectionErrorZh;


  const desktopTaskRailItems = taskSurfaceEntries.map(({ task, status }) => ({
    taskId: task.taskId,
    title: task.nameZh,
    isDone: task.completionCheckedByHost,
    isSelected: selectedTaskId === task.taskId,
    badgeZh: status.badgeZh,
    railStatusZh: status.canDeclare ? "可宣告" : status.key === "ready_wait_campfire" ? "待營火" : task.completionCheckedByHost ? "完成" : undefined,
    tone: status.tone,
    canDeclare: status.canDeclare,
  }));

  const desktopRosterItems = participantPlayers.map((player) => {
    const loadout = getRoleLoadout(player.roleId);
    const abilityStatus = roleAbilityStatusBySeat.get(player.seatId);
    return {
      seat: player.seatId,
      name: player.displayName,
      roleName: player.roleNameZh ?? "未指派角色",
      roleAbilityName: loadout?.abilityNameZh,
      sr: player.currentSr,
      sp: player.currentSp,
      ap: player.remainingAp,
      companionUsed: player.companionTokensRemaining <= 0,
      isActive: player.seatId === data.snapshot.activeSeat,
      isViewer: player.seatId === data.viewerSeat,
      isAi: player.isAi,
      positionTileId: player.positionTileId,
      roleAbilitySummary: loadout?.abilitySummaryZh,
      roleAbilityUsesRemaining: typeof player.roleAbilityUsesRemaining === "number" ? player.roleAbilityUsesRemaining : undefined,
      roleAbilityUsesTotal: loadout?.roleAbilityUses,
      abilityStateLabelZh: abilityStatus?.stateLabelZh,
      abilityStateTone: abilityStatus?.tone,
      canSelectTarget: legalCardTargetSeatSet.has(player.seatId),
      isSelectedTarget: selectedCardTargetSeat === player.seatId,
      targetHintZh: legalCardTargetSeatSet.has(player.seatId)
        ? selectedCardTargetSeat === player.seatId
          ? "已選目標"
          : "可選目標"
        : undefined,
    };
  });

  const desktopHandItems = viewerHandCardIds.map((cardId, index) => {
    const card = ACTION_CARD_DEFINITION_MAP[cardId];
    const instanceKey = buildHandCardInstanceKey(cardId, index);
    return {
      instanceKey,
      cardId,
      title: card?.nameZh ?? cardId,
      category: card?.category ?? "support",
      description: card?.rulesTextZh ?? "尚未載入牌面文字",
      note: card?.noteZh ?? "",
      selected: selectedActionCardInstanceKey === instanceKey,
      metaPills: buildActionCardMetaPills(cardId),
    };
  });

  const desktopSelectedCardPanel = currentCardDefinition
    ? {
        title: currentCardDefinition.nameZh,
        rulesText: currentCardDefinition.rulesTextZh,
        disabled: Boolean(selectedCardUseDisabledReasonZh) || submitting || !data.viewerSeat || !selectedActionCardId,
        actionLabel: "使用這張牌",
        helperText: selectedCardUseDisabledReasonZh ?? currentCardDefinition.noteZh ?? "若這張牌需要指定隊友、地格或資源，請先完成下方選擇。",
        targetPromptZh: cardTargetPromptZh ?? undefined,
        targetSummaryZh: cardTargetSelectionSummaryZh ?? undefined,
        targetOptions: cardNeedsTargetSeat
          ? legalCardTargetPlayers.map((player) => ({
              seat: player.seatId,
              labelZh: `${player.seatId}｜${player.displayName}`,
              selected: selectedCardTargetSeat === player.seatId,
              disabled: false,
            }))
          : undefined,
        tilePromptZh: cardTilePromptZh ?? undefined,
        tileSummaryZh: cardTileSelectionSummaryZh ?? undefined,
        tileOptions: cardNeedsTileSelection
          ? legalCardTileOptions.map((tile) => ({
              tileId: tile.tileId,
              labelZh: `${tile.tileId}｜${tile.nameZh}`,
              selected: selectedCardTileId === tile.tileId,
              disabled: false,
            }))
          : undefined,
        resourcePromptZh: cardResourcePromptZh ?? undefined,
        resourceSummaryZh: cardResourceSelectionSummaryZh ?? undefined,
        resourceOptions: cardNeedsResourceSelection ? cardResourceOptions : undefined,
        teammateResourcePromptZh: cardTeammateResourcePromptZh ?? undefined,
        teammateResourceSummaryZh: cardTeammateResourceSummaryZh ?? undefined,
        teammateResourceOptions: cardNeedsTeammateResourceSelection ? cardTeammateResourceOptions : undefined,
        metaPills: buildActionCardMetaPills(currentCardDefinition.cardId),
        channelSections: buildActionCardChannels(currentCardDefinition.cardId),
      }
    : null;

  const selectedTaskProgressLinesZh = selectedTask ? buildTaskProgressLines(data.snapshot, selectedTask) : [];
  const selectedTaskDetailLinesZh = selectedTaskProgressLinesZh.filter((line, index, array) => array.indexOf(line) === index);
  const selectedTaskNoteLinesZh = selectedTaskSurfaceStatus
    ? selectedTaskSurfaceStatus.reasonsZh
        .filter((reason, index, array) => array.indexOf(reason) === index)
        .filter((reason) => reason !== selectedTaskSurfaceStatus.summaryZh && !selectedTaskDetailLinesZh.includes(reason))
        .slice(0, 2)
    : [];
  const desktopEnvironmentPills = buildEnvironmentPills(data.snapshot);
  const desktopSelectedTaskPanel = selectedTask && selectedTaskSurfaceStatus
    ? {
        taskId: selectedTask.taskId,
        title: selectedTask.nameZh,
        subtitle: selectedTask.completionHintZh,
        rulesText: selectedTask.rulesTextZh,
        reward: selectedTask.rewardTextZh,
        badgeZh: selectedTaskSurfaceStatus.badgeZh,
        tone: selectedTaskSurfaceStatus.tone,
        summaryZh: selectedTaskSurfaceStatus.summaryZh,
        reasonsZh: selectedTaskSurfaceStatus.reasonsZh,
        progressLinesZh: selectedTaskProgressLinesZh,
        canDeclare: selectedTaskSurfaceStatus.canDeclare,
        declareDisabledReasonZh: !selectedTaskSurfaceStatus.canDeclare ? (selectedTaskSurfaceStatus.reasonsZh[0] ?? selectedTaskSurfaceStatus.summaryZh) : undefined,
      }
    : null;


  const desktopMapStage = (
    <GuardianHeartMapStage
      mapTiles={displayMapTiles}
      players={data.snapshot.players}
      viewerSeat={data.viewerSeat}
      activeSeat={data.snapshot.activeSeat}
      legalMoveTileIds={legalMoveTileIds}
      selectedMoveTileId={selectedMoveTileId}
      selectedTileId={selectedMapTile?.tileId ?? ""}
      actionDisabledReasonZh={actionDisabledReasonZh}
      adjacentHelpOptions={adjacentHelpOptions}
      canUseAdjacentHelp={canUseAdjacentHelpFromMap}
      canUseMessengerAbility={canUseMessengerAbility}
      canUseMedicBonusHint={canUseMedicBonusHint}
      latestActionFeedbackZh={mapActionFeedbackZh}
      pressureTaskUnlockStatusZh={pressureTaskUnlockStatusZh}
      roleAbilityHintsZh={roleAbilityHintsZh}
      onAdjacentHelp={runAdjacentHelpFromMap}
      onSelectTile={setSelectedMapTileId}
      onSelectMoveTile={setSelectedMoveTileId}
      onMoveHere={runMoveFromMap}
      onUseCurrentTile={runUseCurrentTileFromMap}
      interactionEnabled={data.viewerRole !== "observer"}
      hideMetaBar
    />
  );

  const viewerRoleChipZh = data.viewerRole === "observer"
    ? "觀察者模式"
    : `${data.displayName}｜${uiState.roomRoleLabelZh}${data.viewerSeat ? `｜${data.viewerSeat}` : ""}`;

  const renderTopToolbarActionPills = () => (
    <>
      {data.snapshot.phase === "lobby" ? (
        <ActionPillButton
          label="開始遊戲"
          disabled={!uiState.canStartGame || submitting}
          tone="dark"
          title={uiState.canStartGame ? "開始整局流程" : startGameHintZh}
          onClick={() => runAction({ type: "start_game", actorSeat: data.viewerSeat ?? "P1" })}
        />
      ) : null}
      {canViewerEndTurn ? (
        <ActionPillButton
          label="結束回合"
          disabled={submitting}
          tone="dark"
          title="結束你的行動，交棒給下一位。若還有可做的 0AP 操作，系統會先提醒。"
          onClick={() => runAction({ type: "end_turn", actorSeat: data.viewerSeat ?? "P1" })}
        />
      ) : null}
      {data.snapshot.phase !== "lobby" ? (
        <>
          <button className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-[11px] font-medium text-sky-700 hover:bg-sky-100" onClick={() => { setPersonalGuidePrefs((current) => ({ ...current, guideEnabled: true })); setShowNewcomerGuideModal(true); setPersonalGuideWalkthroughStep(0); }}>新手教學</button>
          <button className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100" onClick={() => setShowGoalsModal(true)}>本局目標</button>
          <button className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100" onClick={() => setShowWorldviewModal(true)}>世界觀</button>
        </>
      ) : null}
      <Link href={`/rooms/${roomCode}/logs?joinToken=${encodeURIComponent(data.joinToken)}&displayName=${encodeURIComponent(data.displayName)}`} className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50">紀錄</Link>
      <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50" onClick={() => void bootstrap()}>重整</button>
      <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50" onClick={() => router.push('/')}>首頁</button>
      {data.snapshot.phase !== "lobby" && desktopEnvironmentPills.length > 0 ? (
        <details className="relative rounded-full border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] text-stone-700">
          <summary className="cursor-pointer list-none font-medium">環境</summary>
          <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[280px] rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-500">環境校正</p>
            <p className="mt-1 text-[9px] leading-4 text-stone-500">版本校正用，不影響主流程判讀。</p>
            <DesktopCardMetaStrip items={desktopEnvironmentPills} className="mt-2" />
          </div>
        </details>
      ) : null}
      {data.viewerRole === "host" ? (
        <details className="relative rounded-full border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] text-stone-700">
          <summary className="cursor-pointer list-none font-medium">流程備援</summary>
          <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[280px] rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
            <p className="text-[9.5px] text-stone-500">主流程卡住時再用。</p>
            <div className="space-y-2">
              <ActionPillButton
                label="開始本輪"
                disabled={!uiState.canStartRound || submitting}
                tone="amber"
                title={uiState.canStartRound ? "若自動推進失敗，可手動開始本輪。" : (uiState.hostActionReasonZh ?? actionDisabledReasonZh ?? uiState.phaseSummaryZh)}
                onClick={() => runAction({ type: "start_round", actorSeat: data.viewerSeat ?? "P1" })}
              />
              <ActionPillButton
                label="處理營火"
                disabled={!uiState.canResolveCampfire || submitting}
                tone="rose"
                title={uiState.canResolveCampfire ? "若自動推進失敗，可手動處理營火。" : (uiState.hostActionReasonZh ?? actionDisabledReasonZh ?? uiState.phaseSummaryZh)}
                onClick={() => runAction({ type: "resolve_campfire", actorSeat: data.viewerSeat ?? "P1" })}
              />
              <ActionPillButton
                label="AI 下一位"
                disabled={submitting || !data.viewerSeat || data.viewerRole !== "host"}
                tone="outline"
                title="由系統推進當前 AI 座位"
                onClick={() => runAction({ type: "run_ai_turn", actorSeat: data.viewerSeat ?? "P1" })}
              />
            </div>
          </div>
        </details>
      ) : null}
    </>
  );

  return (
    <main className="min-h-screen bg-stone-100 px-2.5 py-3 text-stone-900 lg:px-3 lg:py-3.5">
      <div className="mx-auto mb-2 max-w-[1500px]">
        <div className="sticky top-2 z-20 rounded-[24px] border border-stone-200 bg-white/96 px-3 py-2 shadow-sm backdrop-blur">
          <div className="border-b border-stone-200 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2 xl:hidden">
              <span className="rounded-full bg-stone-900 px-3 py-1 text-[11px] font-semibold text-white">{data.room.roomCode}</span>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-700">{phaseLabel(data.snapshot.phase)}</span>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] text-stone-600">{viewerRoleChipZh}</span>
            </div>
            <div className="hidden xl:flex xl:items-center xl:justify-between xl:gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded-full bg-stone-900 px-3 py-1 text-[11px] font-semibold text-white">{data.room.roomCode}</span>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-700">{phaseLabel(data.snapshot.phase)}</span>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] text-stone-600">{viewerRoleChipZh}</span>
              </div>
              <div id="gh-guide-zone-controls" className="flex flex-wrap items-center justify-end gap-1.5">
                {renderTopToolbarActionPills()}
              </div>
            </div>
            <div id="gh-guide-zone-controls" className="mt-2 flex flex-wrap items-center gap-1.5 xl:hidden">
              {renderTopToolbarActionPills()}
            </div>
          </div>


          <div className="mt-2 grid gap-2 xl:hidden">
            <div className="min-w-0 rounded-[16px] border border-stone-200 bg-stone-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-stone-500">本輪事件</p>
                  <p className="text-[14px] font-bold leading-5 text-stone-950">{latestEventNameZh}</p>
                </div>
                {eventProgress ? <HoverInfo label={<span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-700">投入 {eventProgress.distinctContributorCount} 人</span>} content={eventProgress.contributorNamesZh.length > 0 ? `已投入玩家：${eventProgress.contributorNamesZh.join("、")}` : "無人投入"} align="left" /> : null}
              </div>
              {data.snapshot.currentEvent ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-700">
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium">條件 <span className="font-bold text-rose-700">SR {data.snapshot.currentEvent.requirement.srRequired}</span> / <span className="font-bold text-rose-700">SP {data.snapshot.currentEvent.requirement.spRequired}</span></span>
                  {eventProgress ? <span className="rounded-full bg-white px-2.5 py-1">尚缺 <span className="font-bold text-rose-700">SR {eventProgress.remainingSr}</span> / <span className="font-bold text-rose-700">SP {eventProgress.remainingSp}</span></span> : null}
                  <HoverInfo label={<span className="rounded-full bg-rose-600 px-2.5 py-1 text-white">未解懲罰</span>} content={data.snapshot.currentEvent.unresolvedPenaltyTextZh} align="left" />
                  {canViewerQuickInvest ? (
                    <div className="ml-auto flex flex-col gap-1 rounded-[14px] border border-amber-200 bg-amber-50 px-1.5 py-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="px-1 text-[10px] font-medium text-amber-900">投入事件</span>
                        <input type="number" min={0} value={investSr} onChange={(e) => setInvestSr(Number(e.target.value))} className="w-14 rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] text-stone-900" placeholder="SR" />
                        <input type="number" min={0} value={investSp} onChange={(e) => setInvestSp(Number(e.target.value))} className="w-14 rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] text-stone-900" placeholder="SP" />
                        <button className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-medium text-white disabled:opacity-40" disabled={submitting || !data.viewerSeat || !eventProgress} onClick={() => runAction({ type: "invest_event", actorSeat: data.viewerSeat ?? "P1", srPaid: investSr, spPaid: investSp, convertOne: selectedInvestConversion || undefined })}>投入</button>
                      </div>
                      {investConversionOptions.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1 px-1">
                          <span className="text-[9px] font-medium text-violet-700">資源轉換</span>
                          {investConversionOptions.map((option) => (
                            <button
                              key={`mobile-invest-convert-${option.value || "none"}`}
                              type="button"
                              className={[
                                "rounded-full border px-2 py-0.5 text-[9px] transition",
                                option.selected
                                  ? "border-violet-500 bg-violet-600 text-white"
                                  : option.disabled
                                    ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                                    : "border-violet-200 bg-white text-violet-800 hover:border-violet-400 hover:bg-violet-50",
                              ].join(" ")}
                              disabled={option.disabled}
                              onClick={() => setSelectedInvestConversion(option.value)}
                            >
                              {option.labelZh}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-stone-600">新一輪會自動揭示事件。</p>
              )}
            </div>

            <div className="flex flex-col gap-2 xl:items-end">
              <div className="flex flex-wrap items-center justify-start gap-1.5 xl:justify-end">
                <CompactStat label="回合" value={headerRoundValueZh} />
                <PressureTrack value={data.snapshot.pressure} pulse={pulsePressure} />
                <CompactStat label="任務" value={headerTaskValueZh} />
                <CompactStat label="輪到誰" value={headerCurrentActorZh} emphasize />
                <CompactStat label="你的 AP" value={String(viewerPlayerState?.remainingAp ?? "—")} />
              </div>
              {data.snapshot.phase !== "lobby" ? <p className="text-[10px] text-stone-500">剩餘 {remainingDays} 天</p> : null}
            </div>
          </div>
        </div>
      </div>
      {campfireTaskWindowVisible && !openingOnboardingStep && !showNewcomerGuideModal && !showEventRevealModal && !showNightTransitionModal ? (
        <div className="fixed inset-0 z-[45] flex items-center justify-center bg-stone-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-[28px] border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">營火流程</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">任務宣告窗口</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">第 {data.snapshot.round} 輪</span>
            </div>
            <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50/70 p-4 text-sm leading-7 text-amber-950">
              {campfireReadyTaskEntries.length > 0
                ? <p>目前有 <b>{campfireReadyTaskEntries.length}</b> 張任務可宣告。先完成任務宣告，系統才會繼續自動處理後面的營火結算。</p>
                : <p>目前沒有可宣告任務，系統會自動繼續營火。</p>}
            </div>
            {campfireReadyTaskEntries.length > 0 ? (
              <div className="mt-4 space-y-3">
                {campfireReadyTaskEntries.map(({ task, status, progressLinesZh }) => (
                  <div key={`campfire-ready-${task.taskId}`} className="rounded-[20px] border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-stone-950">{task.nameZh}</p>
                        <p className="mt-1 text-[12px] leading-6 text-stone-700">{task.completionHintZh}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-medium text-emerald-800">{status.badgeZh}</span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                      <div>
                        <p className="text-[11px] font-semibold text-stone-700">獎勵：{task.rewardTextZh}</p>
                        <ul className="mt-2 space-y-1 text-[11px] leading-6 text-stone-600">
                          {progressLinesZh.slice(0, 2).map((line) => <li key={`${task.taskId}-${line}`}>• {line}</li>)}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-2 text-[11px] font-medium text-stone-700 hover:bg-stone-50" onClick={() => setSelectedTaskId(task.taskId)}>右側詳看</button>
                        <button type="button" className="rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-medium text-white disabled:opacity-40" disabled={submitting || !data.viewerSeat || data.viewerRole === "observer"} onClick={() => { setSelectedTaskId(task.taskId); void runAction({ type: "declare_task", actorSeat: data.viewerSeat ?? "P1", taskId: task.taskId }); }}>
                          宣告這張任務
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-4">
              {data.viewerRole === "host" ? (
                <button type="button" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setDismissedCampfireTaskWindowKey(campfireTaskWindowKey)}>
                  {campfireReadyTaskEntries.length > 0 ? "略過任務宣告，繼續營火" : "立即繼續營火"}
                </button>
              ) : (
                <p className="text-[11px] text-stone-500">不宣告就等房主繼續營火。</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {openingOnboardingStep ? (
        <div className="fixed inset-0 z-[46] flex items-center justify-center bg-stone-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-stone-200 bg-white p-6 shadow-2xl">
            {openingOnboardingStep === "worldview" ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">正式開始前</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">世界觀</h2>
                <div className="mt-4 rounded-3xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-sm leading-7 text-violet-950">{worldViewIntroZh}</p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-violet-950">
                    {worldViewResourceLinesZh.map((line, index) => (
                      <li key={`worldview-line-${index}`} className="rounded-2xl bg-white px-3 py-2">• {renderKeyText(line, "amber")}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm leading-7 text-violet-950">目標是保住彼此、處理事件、完成任務，避免 SR / SP 崩盤。</p>
                </div>
                <div className="mt-5 flex justify-end">
                  <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white" onClick={() => setOpeningOnboardingStep("victory")}>下一步</button>
                </div>
              </>
            ) : openingOnboardingStep === "victory" ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">正式開始前</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">勝利條件</h2>
                <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <ul className="space-y-2 text-sm leading-7 text-emerald-950">
                    {victoryConditionLinesZh.map((line, index) => (
                      <li key={`opening-goal-line-${index}`} className="rounded-2xl bg-white px-3 py-2">• {renderKeyText(line, "rose")}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setOpeningOnboardingStep("worldview")}>上一頁</button>
                  <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white" onClick={() => setOpeningOnboardingStep("ask_guide")}>下一步</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">正式開始前</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">要新手引導嗎？</h2>
                <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-950">
                  <p>第一次玩建議先看一遍，會更快上手。</p>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setOpeningOnboardingStep("victory")}>上一頁</button>
                  <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => { setPersonalGuidePrefs((current) => ({ ...current, guideEnabled: false, zoneGuideCompleted: true })); setOpeningOnboardingStep(null); }}>不用，直接開始</button>
                  <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white" onClick={() => { setPersonalGuidePrefs((current) => ({ ...current, guideEnabled: true, zoneGuideCompleted: false })); setOpeningOnboardingStep(null); setShowNewcomerGuideModal(true); setPersonalGuideWalkthroughStep(0); }}>需要，開始引導</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      {showNewcomerGuideModal && activePersonalGuideStep ? (
        <div className="fixed inset-0 z-40">
          <GuideSpotlightOverlay rect={guideHighlightRect} />
          <div className="fixed inset-0 pointer-events-none overflow-hidden px-4 py-4">
            <div
              className="pointer-events-auto fixed flex flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white p-5 shadow-2xl"
              style={guideDialogPlacement ?? { top: 24, left: 24, width: 680, maxHeight: 'calc(100vh - 48px)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">個人化新手引導</p>
                  <h2 className="mt-1 text-2xl font-bold text-stone-950">{activePersonalGuideStep.titleZh}</h2>
                  <p className="mt-1 text-sm text-stone-500">{activePersonalGuideStep.areaZh}｜第 {(personalGuideWalkthroughStep ?? 0) + 1} / {personalGuideSteps.length} 步</p>
                </div>
                <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50" onClick={() => { setShowNewcomerGuideModal(false); setPersonalGuideWalkthroughStep(null); setPersonalGuidePrefs((current) => ({ ...current, zoneGuideCompleted: true })); }}>先跳過</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {personalGuideSteps.map((step, index) => (
                  <span
                    key={step.id}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${index === personalGuideWalkthroughStep ? "bg-stone-900 text-white" : index < (personalGuideWalkthroughStep ?? 0) ? "bg-emerald-100 text-emerald-800" : "border border-stone-300 bg-white text-stone-500"}`}
                  >
                    {index + 1}. {step.areaZh}
                  </span>
                ))}
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
                    <p className="text-sm font-semibold text-sky-950">這一區在做什麼</p>
                    <p className="mt-3 text-sm leading-7 text-sky-950">{activePersonalGuideStep.summaryZh}</p>
                    <ul className="mt-4 space-y-2 text-sm leading-7 text-sky-900">
                      {activePersonalGuideStep.bulletsZh.map((line, index) => (
                        <li key={`${activePersonalGuideStep.id}-bullet-${index}`} className="rounded-2xl bg-white px-3 py-2">• {renderKeyText(line, "amber")}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                      <p className="font-semibold text-stone-900">對照畫面</p>
                      {activePersonalGuideStep.id === "event" ? (
                        <>
                          <p className="mt-2">目前事件：<span className="font-semibold text-stone-950">{data.snapshot.currentEvent?.nameZh ?? "尚未翻出事件"}</span></p>
                          <p>未解懲罰：{data.snapshot.currentEvent?.unresolvedPenaltyTextZh ?? "目前沒有未解懲罰"}</p>
                        </>
                      ) : activePersonalGuideStep.id === "tasks" ? (
                        <>
                          <p className="mt-2">本局目前已完成 <span className="font-semibold text-emerald-700">{completedTasks}</span> / {totalTasks} 張任務。</p>
                          <p>任務要等營火階段主動宣告。</p>
                        </>
                      ) : activePersonalGuideStep.id === "map" ? (
                        <>
                          <p className="mt-2">你目前位置：<span className="font-semibold text-stone-950">{currentTile?.nameZh ?? "尚未站上正式地圖"}</span></p>
                          <p>相鄰可走目標：{moveOptions.length > 0 ? moveOptions.map((tile) => tile.nameZh).join("、") : "暫無可直接移動目標"}</p>
                        </>
                      ) : activePersonalGuideStep.id === "roster" ? (
                        <>
                          <p className="mt-2">目前最危急的是：{criticalPlayers.length > 0 ? criticalPlayers.map((player) => `${player.seatId}（SR ${player.currentSr} / SP ${player.currentSp}）`).join("、") : "暫時沒有瀕危玩家"}</p>
                          <p>角色技能列可幫你判斷誰先出手。</p>
                        </>
                      ) : activePersonalGuideStep.id === "hand" ? (
                        <>
                          <p className="mt-2">你手上共有 <span className="font-semibold text-stone-950">{desktopHandItems.length}</span> 張牌。</p>
                          <p>{desktopHandItems[0] ? `最上面那張是「${desktopHandItems[0].title}」` : "目前沒有手牌。"}</p>
                        </>
                      ) : (
                        <>
                          <p className="mt-2">現在階段：<span className="font-semibold text-stone-950">{phaseLabel(data.snapshot.phase)}</span></p>
                          <p>{canViewerEndTurn ? "輪到你時，完成操作後可以在上方按『結束回合』。" : "目前不是你的行動時機，先看誰在操作。"}</p>
                        </>
                      )}
                    </div>
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                      <p className="font-semibold">小提醒</p>
                      <p className="mt-2">只影響你自己；忘記時可再從上方重看。</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-200 pt-4">
                <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40" disabled={(personalGuideWalkthroughStep ?? 0) === 0} onClick={() => setPersonalGuideWalkthroughStep((current) => current === null ? 0 : Math.max(current - 1, 0))}>上一區</button>
                <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700" onClick={() => { setShowNewcomerGuideModal(false); setPersonalGuideWalkthroughStep(null); setPersonalGuidePrefs((current) => ({ ...current, zoneGuideCompleted: true })); }}>先進遊戲</button>
                <button type="button" className="rounded-full bg-stone-900 px-3 py-1.5 text-sm text-white" onClick={() => {
                  if ((personalGuideWalkthroughStep ?? 0) >= personalGuideSteps.length - 1) {
                    setShowNewcomerGuideModal(false);
                    setPersonalGuideWalkthroughStep(null);
                    setPersonalGuidePrefs((current) => ({ ...current, zoneGuideCompleted: true }));
                    return;
                  }
                  setPersonalGuideWalkthroughStep((current) => (current ?? 0) + 1);
                }}>{(personalGuideWalkthroughStep ?? 0) >= personalGuideSteps.length - 1 ? "完成引導" : "下一區"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {personalGuideContextPrompt ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/36 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">新手提示</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">{personalGuideContextContent[personalGuideContextPrompt].titleZh}</h2>
              </div>
              <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50" onClick={() => markPersonalGuideContextSeen(personalGuideContextPrompt)}>了解</button>
            </div>
            <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
              <p>{personalGuideContextContent[personalGuideContextPrompt].summaryZh}</p>
              <ul className="mt-3 space-y-2">
                {personalGuideContextContent[personalGuideContextPrompt].bulletsZh.map((line, index) => (
                  <li key={`${personalGuideContextPrompt}-${index}`} className="rounded-2xl bg-white px-3 py-2">• {renderKeyText(line, "rose")}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-stone-200 pt-4">
              <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => { setPersonalGuidePrefs((current) => ({ ...current, guideEnabled: false, seenContexts: Array.from(new Set([...current.seenContexts, personalGuideContextPrompt])) })); setPersonalGuideContextPrompt(null); }}>不再提示</button>
              <button className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white" onClick={() => markPersonalGuideContextSeen(personalGuideContextPrompt)}>了解</button>
            </div>
          </div>
        </div>
      ) : null}
      {showNightTransitionModal && nightTransitionInfo ? (
        <div className="fixed inset-0 z-40 overflow-hidden bg-[radial-gradient(circle_at_center,rgba(18,18,18,0.78)_0%,rgba(5,5,7,0.96)_68%,rgba(0,0,0,1)_100%)] px-4 py-6 animate-[night-fade-in_420ms_ease-out]">
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.9),rgba(0,0,0,1),rgba(8,8,10,0.96))] animate-[night-breath_1.7s_ease-in-out]" />
          <div className="relative flex h-full items-center justify-center">
            <div className="w-full max-w-3xl text-center text-stone-50">
              <p className="text-sm tracking-[0.28em] text-stone-300">營火之後</p>
              <h2 className="mt-4 text-4xl font-black tracking-[0.04em] text-white md:text-5xl">又過了一夜……</h2>
              <p className="mt-3 text-sm text-stone-400">閉上眼，再睜開時，天數回退，壓力也往前推進了一格。</p>
              <div className="mt-10 grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-center">
                <NightCountdownClock previousRemainingDays={nightTransitionInfo.previousRemainingDays} currentRemainingDays={nightTransitionInfo.remainingDays} animated={nightTransitionAnimated} />
                <NightPressureDeltaTrack before={nightTransitionInfo.pressureBefore} after={nightTransitionInfo.pressureAfter} animated={nightTransitionAnimated} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {!isGuideOverlayActive && merchantGuardAbilityWindow && merchantGuardAbilityWindow.actorSeat === data.viewerSeat ? (
        <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,26rem)] rounded-[28px] border border-amber-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">角色技能回應</p>
          <h3 className="mt-1 text-xl font-black text-stone-950">穩住陣腳</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">因 {merchantGuardAbilityWindow.loss.sourceLabelZh}，{merchantGuardAbilityWindow.loss.targetSeat} 即將失去 SR {merchantGuardAbilityWindow.loss.srLoss} / SP {merchantGuardAbilityWindow.loss.spLoss}。你可改由自己承受 1 點 SR，替對方擋下這次損失。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40" disabled={submitting} onClick={() => void runAction({ type: 'resolve_role_ability', actorSeat: data.viewerSeat ?? 'P1', abilityId: 'merchant_guard', mode: 'use' })}>由你承擔 1 SR</button>
            <button type="button" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700" disabled={submitting} onClick={() => void runAction({ type: 'resolve_role_ability', actorSeat: data.viewerSeat ?? 'P1', abilityId: 'merchant_guard', mode: 'skip' })}>略過</button>
          </div>
        </div>
      ) : null}
      {!isGuideOverlayActive && storytellerAbilityWindow && storytellerAbilityWindow.actorSeat === data.viewerSeat ? (
        <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,28rem)] rounded-[28px] border border-violet-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">角色技能回應</p>
          <h3 className="mt-1 text-xl font-black text-stone-950">協調分工</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">本輪已有至少 2 名玩家投入事件。你可令其中 1 名投入者回復 1 SP，或選擇略過。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {storytellerAbilityOptions.map((player) => (
              <button
                key={`storyteller-${player.seatId}`}
                type="button"
                title={`${player.seatId}｜${player.displayName}`}
                className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                disabled={submitting}
                onClick={() => void runAction({ type: 'resolve_role_ability', actorSeat: data.viewerSeat ?? 'P1', abilityId: 'square_storyteller', mode: 'use', targetSeat: player.seatId })}
              >
                {player.seatId}
              </button>
            ))}
            <button type="button" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700" disabled={submitting} onClick={() => void runAction({ type: 'resolve_role_ability', actorSeat: data.viewerSeat ?? 'P1', abilityId: 'square_storyteller', mode: 'skip' })}>略過</button>
          </div>
        </div>
      ) : null}
      {!isGuideOverlayActive && !blockingAbilityWindow && rangerAbilitySelectable ? (
        <div className="fixed bottom-4 right-4 z-30 w-[min(92vw,24rem)] rounded-[24px] border border-emerald-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">角色技能提醒</p>
          <h3 className="mt-1 text-lg font-black text-stone-950">越野突破</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">你正要移動到 {selectedMoveTile?.nameZh ?? '目標地格'}，本次移動觸及風險地格。是否發動〈越野突破〉，讓這次移動不消耗 AP？</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={["rounded-full px-4 py-2 text-sm font-medium", selectedRangerAbilityMode === 'use' ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-white text-emerald-800'].join(' ')} onClick={() => setSelectedRangerAbilityMode('use')}>發動</button>
            <button type="button" className={["rounded-full px-4 py-2 text-sm font-medium", selectedRangerAbilityMode === 'skip' ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white text-stone-700'].join(' ')} onClick={() => setSelectedRangerAbilityMode('skip')}>略過</button>
          </div>
        </div>
      ) : null}
      {!isGuideOverlayActive && !blockingAbilityWindow && medicAbilitySelectable ? (
        <div className="fixed bottom-4 right-4 z-30 w-[min(92vw,24rem)] rounded-[24px] border border-sky-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">角色技能提醒</p>
          <h3 className="mt-1 text-lg font-black text-stone-950">安定陪伴</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">你正要對 {selectedAdjacentHelpTarget?.seatId ?? '隊友'} 做 SP 相鄰互助。是否發動〈安定陪伴〉，讓對方再回復 1 SP？</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={["rounded-full px-4 py-2 text-sm font-medium", selectedMedicAbilityMode === 'use' ? 'bg-sky-600 text-white' : 'border border-sky-200 bg-white text-sky-800'].join(' ')} onClick={() => setSelectedMedicAbilityMode('use')}>發動</button>
            <button type="button" className={["rounded-full px-4 py-2 text-sm font-medium", selectedMedicAbilityMode === 'skip' ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white text-stone-700'].join(' ')} onClick={() => setSelectedMedicAbilityMode('skip')}>略過</button>
          </div>
        </div>
      ) : null}
      {!isGuideOverlayActive && !blockingAbilityWindow && messengerAbilitySelectable ? (
        <div className="fixed bottom-4 right-4 z-30 w-[min(92vw,28rem)] rounded-[24px] border border-violet-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">角色技能提醒</p>
          <h3 className="mt-1 text-lg font-black text-stone-950">牽起連結</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">你正要對 {selectedAdjacentHelpTarget?.seatId ?? '隊友'} 做相鄰互助。是否發動〈牽起連結〉，讓自己或隊友免費移動 1 格？</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={["rounded-full px-4 py-2 text-sm font-medium", selectedMessengerAbilityMode === 'use' ? 'bg-violet-600 text-white' : 'border border-violet-200 bg-white text-violet-800'].join(' ')} onClick={() => setSelectedMessengerAbilityMode('use')}>發動</button>
            <button type="button" className={["rounded-full px-4 py-2 text-sm font-medium", selectedMessengerAbilityMode === 'skip' ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white text-stone-700'].join(' ')} onClick={() => setSelectedMessengerAbilityMode('skip')}>略過</button>
          </div>
          {selectedMessengerAbilityMode === 'use' ? (
            <div className="mt-3 space-y-2 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
              <p className="text-xs font-semibold text-violet-700">請指定免費移動</p>
              <div className="flex flex-wrap gap-2">
                {selectedAdjacentHelpFollowChoices.map((choice) => {
                  const selected = selectedHelpFreeMoveSeat === choice.moveSeat && selectedHelpFreeMoveTileId === choice.moveToTileId;
                  return (
                    <button key={`follow-${choice.moveSeat}-${choice.moveToTileId}`} type="button" className={["rounded-full px-3 py-1.5 text-xs font-medium", selected ? 'bg-violet-600 text-white' : 'border border-violet-200 bg-white text-violet-800'].join(' ')} onClick={() => { setSelectedHelpFreeMoveSeat(choice.moveSeat); setSelectedHelpFreeMoveTileId(choice.moveToTileId); }}>{choice.labelZh}</button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {showGoalsModal ? (

        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-stone-950/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-2xl max-h-[82vh] overflow-hidden my-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">本局目標</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">這局要怎麼才算成功？</h2>
              </div>
              <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setShowGoalsModal(false)}>關閉</button>
            </div>
            <div className="mt-4 max-h-[62vh] overflow-y-auto pr-1 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <ul className="space-y-2 text-sm leading-7 text-emerald-950">
                {victoryConditionLinesZh.map((line, index) => (
                  <li key={`goal-line-${index}`} className="rounded-2xl bg-white px-3 py-2">• {renderKeyText(line, "rose")}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-6 text-emerald-800">目前進度：已完成 <span className="font-semibold text-rose-700">{completedTasks}/{data.snapshot.tasks.length}</span> 張任務，壓力 <span className="font-semibold text-rose-700">{data.snapshot.pressure}/10</span>。</p>
            </div>
          </div>
        </div>
      ) : null}
      {showWorldviewModal ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-stone-950/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-2xl max-h-[82vh] overflow-hidden my-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">世界觀</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">{worldViewTitleZh}</h2>
              </div>
              <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setShowWorldviewModal(false)}>關閉</button>
            </div>
            <div className="mt-4 max-h-[62vh] overflow-y-auto pr-1 rounded-3xl border border-violet-200 bg-violet-50 p-4 text-sm leading-7 text-violet-950">
              <p>{worldViewIntroZh}</p>
              <ul className="mt-3 space-y-2">
                {worldViewResourceLinesZh.map((line, index) => (
                  <li key={`worldview-modal-line-${index}`} className="rounded-2xl bg-white px-3 py-2">• {renderKeyText(line, "amber")}</li>
                ))}
              </ul>
              <p className="mt-3">你們需要在高壓與失序中保住彼此，優先處理事件、完成任務，並避免 SR / SP 崩盤。</p>
            </div>
          </div>
        </div>
      ) : null}
      {showEventRevealModal && data.snapshot.currentEvent ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/28 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl animate-[fadein_.18s_ease-out] rounded-[28px] border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">本輪事件揭示</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">{data.snapshot.currentEvent.nameZh}</h2>
              </div>
              <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setShowEventRevealModal(false)}>了解</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-semibold text-stone-900">事件描述</p>
                <p className="mt-2 text-sm leading-7 text-stone-700">{data.snapshot.currentEvent.rulesTextZh}</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <p className="font-semibold">解決條件</p>
                  <p className="mt-2"><span className="font-bold text-rose-700">SR {data.snapshot.currentEvent.requirement.srRequired}</span> / <span className="font-bold text-rose-700">SP {data.snapshot.currentEvent.requirement.spRequired}</span></p>
                </div>
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950">
                  <p className="font-semibold">未解懲罰</p>
                  <p className="mt-2">{renderKeyText(data.snapshot.currentEvent.unresolvedPenaltyTextZh, "rose")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {data.snapshot.phase !== "lobby" && criticalAlertZh ? (
        <div className="pointer-events-none fixed left-72 top-6 z-[45] max-w-[min(44rem,calc(100vw-27rem))] px-2 md:left-80 xl:left-[20rem]">
          <div className="text-left text-[20px] font-black leading-tight tracking-[0.03em] text-rose-600 drop-shadow-[0_4px_18px_rgba(244,63,94,0.34)] animate-[critical-alert-blink_0.95s_ease-in-out_infinite]">
            危急示警：{criticalAlertZh}
          </div>
        </div>
      ) : null}
      {!isGuideOverlayActive && data.snapshot.phase !== "lobby" && ((showCenterBroadcast && latestActionFeedback) || (showTurnToast && data.snapshot.activeSeat === data.viewerSeat && !showCenterBroadcast)) ? (
        <div className="pointer-events-none fixed inset-0 z-[44] flex items-center justify-center px-6">
          <div className="gh-center-broadcast w-full max-w-[812px] text-center animate-[center-broadcast-float_0.18s_ease-out]">
            <p className={`text-[11px] font-semibold tracking-[0.24em] ${showCenterBroadcast && latestActionFeedback ? centerBroadcastMetaToneClasses : "text-stone-500/95 drop-shadow-[0_2px_12px_rgba(15,23,42,0.12)]"}`}>
              中央廣播
            </p>
            <p className={`mt-3 text-[38px] font-black leading-[1.08] ${showCenterBroadcast && latestActionFeedback ? centerBroadcastBodyToneClasses : "text-stone-900 drop-shadow-[0_8px_28px_rgba(15,23,42,0.2)]"}`}>
              {centerBroadcastBodyZh}
            </p>
            <p className={`mt-3 text-[13px] font-semibold ${showCenterBroadcast && latestActionFeedback ? centerBroadcastMetaToneClasses : "text-stone-600/95 drop-shadow-[0_2px_10px_rgba(15,23,42,0.1)]"}`}>
              {centerBroadcastTitleZh}
            </p>
          </div>
        </div>
      ) : null}
      {data.snapshot.phase === "lobby" ? (
        <div className="fixed inset-0 z-30 bg-stone-950/18 backdrop-blur-[2px]">
          <div className="mx-auto flex h-full max-w-[1500px] items-start justify-center px-4 pb-6 pt-10 md:px-5 md:pt-8 xl:px-6">
            <div className="w-full max-w-[84rem] rounded-[30px] border border-stone-200 bg-white/98 p-5 shadow-2xl max-h-[86vh] overflow-hidden xl:max-w-[88rem]">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">大廳準備</p>
                  <h2 className="mt-1 text-2xl font-bold text-stone-950">先完成角色指派與 AI 補位</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">每位真人玩家都要有角色。</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-stone-900 px-3 py-1 text-[11px] font-semibold text-white">
                      房號 {data.room.roomCode}
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                      onClick={() => void copyLobbyRoomCode()}
                    >
                      複製房號
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                      onClick={() => void copyLobbyObserverLink()}
                    >
                      複製旁觀連結
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-stone-500">玩家用房號加入；旁觀者可直接用旁觀連結進入。</p>
                  {lobbyShareFeedbackZh ? (
                    <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                      {lobbyShareFeedbackZh}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${missingHumanRoleSeats.length === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {missingHumanRoleSeats.length === 0 ? "角色已就緒" : `待指派 ${missingHumanRoleSeats.length} 席`}
                  </span>
                  <button
                    className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!uiState.canStartGame || submitting}
                    title={uiState.canStartGame ? "開始整局流程" : startGameHintZh}
                    onClick={() => runAction({ type: "start_game", actorSeat: data.viewerSeat ?? "P1" })}
                  >
                    開始遊戲
                  </button>
                </div>
              </div>
              <div className="mt-4 grid max-h-[68vh] gap-5 overflow-y-auto pr-1 xl:grid-cols-[26rem_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col rounded-[24px] border border-stone-200 bg-white p-4 shadow-2xl">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">角色介紹</p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">先看技能與起始值。</p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] text-stone-600">共 {roleCatalogEntries.length} 名</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
                    <span>已選角色會變灰。</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-stone-600">不可重複選擇</span>
                  </div>
                  <div className="mt-3 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1">
                    {roleCatalogEntries.map((role) => (
                      <div
                        key={`lobby-role-catalog-${role.roleId}`}
                        className={[
                          "rounded-2xl border px-3 py-2 transition",
                          role.isTaken
                            ? "border-stone-200 bg-stone-200/75 text-stone-500 opacity-75"
                            : "border-violet-200 bg-violet-50/70 text-stone-800",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-stone-950">{role.roleNameZh}</p>
                            <p className="mt-1 text-[11px] font-medium text-violet-700">{role.abilityNameZh}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${role.isTaken ? "bg-stone-300 text-stone-700" : "bg-white text-violet-700"}`}>
                            {role.statusZh}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-[1.4] text-stone-700">{role.abilitySummaryZh}</p>
                        <p className="mt-1 text-[11px] leading-4 text-stone-500">起始 SR {role.startingSr} / SP {role.startingSp}</p>
                      </div>
                    ))}
                  </div>
                </aside>

                <section className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-2xl">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">席位與角色指派</p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">先看誰是 AI，再替各席位選角色。</p>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">真人席位都要有角色</span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-stone-900">角色指派</p>
                          <p className="mt-1 text-xs leading-5 text-stone-600">已選角色不能重複指派。</p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-stone-600">{participantPlayers.length} 席位</span>
                      </div>
                      <div className="mt-3 grid gap-3">
                        {participantPlayers.map((player) => {
                          const currentRoleId = selectedRoleBySeat[player.seatId] ?? player.roleId ?? ROLE_OPTIONS[0]?.roleId ?? "";
                          return (
                            <div key={`overlay-role-${player.seatId}`} className="rounded-2xl border border-stone-200 bg-white p-3">
                              <div className="flex flex-col gap-3">
                                <div className="min-w-0 rounded-[16px] border border-stone-200 bg-stone-50/70 px-3 py-2.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-lg font-semibold leading-none text-stone-950">{player.seatId}｜{player.displayName}</p>
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${player.isAi ? "bg-violet-100 text-violet-700" : "border border-stone-200 bg-white text-stone-600"}`}>
                                      {player.isAi ? "AI 補位" : "真人玩家"}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium leading-tight text-stone-800">{player.roleNameZh ?? (player.isAi ? "AI 會在開局時自動補齊角色" : "尚未指派角色")}</p>
                                  {data.viewerRole === "host" && player.seatId !== "P1" ? (
                                    <div className="mt-1.5 flex flex-wrap gap-2">
                                      <button
                                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${player.isAi ? "border border-stone-300 bg-white text-stone-700" : "bg-violet-100 text-violet-700"}`}
                                        disabled={submitting || !data.viewerSeat}
                                        onClick={() => {
                                          const current = new Set(data.snapshot.roomConfig.aiSeatIds);
                                          if (player.isAi) current.delete(player.seatId); else current.add(player.seatId);
                                          void updateRoomConfigPatch({ aiSeatIds: Array.from(current).sort() as SeatId[] });
                                        }}
                                      >
                                        {player.isAi ? "改回玩家" : "設為 AI"}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex flex-col gap-2 rounded-[18px] border border-stone-200 bg-white px-3 py-3 sm:flex-row sm:items-center">
                                  <select
                                    className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 disabled:opacity-60"
                                    value={currentRoleId}
                                    disabled={data.viewerRole !== "host"}
                                    onChange={(event) => setSelectedRoleBySeat((current) => ({ ...current, [player.seatId]: event.target.value }))}
                                  >
                                    {ROLE_OPTIONS.map((role) => {
                                      const selectedSeats = lobbyRoleSeatMap.get(role.roleId) ?? [];
                                      const takenByOtherSeat = selectedSeats.some((seatId) => seatId !== player.seatId);
                                      return (
                                        <option key={role.roleId} value={role.roleId} disabled={takenByOtherSeat}>
                                          {role.roleNameZh}{takenByOtherSeat ? `（已由 ${selectedSeats.join("、")} 選）` : ""}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {data.viewerRole === "host" ? (
                                    <button
                                      className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                                      disabled={!uiState.canAssignRole || submitting || !data.viewerSeat}
                                      onClick={() => runAction({
                                        type: "assign_role",
                                        actorSeat: data.viewerSeat ?? "P1",
                                        targetSeat: player.seatId,
                                        roleId: currentRoleId || "merchant_guard",
                                      })}
                                    >
                                      指派
                                    </button>
                                  ) : (
                                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">等待房主</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <aside className="space-y-4 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                        <div className="rounded-2xl border border-stone-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-stone-900">AI 補位</p>
                              <p className="mt-1 text-xs leading-5 text-stone-600">可一鍵補滿，也可逐席切換。</p>
                            </div>
                          {data.viewerRole === "host" ? (
                            <div className="flex flex-wrap gap-2">
                              <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50" disabled={submitting || !data.viewerSeat} onClick={() => void updateRoomConfigPatch({ aiSeatIds: ["P2", "P3", "P4"] })}>一鍵 AI 補位</button>
                              <button className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50" disabled={submitting || !data.viewerSeat} onClick={() => void updateRoomConfigPatch({ aiSeatIds: [] })}>清空 AI 補位</button>
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(["P2", "P3", "P4"] as SeatId[]).map((seatId) => {
                            const enabled = data.snapshot.roomConfig.aiSeatIds.includes(seatId);
                            return (
                              <button
                                key={`overlay-ai-${seatId}`}
                                className={`rounded-xl px-3 py-2 text-sm font-medium ${enabled ? "bg-stone-900 text-white" : "border border-stone-300 bg-white text-stone-700"}`}
                                disabled={submitting || !data.viewerSeat || data.viewerRole !== "host"}
                                onClick={() => {
                                  const current = new Set(data.snapshot.roomConfig.aiSeatIds);
                                  if (current.has(seatId)) current.delete(seatId); else current.add(seatId);
                                  void updateRoomConfigPatch({ aiSeatIds: Array.from(current).sort() as SeatId[] });
                                }}
                              >
                                {seatId} {enabled ? "改回玩家" : "加入 AI"}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className={`rounded-2xl border p-4 text-sm leading-7 ${missingHumanRoleSeats.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                        <p className="font-semibold">開始前檢查</p>
                        <p className="mt-2">{startGameHintZh}</p>
                      </div>

                    </aside>
                  </div>
                </section>
              </div>
              </div>
            </div>
          </div>
      ) : null}
      <div className="mx-auto mt-4 max-w-[1500px] space-y-4">
        <div className="space-y-4 xl:hidden">
        <div className="px-1">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left shadow-sm" onClick={() => setShowMobileTasksDrawer(true)}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">任務</p>
              <p className="mt-1 text-sm font-semibold text-stone-950">{selectedTask?.nameZh ?? "查看任務"}</p>
              <p className="mt-1 text-[11px] text-stone-600">{selectedTaskSurfaceStatus?.badgeZh ?? "未選擇"}</p>
            </button>
            <button type="button" className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left shadow-sm" onClick={() => setShowMobileHandDrawer(true)}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">手牌</p>
              <p className="mt-1 text-sm font-semibold text-stone-950">{viewerPlayerState?.handCardIds.length ?? 0} / 3</p>
              <p className="mt-1 text-[11px] text-stone-600">點一下查看</p>
            </button>
            <button type="button" className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left shadow-sm" onClick={() => setShowMobileActionFeedDrawer(true)}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">最近動作</p>
              <p className="mt-1 text-sm font-semibold text-stone-950">{recentActionFeed.length} 筆</p>
              <p className="mt-1 text-[11px] text-stone-600">查看紀錄</p>
            </button>
          </div>
        </div>
        <section className="rounded-[28px] border border-stone-200 bg-white p-3 shadow-sm">
          <div className={`mb-2.5 rounded-[24px] border border-stone-200 bg-stone-50 px-3 py-2 ${pulseTaskRail ? "animate-pulse" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">任務列</p>
                <h3 className="mt-0.5 text-[14px] font-bold text-stone-950">本局目標</h3>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-medium text-stone-700">已完成 <span className="font-bold text-rose-700">{completedTasks}</span> / {totalTasks}</span>
            </div>
            <div className="mt-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              <div className="flex min-w-max gap-2 pr-1 xl:min-w-0">
                {taskSurfaceEntries.map(({ task, status }) => {
                  const taskHintZh = status.reasonsZh[0] ?? status.summaryZh;
                  return (
                    <div
                      key={`top-task-wrap-${task.taskId}`}
                      className="w-[196px] min-w-[196px] sm:w-[204px] sm:min-w-[204px] xl:w-[calc((100%-2rem)/5)] xl:min-w-[calc((100%-2rem)/5)]"
                    >
                      <TaskRibbonCard
                        key={`top-task-${task.taskId}`}
                        title={task.nameZh}
                        subtitle={task.completionHintZh}
                        reward={task.rewardTextZh}
                        isDone={task.completionCheckedByHost}
                        isSelected={selectedTaskId === task.taskId}
                        hint={taskHintZh}
                        actionSlot={
                          <button
                            type="button"
                            title={taskHintZh}
                            className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!status.canDeclare || submitting || !data.viewerSeat || data.viewerRole === "observer"}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedTaskId(task.taskId);
                              void runAction({ type: "declare_task", actorSeat: data.viewerSeat ?? "P1", taskId: task.taskId });
                            }}
                          >
                            {status.key === "completed" ? "已完成" : status.key === "declared" ? "已宣告" : status.canDeclare ? "宣告完成" : status.badgeZh}
                          </button>
                        }
                        onClick={() => setSelectedTaskId(task.taskId)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[188px_minmax(0,1fr)_292px] xl:items-start">
            <aside className="space-y-2 rounded-[24px] border border-stone-200/80 bg-stone-50/92 p-2">
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">隊伍</p>
                  <h3 className="mt-0.5 text-[13px] font-bold text-stone-950">玩家狀態</h3>
                </div>
                <HoverInfo label={<span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-700">壓力 {data.snapshot.pressure}</span>} content={`壓力 3：事件需至少 2 名玩家投入。
壓力 6：若本輪無 0AP 相鄰互助，不能宣告任務。
壓力 10：遊戲失敗。`} />
              </div>
              {participantPlayers.map((player) => (
                <PlayerRosterCard
                  key={`surface-top-${player.seatId}`}
                  seat={player.seatId}
                  name={player.displayName}
                  roleName={player.roleNameZh ?? "未指派角色"}
                  sr={player.currentSr}
                  sp={player.currentSp}
                  ap={player.remainingAp}
                  companionUsed={player.companionTokensRemaining <= 0}
                  isActive={player.seatId === data.snapshot.activeSeat}
                  isViewer={player.seatId === data.viewerSeat}
                  isAi={player.isAi}
                  positionTileId={player.positionTileId}
                  roleAbilitySummary={getRoleLoadout(player.roleId)?.abilitySummaryZh}
                />
              ))}
            </aside>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-stone-200 bg-stone-50 px-3 py-2 text-[10.5px] text-stone-600">
                <span className="rounded-full bg-white px-2.5 py-1">位置：{currentTile?.nameZh ?? (isLobbyMapPreview ? "中央大道預覽" : viewerPlayerState?.positionTileId ?? "—")}</span>
                <span className="rounded-full bg-white px-2.5 py-1">輪到：{data.snapshot.activeSeat ?? "—"}</span>
                <span className="rounded-full bg-white px-2.5 py-1">可移動 {legalMoveTileIds.size} 格</span>
              </div>
              <div className="rounded-[28px] border border-stone-200 bg-white p-2 shadow-sm">
                <GuardianHeartMapStage
                  mapTiles={displayMapTiles}
                  players={data.snapshot.players}
                  viewerSeat={data.viewerSeat}
                  activeSeat={data.snapshot.activeSeat}
                  legalMoveTileIds={legalMoveTileIds}
                  selectedMoveTileId={selectedMoveTileId}
                  selectedTileId={selectedMapTile?.tileId ?? ""}
                  actionDisabledReasonZh={actionDisabledReasonZh}
                  adjacentHelpOptions={adjacentHelpOptions}
                  canUseAdjacentHelp={canUseAdjacentHelpFromMap}
                  canUseMessengerAbility={canUseMessengerAbility}
                  canUseMedicBonusHint={canUseMedicBonusHint}
                  latestActionFeedbackZh={mapActionFeedbackZh}
                  pressureTaskUnlockStatusZh={pressureTaskUnlockStatusZh}
                  roleAbilityHintsZh={roleAbilityHintsZh}
                  onAdjacentHelp={runAdjacentHelpFromMap}
                  onSelectTile={setSelectedMapTileId}
                  onSelectMoveTile={setSelectedMoveTileId}
                  onMoveHere={runMoveFromMap}
                  onUseCurrentTile={runUseCurrentTileFromMap}
                  interactionEnabled={data.viewerRole !== "observer"}
                />
              </div>
            </div>

            <aside className="space-y-2 rounded-[24px] border border-stone-200/80 bg-stone-50/92 p-2">
              {selectedTask && selectedTaskSurfaceStatus ? (
                <div className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">任務詳情</p>
                      <h3 className="mt-1 text-sm font-bold text-stone-950">{selectedTask.nameZh}</h3>
                    </div>
                    <span className={["rounded-full px-2.5 py-1 text-[10px] font-medium", selectedTaskSurfaceStatus.tone === "emerald" ? "bg-emerald-100 text-emerald-800" : selectedTaskSurfaceStatus.tone === "amber" ? "bg-amber-100 text-amber-800" : selectedTaskSurfaceStatus.tone === "sky" ? "bg-sky-100 text-sky-800" : "bg-stone-100 text-stone-700"].join(" ")}>{selectedTaskSurfaceStatus.badgeZh}</span>
                  </div>
                  <div className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] leading-5 text-emerald-900">{selectedTaskSurfaceStatus.summaryZh}</div>
                  <div className="mt-2 space-y-1 text-[11px] leading-5 text-stone-700">
                    <p><span className="font-semibold text-stone-900">條件：</span>{selectedTask.completionHintZh}</p>
                    <p><span className="font-semibold text-stone-900">獎勵：</span>{selectedTask.rewardTextZh}</p>
                  </div>
                  {selectedTaskDetailLinesZh.length > 0 ? (
                    <div className="mt-2 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">{selectedTaskSurfaceStatus.canDeclare ? "目前進度" : "目前差什麼"}</p>
                      <ul className="mt-1 space-y-1 text-[11px] leading-5 text-stone-700">
                        {selectedTaskDetailLinesZh.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {!selectedTaskSurfaceStatus.canDeclare ? (
                    <div className="mt-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">目前不可宣告</p>
                      <p className="mt-1 text-[11px] leading-5 text-stone-600">{selectedTaskSurfaceStatus.reasonsZh[0] ?? selectedTaskSurfaceStatus.summaryZh}</p>
                    </div>
                  ) : selectedTaskNoteLinesZh.length > 0 ? (
                    <div className="mt-2 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">補充</p>
                      <ul className="mt-1 space-y-1 text-[11px] leading-5 text-stone-700">
                        {selectedTaskNoteLinesZh.map((reason) => <li key={reason}>• {reason}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  <button type="button" className="mt-3 w-full rounded-2xl bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-40" disabled={!selectedTaskSurfaceStatus.canDeclare || submitting || !data.viewerSeat || data.viewerRole === "observer"} onClick={() => void runAction({ type: "declare_task", actorSeat: data.viewerSeat ?? "P1", taskId: selectedTask.taskId })}>
                    {selectedTaskSurfaceStatus.canDeclare ? "宣告任務" : "目前不可宣告"}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-3 py-4 text-[11px] leading-5 text-stone-600 shadow-sm">
                  <p className="font-semibold text-stone-900">任務詳情</p>
                  <p className="mt-1">選上方任務，看條件與宣告。</p>
                </div>
              )}

              <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">手牌</p>
                    <h3 className="mt-0.5 text-[13px] font-bold text-stone-950">行動卡</h3>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-700">{viewerPlayerState?.handCardIds.length ?? 0} / 3</span>
                </div>
                <div className="mt-2 space-y-2">
                  {(viewerPlayerState?.handCardIds.length ?? 0) > 0 ? (
                    viewerPlayerState?.handCardIds.map((cardId, index) => {
                      const card = ACTION_CARD_DEFINITION_MAP[cardId];
                      const instanceKey = buildHandCardInstanceKey(cardId, index);
                      return (
                        <HandPreviewCard
                          key={`top-hand-${cardId}-${index}`}
                          title={card?.nameZh ?? cardId}
                          category={card?.category ?? "support"}
                          description={card?.rulesTextZh ?? "尚未載入牌面文字"}
                          note={card?.noteZh ?? ""}
                          selected={selectedActionCardInstanceKey === instanceKey}
                          onClick={() => toggleSelectedActionCard(cardId, instanceKey)}
                        />
                      );
                    })
                  ) : (
                    <div className="rounded-2xl bg-stone-50 px-3 py-4 text-[11px] text-stone-600">目前沒有手牌。</div>
                  )}
                  {currentCardDefinition ? (
                    <div className="rounded-2xl border border-stone-200 bg-white p-3 text-[11px] text-stone-700 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-stone-900">{currentCardDefinition.nameZh}</p>
                          <p className="mt-1 leading-5 text-stone-600">{currentCardDefinition.rulesTextZh}</p>
                        </div>
                        <button type="button" className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[10px] text-stone-600 hover:bg-stone-50" onClick={clearSelectedActionCard}>取消</button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="rounded-full bg-stone-900 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40" disabled={Boolean(selectedCardUseDisabledReasonZh) || submitting || !data.viewerSeat || !selectedActionCardId} onClick={() => runAction(buildPlayActionCardPayload({ actorSeat: data.viewerSeat ?? "P1", cardId: selectedActionCardId, targetSeat: ["card_pull_you_a_bit", "card_same_tile_care", "card_hold_together", "card_respond_together"].includes(selectedActionCardId) ? selectedCardTargetSeat || undefined : undefined, toTileId: ["card_pull_you_a_bit", "card_dash_to_goal"].includes(selectedActionCardId) ? selectedCardTileId || undefined : undefined, resourceType: ["card_same_tile_care", "card_focus_the_point", "card_respond_together"].includes(selectedActionCardId) ? selectedCardResourceType : undefined, teammateResourceType: selectedActionCardId === "card_respond_together" ? selectedCardTeammateResourceType : undefined }))}>使用這張牌</button>
                        <span className="rounded-full bg-stone-100 px-3 py-1.5 text-[9.5px] text-stone-600">需指定隊友／地格時，下方進階區仍可細調。</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-200 bg-white/75 px-3 py-2.5 text-[10.5px] leading-5 text-stone-500">
                      先點一張牌，再在這裡快速確認效果與是否直接使用。
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="rounded-[22px] border border-stone-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">最近動作</p>
                  <h3 className="mt-0.5 text-[13px] font-bold text-stone-950">多人局輕量 log</h3>
                </div>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-600">保留最近 {recentActionFeed.length}</span>
              </div>
              {recentActionFeed.length > 0 ? (
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {recentActionFeed.map((feedback) => (
                    <div key={`${feedback.occurredAt}-${feedback.titleZh}`} className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-stone-900">{feedback.titleZh}</p>
                      <p className={feedback.tone === "success" ? "mt-0.5 text-[11px] text-emerald-700" : "mt-0.5 text-[11px] text-rose-700"}>{feedback.text}</p>
                      {feedback.detailsZh[0] ? <p className="mt-1 text-[10px] leading-5 text-stone-600">{feedback.detailsZh[0]}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-2xl bg-stone-50 px-3 py-3 text-[11px] leading-5 text-stone-600">暫無新回饋。</p>
              )}
            </div>

            <div className="rounded-[22px] border border-stone-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">流程 / 能力</p>
                  <h3 className="mt-0.5 text-[13px] font-bold text-stone-950">目前重點</h3>
                </div>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-700">{phaseLabel(data.snapshot.phase)}</span>
              </div>
              <div className="mt-2 space-y-2 text-[11px] leading-5 text-stone-700">
                <div className="rounded-2xl bg-stone-50 px-3 py-2.5">{uiState.phaseSummaryZh}</div>
                <div className="rounded-2xl bg-stone-50 px-3 py-2.5">{pressureTaskUnlockStatusZh}</div>
                {roleAbilityHintsZh.length > 0 ? (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-950">
                    {roleAbilityHintsZh.slice(0, 2).map((hint) => <p key={hint} className="mt-1 first:mt-0">• {hint}</p>)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <MobileBottomDrawer open={showMobileTasksDrawer} title="任務狀態與宣告" onClose={() => setShowMobileTasksDrawer(false)}>
          <div className="space-y-3">
            {selectedTask && selectedTaskSurfaceStatus ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">目前選擇任務</p>
                    <h3 className="mt-1 text-lg font-bold text-stone-950">{selectedTask.nameZh}</h3>
                  </div>
                  <span className={["rounded-full px-3 py-1 text-xs font-medium", selectedTaskSurfaceStatus.tone === "emerald" ? "bg-emerald-100 text-emerald-800" : selectedTaskSurfaceStatus.tone === "amber" ? "bg-amber-100 text-amber-800" : selectedTaskSurfaceStatus.tone === "sky" ? "bg-sky-100 text-sky-800" : "bg-stone-100 text-stone-700"].join(" ")}>{selectedTaskSurfaceStatus.badgeZh}</span>
                </div>
                <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-stone-800">{selectedTaskSurfaceStatus.summaryZh}</div>
                <div className="mt-3 space-y-1 text-sm leading-6 text-stone-700">
                  <p><span className="font-semibold text-stone-900">條件：</span>{selectedTask.completionHintZh}</p>
                  <p><span className="font-semibold text-stone-900">獎勵：</span>{selectedTask.rewardTextZh}</p>
                </div>
                {selectedTaskDetailLinesZh.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
                    {selectedTaskDetailLinesZh.slice(0, 4).map((reason) => <li key={reason} className="rounded-2xl bg-white px-3 py-2">{reason}</li>)}
                  </ul>
                ) : null}
                {!selectedTaskSurfaceStatus.canDeclare ? (
                  <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-stone-700">
                    <p className="font-semibold text-stone-900">目前不可宣告</p>
                    <p className="mt-1">{selectedTaskSurfaceStatus.reasonsZh[0] ?? selectedTaskSurfaceStatus.summaryZh}</p>
                  </div>
                ) : selectedTaskNoteLinesZh.length > 0 ? (
                  <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-stone-700">
                    <p className="font-semibold text-stone-900">補充</p>
                    <ul className="mt-1 space-y-1">
                      {selectedTaskNoteLinesZh.map((reason) => <li key={reason}>• {reason}</li>)}
                    </ul>
                  </div>
                ) : null}
                <button type="button" className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-40" disabled={!selectedTaskSurfaceStatus.canDeclare || submitting || !data.viewerSeat || data.viewerRole === "observer"} onClick={() => void runAction({ type: "declare_task", actorSeat: data.viewerSeat ?? "P1", taskId: selectedTask.taskId })}>
                  {selectedTaskSurfaceStatus.canDeclare ? "宣告任務" : "目前不可宣告"}
                </button>
              </div>
            ) : null}
            <div className="space-y-2">
              {taskSurfaceEntries.map(({ task, status }) => (
                <button key={`mobile-task-${task.taskId}`} type="button" onClick={() => setSelectedTaskId(task.taskId)} className={["w-full rounded-2xl border px-3 py-3 text-left", selectedTaskId === task.taskId ? "border-stone-900 bg-stone-50" : "border-stone-200 bg-white"].join(" ")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-950">{task.nameZh}</p>
                    <span className={["rounded-full px-2.5 py-1 text-[10px] font-medium", status.tone === "emerald" ? "bg-emerald-100 text-emerald-800" : status.tone === "amber" ? "bg-amber-100 text-amber-800" : status.tone === "sky" ? "bg-sky-100 text-sky-800" : "bg-stone-100 text-stone-700"].join(" ")}>{status.badgeZh}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-stone-700">{task.completionHintZh}</p>
                  <p className="mt-1 text-[11px] leading-5 text-stone-500">{status.summaryZh}</p>
                </button>
              ))}
            </div>
          </div>
        </MobileBottomDrawer>

        <MobileBottomDrawer open={showMobileHandDrawer} title="手牌抽屜" onClose={() => setShowMobileHandDrawer(false)}>
          <div className="space-y-3">
            {(viewerPlayerState?.handCardIds.length ?? 0) > 0 ? viewerPlayerState?.handCardIds.map((cardId, index) => {
              const card = ACTION_CARD_DEFINITION_MAP[cardId];
              const instanceKey = buildHandCardInstanceKey(cardId, index);
              return (
                <div key={`mobile-hand-${cardId}-${index}`} className="rounded-2xl border border-stone-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">{card?.nameZh ?? cardId}</p>
                      <p className="mt-1 text-xs leading-5 text-stone-600">{card?.rulesTextZh ?? "尚未載入牌面文字"}</p>
                    </div>
                    <button type="button" className={["rounded-full px-3 py-1 text-xs font-medium", selectedActionCardInstanceKey === instanceKey ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"].join(" ")} onClick={() => toggleSelectedActionCard(cardId, instanceKey)}>
                      {selectedActionCardInstanceKey === instanceKey ? "已選" : "選這張"}
                    </button>
                  </div>
                </div>
              );
            }) : <p className="rounded-2xl bg-stone-50 px-3 py-4 text-sm text-stone-600">沒有手牌。</p>}
          </div>
        </MobileBottomDrawer>

        <MobileBottomDrawer open={showMobileActionFeedDrawer} title="最近動作" onClose={() => setShowMobileActionFeedDrawer(false)}>
          <div className="space-y-2">
            {recentActionFeed.length > 0 ? recentActionFeed.map((feedback) => (
              <div key={`mobile-feed-${feedback.occurredAt}-${feedback.titleZh}`} className="rounded-2xl border border-stone-200 bg-white px-3 py-3">
                <p className="text-sm font-semibold text-stone-950">{feedback.titleZh}</p>
                <p className={feedback.tone === "success" ? "mt-1 text-sm text-emerald-700" : "mt-1 text-sm text-rose-700"}>{feedback.text}</p>
                {feedback.detailsZh.length > 0 ? <ul className="mt-2 space-y-1 text-xs leading-5 text-stone-600">{feedback.detailsZh.slice(0, 3).map((detail) => <li key={detail}>• {detail}</li>)}</ul> : null}
              </div>
            )) : <p className="rounded-2xl bg-stone-50 px-3 py-4 text-sm text-stone-600">暫無新回饋。</p>}
          </div>
        </MobileBottomDrawer>
        </div>

        <div className="hidden xl:block">
          <DesktopSinglePageSurface
            roomCode={data.room.roomCode}
            viewerRoleZh={data.viewerRole === "observer" ? "觀察者模式" : `${data.displayName}｜${uiState.roomRoleLabelZh}${data.viewerSeat ? `｜${data.viewerSeat}` : ""}`}
            eventTitleZh={latestEventNameZh}
            eventRequirementZh={data.snapshot.currentEvent ? `SR ${data.snapshot.currentEvent.requirement.srRequired} / SP ${data.snapshot.currentEvent.requirement.spRequired}` : "等待下一輪事件"}
            eventRemainingZh={eventProgress ? `SR ${eventProgress.remainingSr} / SP ${eventProgress.remainingSp}` : "—"}
            eventPenaltyZh={data.snapshot.currentEvent?.unresolvedPenaltyTextZh ?? "目前沒有未解懲罰"}
            eventMetaPills={[]}
            eventChannelSections={buildEventCardChannels(data.snapshot)}
            roundValueZh={headerRoundValueZh}
            pressureValue={data.snapshot.pressure}
            remainingDaysZh={data.snapshot.phase !== "lobby" ? `剩餘 ${remainingDays} 天` : null}
            pulseTaskRail={pulseTaskRail}
            completedTasks={completedTasks}
            totalTasks={totalTasks}
            tasks={desktopTaskRailItems}
            roster={desktopRosterItems}
            handCards={desktopHandItems}
            selectedCardPanel={desktopSelectedCardPanel}
            selectedTaskPanel={desktopSelectedTaskPanel}
            roleAbilityPanel={desktopRoleAbilityPanel}
            abilityStatuses={desktopAbilityStatuses}
            mapStage={desktopMapStage}
            recentActionFeed={recentActionFeed}
            phaseLabelZh={phaseLabel(data.snapshot.phase)}
            phaseSummaryZh={uiState.phaseSummaryZh}
            focusSummaryZh={uiState.blockingWindowSummaryZh ?? uiState.viewerStatusHintZh}
            canQuickInvest={canViewerQuickInvest}
            investSr={investSr}
            investSp={investSp}
            onChangeInvestSr={setInvestSr}
            onChangeInvestSp={setInvestSp}
            onSelectInvestConversion={setSelectedInvestConversion}
            investConversionOptions={investConversionOptions}
            onInvest={() => {
              if (!data.viewerSeat) return;
              void runAction({ type: "invest_event", actorSeat: data.viewerSeat, srPaid: investSr, spPaid: investSp, convertOne: selectedInvestConversion || undefined });
            }}
            investDisabled={submitting || !data.viewerSeat || !eventProgress}
            investedContributorCount={eventProgress?.distinctContributorCount ?? 0}
            investedContributorNamesZh={eventProgress?.contributorNamesZh ?? []}
            onSelectTask={(taskId) => setSelectedTaskId((current) => current === taskId ? "" : taskId)}
            onDeclareTask={(taskId) => void runAction({ type: "declare_task", actorSeat: data.viewerSeat ?? "P1", taskId })}
            onSelectCard={toggleSelectedActionCard}
            onSelectCardTarget={(seat) => setSelectedCardTargetSeat(seat as SeatId)}
            onSelectCardTile={setSelectedCardTileId}
            onSelectCardResource={setSelectedCardResourceType}
            onSelectCardTeammateResource={setSelectedCardTeammateResourceType}
            onCancelSelectedCard={clearSelectedActionCard}
            onUseSelectedCard={() => {
              if (!data.viewerSeat || !selectedActionCardId) return;
              void runAction(buildPlayActionCardPayload({
                actorSeat: data.viewerSeat,
                cardId: selectedActionCardId,
                targetSeat: ["card_pull_you_a_bit", "card_same_tile_care", "card_hold_together", "card_respond_together"].includes(selectedActionCardId) ? selectedCardTargetSeat || undefined : undefined,
                toTileId: ["card_pull_you_a_bit", "card_dash_to_goal"].includes(selectedActionCardId) ? selectedCardTileId || undefined : undefined,
                resourceType: ["card_same_tile_care", "card_focus_the_point", "card_respond_together"].includes(selectedActionCardId) ? selectedCardResourceType : undefined,
                teammateResourceType: selectedActionCardId === "card_respond_together" ? selectedCardTeammateResourceType : undefined,
              }));
            }}
          />
        </div>

      <details className="mx-auto mt-4 max-w-7xl rounded-[28px] border border-stone-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-stone-800">
          進階操作
        </summary>
        <div className="border-t border-stone-200 px-4 py-4">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="space-y-4">
              <Panel title="進階資訊" accent="amber">
                <div className="space-y-3 text-sm leading-7 text-stone-700">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">階段摘要</p>
                    <p className="mt-1 font-medium text-stone-900">{uiState.phaseSummaryZh}</p>
                    <p className="mt-1 text-stone-600">{uiState.viewerStatusHintZh}</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">阻塞與同步</p>
                    <p className="mt-1">{uiState.blockingWindowSummaryZh ?? "目前沒有阻塞。"}</p>
                    <p className="mt-1 text-stone-500">資料表同步狀態：{persistedLogStatusZh}</p>
                  </div>
                  {data.viewerRole === "host" ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">房主備註</p>
                      <p className="mt-1">主畫面優先。</p>
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel title="模擬入口" accent="sky">
                <div className="space-y-3 text-sm text-stone-700">
                  <p>到模擬頁比較牌池與上限。</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedSimulationLinks.map((link) => (
                      <Link key={link.href} href={link.href} className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-medium text-sky-900">{link.labelZh}</Link>
                    ))}
                  </div>
                </div>
              </Panel>
            </section>

            <section className="space-y-4">
              <Panel title="回合紀錄" accent="rose">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm leading-7 text-stone-600">房間頁只顯示最近 8 筆。</p>
                  <div className="flex gap-2">
                    {shouldShowLogToggle ? (
                      <button
                        className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                        onClick={() => setShowFullLog((current) => !current)}
                      >
                        {showFullLog ? "收合回最近 8 筆" : `顯示全部 ${data.snapshot.actionLog.length} 筆`}
                      </button>
                    ) : null}
                    <Link href={`/rooms/${roomCode}/logs?joinToken=${encodeURIComponent(data.joinToken)}&displayName=${encodeURIComponent(data.displayName)}`} className="rounded-xl bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-800">完整紀錄頁</Link>
                  </div>
                </div>
                <div className="mb-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <p className="font-semibold">顯示範圍</p>
                    <p className="mt-1">{showFullLog ? `目前顯示全部 ${data.snapshot.actionLog.length} 筆。` : `目前顯示最近 ${recentActionLogEntries.length} 筆。`}</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                    <p className="font-semibold text-stone-900">最新時間</p>
                    <p className="mt-1">{data.snapshot.actionLog[0]?.timestamp ?? "暫無正式紀錄"}</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                    <p className="font-semibold text-stone-900">同步狀態</p>
                    <p className="mt-1">{persistedLogStatusZh}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {data.snapshot.actionLog.length === 0 ? <p className="text-stone-500">暫無正式紀錄。</p> : recentActionLogEntries.map((entry, index) => (
                    <details key={`${entry.timestamp}-${entry.actionType}-${entry.actorSeat}`} className="rounded-2xl bg-stone-50 p-3" open={index === 0 && !showFullLog}>
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-stone-900">{entry.resultSummaryZh}</p>
                            <p className="mt-1 text-xs text-stone-500">{entry.timestamp}</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-stone-600">{entry.actorLabelZh}</span>
                        </div>
                        <p className="mt-2 text-xs text-stone-600">{entry.payloadSummaryZh}</p>
                      </summary>
                      <div className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-xs text-stone-600">
                        <p>動作：{entry.actionType}</p>
                        <p>前：{entry.statusBefore.phase} / R{entry.statusBefore.round} / 壓力 {entry.statusBefore.pressure}</p>
                        <p>後：{entry.statusAfter.phase} / R{entry.statusAfter.round} / 壓力 {entry.statusAfter.pressure}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </Panel>
            </section>
          </div>
        </div>
      </details>
      </div>

      {showSettlement && (data.snapshot.phase === "gameover" || data.snapshot.status === "finished") && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
              <div>
                <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${settlementOutcome.tone === "emerald" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>本局結算</p>
                <h2 className="mt-2 text-3xl font-bold text-stone-950">{settlementTitleZh}</h2>
                <p className="mt-2 text-base font-medium text-stone-900">{settlementOutcome.verdictZh}</p>
                <p className="mt-3 text-sm leading-7 text-stone-600">{settlementReasonZh}</p>
              </div>
              <button className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50" onClick={() => setShowSettlement(false)}>回房間</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 md:grid-cols-5">
                <InfoCard label="最終回合" value={`第 ${data.snapshot.round} 輪`} />
                <InfoCard label="最終壓力" value={String(data.snapshot.pressure)} />
                <InfoCard label="完成任務" value={`${completedTasks}/${totalTasks}`} />
                <InfoCard label="最後事件" value={latestEventNameZh} />
                <InfoCard label="本輪互助" value={teamAdjacentHelpDoneThisRound ? "有" : "無"} />
              </div>
              <div className="mt-6 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-3">
                  <div className={`rounded-2xl border p-4 ${settlementOutcome.tone === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                    <p className="text-[13px] font-semibold leading-5 text-stone-950">摘要</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-800">
                      {settlementOutcome.srZeroSeats.length > 0 ? <li>SR 歸零席位：{settlementOutcome.srZeroSeats.join("、")}</li> : null}
                      {settlementOutcome.spZeroSeats.length > 0 ? <li>SP 歸零席位：{settlementOutcome.spZeroSeats.join("、")}</li> : null}
                      {settlementOutcome.weakestPlayer ? <li>收尾時最脆弱席位：{settlementOutcome.weakestPlayer.seatId}（SR {settlementOutcome.weakestPlayer.currentSr} / SP {settlementOutcome.weakestPlayer.currentSp}）</li> : null}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-semibold text-stone-900">玩家最終狀態</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {data.snapshot.players.map((player) => (
                        <div key={`settlement-${player.seatId}`} className="rounded-xl bg-white px-3 py-3 text-sm text-stone-700">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-stone-900">{player.seatId}｜{player.displayName}</span>
                            <span className="text-xs text-stone-500">{player.positionTileId ?? "—"}</span>
                          </div>
                          <p className="mt-1 text-xs text-stone-500">{player.roleNameZh ?? "未指派角色"}</p>
                          <p className="mt-2">SR {player.currentSr} / SP {player.currentSp} / AP {player.remainingAp}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-950">未完成任務</p>
                    <div className="mt-3 space-y-2 text-sm text-amber-950">
                      {settlementOutcome.unresolvedTasks.length > 0 ? settlementOutcome.unresolvedTasks.map((task) => (
                        <div key={`unresolved-${task.taskId}`} className="rounded-xl bg-white px-3 py-2">
                          <p className="font-semibold">{task.nameZh}</p>
                          <p className="mt-1 text-xs text-stone-600">{task.completionHintZh}</p>
                        </div>
                      )) : <p className="rounded-xl bg-white px-3 py-2">可見任務已完成。</p>}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <p className="text-sm font-semibold text-sky-950">後續</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-sky-950">
                      {settlementOutcome.nextStepsZh.map((step) => <li key={step}>• {step}</li>)}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/rooms/${roomCode}/logs?joinToken=${encodeURIComponent(data.joinToken)}&displayName=${encodeURIComponent(data.displayName)}`} className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800">完整紀錄</Link>
                      {suggestedSimulationLinks.map((link) => (
                        <Link key={`settlement-${link.href}`} href={link.href} className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-900">{link.labelZh}</Link>
                      ))}
                      <button className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50" onClick={() => void bootstrap()}>重新整理</button>
                      <button className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50" onClick={() => router.push('/')}>返回首頁</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ActionPillButton({
  label,
  disabled,
  onClick,
  tone = "outline",
  title,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  tone?: "dark" | "amber" | "rose" | "outline";
  title?: string;
}) {
  const toneClass = tone === "dark"
    ? "bg-stone-900 text-white hover:bg-stone-800"
    : tone === "amber"
      ? "bg-amber-600 text-white hover:bg-amber-500"
      : tone === "rose"
        ? "bg-rose-700 text-white hover:bg-rose-600"
        : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {label}
    </button>
  );
}

function PressureTrack({ value, pulse = false }: { value: number; pulse?: boolean }) {
  const clamped = Math.max(0, Math.min(10, value));
  const leftPercent = `${(clamped / 10) * 100}%`;
  const color = clamped <= 3 ? "bg-emerald-500" : clamped <= 6 ? "bg-amber-500" : "bg-rose-500";
  return (
    <HoverInfo
      align="right"
      content={`壓力 3：事件需至少 2 名玩家實際投入。
壓力 6：若本輪沒有 0AP 相鄰互助，不能宣告任務。
壓力 10：遊戲失敗。`}
      label={
        <span className={`inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 ${pulse ? "animate-pulse" : ""}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">壓力</span>
          <span className="text-[13px] font-bold text-stone-950">{clamped}</span>
          <span className="relative inline-flex h-2.5 w-24 overflow-hidden rounded-full bg-stone-200">
            <span className={`absolute inset-y-0 left-0 rounded-full ${color} transition-[width] duration-700 ease-out`} style={{ width: leftPercent }} />
            <span className="absolute inset-y-0 w-0.5 bg-white/90" style={{ left: '30%' }} />
            <span className="absolute inset-y-0 w-0.5 bg-white/90" style={{ left: '60%' }} />
            <span className="absolute inset-y-0 w-0.5 bg-white/90" style={{ left: '100%' }} />
            <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-stone-900 shadow transition-[left] duration-700 ease-out" style={{ left: leftPercent }} />
          </span>
        </span>
      }
    />
  );
}

function CompactStat({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className={`rounded-full border px-3 py-1.5 ${emphasize ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-stone-50 text-stone-800"}`}>
      <span className={`mr-1 text-[10px] font-semibold uppercase tracking-wide ${emphasize ? "text-stone-300" : "text-stone-500"}`}>{label}</span>
      <span className="text-[12px] font-semibold">{value}</span>
    </div>
  );
}

function HoverInfo({
  label,
  content,
  align = "center",
}: {
  label: React.ReactNode;
  content: string;
  align?: "left" | "center" | "right";
}) {
  const alignClass = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="group relative inline-flex">
      <span className="cursor-help">{label}</span>
      <span className={`pointer-events-none absolute top-[calc(100%+8px)] z-30 hidden w-[260px] rounded-2xl border border-stone-200 bg-stone-950 px-3 py-2 text-[11px] leading-5 text-stone-50 shadow-xl group-hover:block group-focus-within:block ${alignClass}`}>
        {content.split("\n").map((line, index) => (
          <span key={`${line}-${index}`} className="block">{line}</span>
        ))}
      </span>
    </span>
  );
}

function renderKeyText(text: string, tone: "rose" | "amber" = "rose") {
  const highlightClass = tone === "amber" ? "text-amber-700" : "text-rose-700";
  return text.split(/(SR|SP|AP|壓力|未解懲罰|失去|回復|完成|任務|[0-9]+)/g).filter(Boolean).map((part, index) => {
    const shouldHighlight = /^(SR|SP|AP|壓力|未解懲罰|失去|回復|完成|任務|[0-9]+)$/.test(part);
    return (
      <span key={`${part}-${index}`} className={shouldHighlight ? `font-semibold ${highlightClass}` : undefined}>
        {part}
      </span>
    );
  });
}

function GuideSpotlightOverlay({ rect }: { rect: GuideHighlightRect | null }) {
  if (!rect) {
    return <div className="fixed inset-0 bg-stone-950/40 backdrop-blur-[3px]" />;
  }

  const top = Math.max(rect.top, 8);
  const left = Math.max(rect.left, 8);
  const right = rect.right;
  const bottom = rect.bottom;
  const width = Math.max(rect.width, 32);
  const height = Math.max(rect.height, 32);

  return (
    <>
      <div className="fixed inset-x-0 top-0 bg-stone-950/42 backdrop-blur-[3px]" style={{ height: top }} />
      <div className="fixed left-0 bg-stone-950/42 backdrop-blur-[3px]" style={{ top, width: left, height }} />
      <div className="fixed right-0 bg-stone-950/42 backdrop-blur-[3px]" style={{ top, left: right, height }} />
      <div className="fixed inset-x-0 bottom-0 bg-stone-950/42 backdrop-blur-[3px]" style={{ top: bottom }} />
      <div
        className="pointer-events-none fixed rounded-[22px] border-4 border-rose-500 shadow-[0_0_0_2px_rgba(255,255,255,0.65),0_0_0_9999px_rgba(255,255,255,0.02),0_0_28px_rgba(244,63,94,0.28)]"
        style={{ top, left, width, height }}
      >
        <div className="absolute inset-0 rounded-[18px] border border-white/80 animate-[spotlight-breathe_1.3s_ease-in-out_infinite]" />
      </div>
    </>
  );
}

function NightCountdownClock({ previousRemainingDays, currentRemainingDays, animated }: { previousRemainingDays: number; currentRemainingDays: number; animated: boolean }) {
  const totalDays = 7;
  const beforeRatio = Math.max(0, Math.min(1, previousRemainingDays / totalDays));
  const afterRatio = Math.max(0, Math.min(1, currentRemainingDays / totalDays));
  const displayRatio = animated ? afterRatio : beforeRatio;
  const previousAngle = (previousRemainingDays / totalDays) * 360;
  const currentAngle = (currentRemainingDays / totalDays) * 360;
  const displayAngle = animated ? currentAngle : previousAngle;

  return (
    <div className="relative mx-auto h-28 w-28 rounded-full border border-white/12 bg-white/5 shadow-[inset_0_0_20px_rgba(255,255,255,0.04)]">
      <div
        className="absolute inset-2 rounded-full"
        style={{
          background: `conic-gradient(rgba(251,191,36,0.96) 0deg ${displayRatio * 360}deg, rgba(255,255,255,0.08) ${displayRatio * 360}deg 360deg)`,
          transition: 'background 900ms ease',
        }}
      />
      <div className="absolute inset-4 rounded-full bg-stone-950 shadow-[inset_0_0_16px_rgba(255,255,255,0.05)]" />
      <div
        className="absolute left-1/2 top-1/2 h-9 w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.45)]"
        style={{ transform: `translate(-50%, -100%) rotate(${displayAngle - 180}deg)`, transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.35)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-[0.22em] text-stone-400">剩餘天數</span>
        <span className="mt-1 text-4xl font-black text-amber-300">{currentRemainingDays}</span>
      </div>
    </div>
  );
}

function NightPressureDeltaTrack({ before, after, animated }: { before: number; after: number; animated: boolean }) {
  const clamp = (value: number) => Math.max(0, Math.min(10, value));
  const beforeValue = clamp(before);
  const afterValue = clamp(after);
  const displayValue = animated ? afterValue : beforeValue;
  const leftPercent = `${(displayValue / 10) * 100}%`;
  const color = displayValue <= 3 ? 'bg-emerald-400' : displayValue <= 6 ? 'bg-amber-400' : 'bg-rose-400';

  return (
    <div className="rounded-[24px] border border-white/12 bg-white/5 px-5 py-4 text-left shadow-[inset_0_0_18px_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-stone-400">壓力變化</span>
        <span className="text-2xl font-black text-rose-300">{beforeValue} → {afterValue}</span>
      </div>
      <div className="relative mt-4 h-4">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[linear-gradient(to_right,#34d399_0%,#34d399_30%,#f59e0b_30%,#f59e0b_60%,#fb7185_60%,#fb7185_100%)] opacity-95" />
        {[0,3,6,10].map((threshold) => (
          <span key={`night-pressure-${threshold}`} className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" style={{ left: `${(threshold / 10) * 100}%` }} />
        ))}
        <span className={`absolute inset-y-0 left-0 rounded-full ${color} opacity-45`} style={{ width: leftPercent, transition: 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
        <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-stone-950 shadow-[0_0_14px_rgba(0,0,0,0.45)]" style={{ left: leftPercent, transition: 'left 900ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[9px] font-semibold text-stone-500">
        <span>0</span><span>3</span><span>6</span><span>10</span>
      </div>
    </div>
  );
}

function TaskRibbonCard({
  title,
  subtitle,
  reward,
  isDone,
  isSelected,
  onClick,
  actionSlot,
  hint,
}: {
  title: string;
  subtitle: string;
  reward: string;
  isDone: boolean;
  isSelected: boolean;
  onClick: () => void;
  actionSlot?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={[
        "rounded-[16px] border p-2 text-left transition",
        isDone
          ? "border-emerald-200 bg-emerald-50"
          : isSelected
            ? "border-stone-900 bg-stone-50 shadow-sm"
            : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold leading-4.5 text-stone-950">{title}</p>
        <span className={["whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium leading-none", isDone ? "bg-emerald-100 text-emerald-800" : isSelected ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600"].join(" ")}>
          {isDone ? "完成" : isSelected ? "查看中" : "任務"}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[9.5px] leading-4 text-stone-700">{renderKeyText(subtitle, "rose")}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <HoverInfo label={<span className="text-[9.5px] leading-4 text-stone-500">獎勵：{renderKeyText(reward, "amber")}</span>} content={hint ?? reward} align="left" />
        {actionSlot}
      </div>
    </div>
  );
}

function PlayerRosterCard({
  seat,
  name,
  roleName,
  sr,
  sp,
  ap,
  companionUsed,
  isActive,
  isViewer,
  isAi,
  positionTileId,
  roleAbilitySummary,
}: {
  seat: string;
  name: string;
  roleName: string;
  sr: number;
  sp: number;
  ap: number;
  companionUsed: boolean;
  isActive: boolean;
  isViewer: boolean;
  isAi: boolean;
  positionTileId: string | null;
  roleAbilitySummary?: string;
}) {
  return (
    <div className={["rounded-[16px] border px-2 py-2 transition", isActive ? "border-amber-300 bg-amber-50/70 shadow-[0_8px_20px_rgba(245,158,11,0.12)]" : "border-stone-200 bg-white/96"].join(" ")}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-stone-950">{seat}｜{name}</p>
          <div className="mt-0.5 truncate text-[9.5px] leading-4 text-stone-500">
            {roleAbilitySummary ? <HoverInfo label={<span className="truncate">{roleName}</span>} content={roleAbilitySummary} align="left" /> : roleName}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {isViewer ? <span className="whitespace-nowrap rounded-full bg-stone-900 px-1.5 py-0.5 text-[8.5px] font-medium leading-none text-white">你</span> : null}
          {isActive ? <span className="whitespace-nowrap rounded-full bg-amber-200 px-1.5 py-0.5 text-[8.5px] font-medium leading-none text-amber-900">行動中</span> : null}
          {isAi ? <span className="whitespace-nowrap rounded-full bg-stone-100 px-1.5 py-0.5 text-[8.5px] font-medium leading-none text-stone-600">AI</span> : null}
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[9px]">
        <div className="rounded-xl bg-stone-100/90 px-1.5 py-1 text-center font-medium text-stone-700"><span className="text-stone-500">SR</span><span className="ml-1 text-[10.5px] text-stone-950">{sr}</span></div>
        <div className="rounded-xl bg-stone-100/90 px-1.5 py-1 text-center font-medium text-stone-700"><span className="text-stone-500">SP</span><span className="ml-1 text-[10.5px] text-stone-950">{sp}</span></div>
        <div className="rounded-xl bg-stone-100/90 px-1.5 py-1 text-center font-medium text-stone-700"><span className="text-stone-500">AP</span><span className="ml-1 text-[10.5px] text-stone-950">{ap}</span></div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[9px] text-stone-500">
        <span className="truncate rounded-full bg-stone-100 px-2 py-0.5">{positionTileId ?? "未定位"}</span>
        <HoverInfo label={<span className={["whitespace-nowrap rounded-full px-2 py-0.5", companionUsed ? "bg-stone-100 text-stone-500" : "bg-emerald-100 text-emerald-700"].join(" ")}>{companionUsed ? "陪伴已用" : "陪伴可用"}</span>} content={companionUsed ? "這名玩家本局的陪伴標記已使用。" : "這名玩家本局仍保有 1 枚陪伴標記，可在他人即將失去 SR / SP 時介入。"} align="right" />
      </div>
    </div>
  );
}

function HandPreviewCard({
  title,
  category,
  description,
  note,
  selected,
  onClick,
}: {
  title: string;
  category: string;
  description: string;
  note: string;
  selected: boolean;
  onClick: () => void;
}) {
  const categoryLabel = category === "mobility" ? "機動" : category === "event_response" ? "事件應對" : "支援";
  return (
    <button
      type="button"
      title={`${title}｜${description}`}
      onClick={onClick}
      className={[
        "group relative w-full rounded-[16px] border px-2.5 py-2 text-left transition",
        selected ? "border-stone-900 bg-stone-50 shadow-[0_8px_20px_rgba(15,23,42,0.08)]" : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="line-clamp-1 text-[11px] font-semibold text-stone-950">{title}</p>
        <div className="flex items-center gap-1">
          {selected ? <span className="rounded-full bg-stone-900 px-1.5 py-0.5 text-[8.5px] font-medium leading-none text-white">已選</span> : null}
          <span className="whitespace-nowrap rounded-full bg-stone-100 px-1.5 py-0.5 text-[8.5px] font-medium leading-none text-stone-600">{categoryLabel}</span>
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-[9.5px] leading-4.5 text-stone-700">{description}</p>
      {note ? <p className="mt-0.5 line-clamp-1 text-[9px] leading-4 text-stone-500">{note}</p> : null}
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 hidden w-[260px] -translate-x-1/2 rounded-2xl border border-stone-200 bg-stone-950 px-3 py-2 text-[11px] leading-5 text-stone-50 shadow-xl group-hover:block">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block">{description}</span>
        {note ? <span className="mt-1 block text-stone-300">{note}</span> : null}
      </span>
    </button>
  );
}

function MobileBottomDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] xl:hidden">
      <button type="button" className="absolute inset-0 bg-stone-950/32 backdrop-blur-[2px]" onClick={onClose} aria-label={`關閉${title}`} />
      <div className="absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-[28px] border border-stone-200 bg-white px-4 pb-5 pt-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-stone-200" />
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-stone-950">{title}</h3>
          <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700" onClick={onClose}>關閉</button>
        </div>
        <div className="mt-4 max-h-[calc(82vh-4.5rem)] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children, accent = "stone" }: { title: string; children: React.ReactNode; accent?: "amber" | "sky" | "emerald" | "violet" | "slate" | "stone" | "rose" }) {
  const accentMap = {
    amber: "border-amber-200",
    sky: "border-sky-200",
    emerald: "border-emerald-200",
    violet: "border-violet-200",
    slate: "border-slate-200",
    stone: "border-stone-200",
    rose: "border-rose-200",
  } as const;

  return (
    <div className={`rounded-3xl border bg-white p-5 shadow-sm ${accentMap[accent]}`}>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function phaseLabel(phase: GameSnapshot["phase"]) {
  switch (phase) {
    case "lobby":
      return "大廳";
    case "crisis":
      return "危機";
    case "action":
      return "行動";
    case "campfire":
      return "營火";
    case "gameover":
      return "遊戲結束";
    default:
      return phase;
  }
}

function lossSourceTypeLabel(kind: string) {
  switch (kind) {
    case "event_penalty":
      return "事件未解懲罰";
    case "risk_tile":
      return "風險地格停留";
    case "campfire_other":
      return "其他營火損失";
    default:
      return kind;
  }
}
