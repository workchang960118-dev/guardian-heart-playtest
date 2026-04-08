import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoomAction } from "@/domain/guardian-heart/types/room-actions";
import type {
  ActionLogEntry,
  EventState,
  GameSnapshot,
  MapTile,
  PendingCampfireStage,
  PendingLossQueueItem,
  PendingLossWindow,
  PendingMerchantGuardAbilityWindow,
  PendingStorytellerAbilityWindow,
  PlayerState,
  SeatId,
  TaskState,
} from "@/domain/guardian-heart/types/game";
import type { RoomServiceErrorCode } from "@/domain/guardian-heart/types/errors";
import { findRoomByCode, updateRoomVersionAndState } from "../repositories/rooms-repository";
import { getLatestRoomSnapshot, insertRoomSnapshot } from "../repositories/room-snapshots-repository";
import { insertRoomActionLog } from "../repositories/room-action-logs-repository";
import { broadcastStateUpdated } from "../realtime/realtime-hub";
import { resolveRoomActor } from "../auth/resolve-room-actor";
import { createInitialGameSnapshot } from "@/domain/guardian-heart/helpers/setup/create-initial-game-snapshot";
import { DEFAULT_ROOM_CONFIG } from "@/domain/guardian-heart/seeds/config/default-room-config";
import { ACTION_CARD_DEFINITION_MAP } from "@/domain/guardian-heart/seeds/cards/minimal-action-cards";
import { drawRoundEvent } from "@/domain/guardian-heart/helpers/setup/select-round-event";
import { getRoundSeatOrder } from "@/domain/guardian-heart/helpers/turns/get-round-seat-order";
import { autoAssignMissingAiRoles, getRoleLoadout, getRoleNameZh } from "@/domain/guardian-heart/helpers/roles/role-loadout";
import { updateAssignedRoleIdForSeat } from "../repositories/room-players-repository";
import { areTilesSameOrAdjacent, getTileById } from "@/domain/guardian-heart/helpers/map/tile-lookup";
import { verifyTaskDeclaration } from "@/domain/guardian-heart/helpers/tasks/task-verifier";
import { ACTION_DECK_PROFILE_MAP } from "@/domain/guardian-heart/seeds/cards/action-deck-profiles";
import { EVENT_POOL_PROFILE_MAP } from "@/domain/guardian-heart/seeds/events/event-pool-profiles";
import { TASK_POOL_PROFILE_MAP } from "@/domain/guardian-heart/seeds/tasks/task-pool-profiles";
import { applyTaskReward } from "@/domain/guardian-heart/helpers/tasks/task-rewards";
import { drawActionCard, normalizeCardPoolsAgainstToggles } from "@/domain/guardian-heart/helpers/cards/action-deck";
import { canRecoverResource, recoverResource } from "@/domain/guardian-heart/helpers/resources/resource-policy";
import { syncAiSeatsInLobby } from "@/domain/guardian-heart/helpers/ai/ai-seat-sync";
import { chooseAiStep } from "@/domain/guardian-heart/helpers/ai/ai-turn-driver";
import {
  applyBellTowerConversion,
  applyMedicBonus,
  applyMerchantGuardRedirect,
  applyMerchantGuardSelection,
  applyMessengerFollowMove,
  applyRangerFreeMove,
  applyStorytellerRecoverySelection,
  canUseMedicBonus,
  canUseMessengerFollowMove,
  canUseRangerFreeMove,
  getEligibleMerchantGuardsForLoss,
  getStorytellerCandidates,
  isRoleAbilityEnabled,
} from "@/domain/guardian-heart/helpers/roles/role-ability-hooks";

export type ApplyRoomActionServiceSuccess = {
  ok: true;
  snapshot: GameSnapshot;
  version: number;
  logEntry: {
    actionType: RoomAction["type"];
    messageZh: string;
    at: string;
  };
};

export type ApplyRoomActionServiceFailure = {
  ok: false;
  error: RoomServiceErrorCode;
};

export type ApplyRoomActionServiceResult =
  | ApplyRoomActionServiceSuccess
  | ApplyRoomActionServiceFailure;

type ReducerResult = {
  snapshot: GameSnapshot;
  messageZh: string;
  logActorSeat?: SeatId | "SYSTEM";
  logAction?: RoomAction;
};

const TURN_CONTEXT_TEMPLATE = {
  P1: { hasEndedTurn: false },
  P2: { hasEndedTurn: false },
  P3: { hasEndedTurn: false },
  P4: { hasEndedTurn: false },
};

function cloneSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return structuredClone(snapshot);
}

function fail(code: RoomServiceErrorCode): never {
  throw new Error(code);
}

function isHostOnlyAction(action: RoomAction): boolean {
  return ["assign_role", "start_game", "start_round", "resolve_campfire", "update_room_config", "run_ai_turn"].includes(action.type);
}

function requireHostAction(action: RoomAction, isHost: boolean): RoomServiceErrorCode | null {
  if (isHostOnlyAction(action) && !isHost) return "UNAUTHORIZED_HOST_ACTION";
  return null;
}

function getPlayerBySeat(snapshot: GameSnapshot, seatId: SeatId): PlayerState {
  const player = snapshot.players.find((item) => item.seatId === seatId);
  if (!player) fail("SEAT_NOT_FOUND");
  return player;
}

function requireActiveSeat(snapshot: GameSnapshot, actorSeat: SeatId) {
  if (snapshot.phase !== "action") fail("INVALID_PHASE");
  if (snapshot.activeSeat !== actorSeat) fail("NOT_ACTIVE_SEAT");
  if (snapshot.blockingWindow) fail("INVALID_PHASE");
}

function getContributionTotals(currentEvent: EventState | null) {
  const totals = { sr: 0, sp: 0 };
  for (const contribution of currentEvent?.contributions ?? []) {
    totals.sr += contribution.srCounted;
    totals.sp += contribution.spCounted;
  }
  return totals;
}

function getDistinctContributorCount(currentEvent: EventState | null) {
  return new Set((currentEvent?.contributions ?? []).map((item) => item.seatId)).size;
}


function summarizeSnapshotForLog(snapshot: GameSnapshot) {
  return {
    phase: snapshot.phase,
    round: snapshot.round,
    pressure: snapshot.pressure,
    activeSeat: snapshot.activeSeat,
    blockingWindowKind: snapshot.blockingWindow?.kind ?? null,
    players: snapshot.players.map((player) => ({
      seatId: player.seatId,
      sr: player.currentSr,
      sp: player.currentSp,
      ap: player.remainingAp,
      tileId: player.positionTileId,
    })),
  };
}

function summarizePayloadZh(action: RoomAction): string {
  switch (action.type) {
    case "assign_role":
      return `指派 ${action.targetSeat} 為角色 ${action.roleId}`;
    case "start_game":
      return "開始遊戲";
    case "start_round":
      return "開始本輪";
    case "move":
      return `移動到 ${action.toTileId}`;
    case "use_station_or_shelter":
      return "使用當前功能地格";
    case "invest_event":
      return action.convertOne
        ? `投入事件 SR ${action.srPaid} / SP ${action.spPaid}（能力轉換：${action.convertOne}）`
        : `投入事件 SR ${action.srPaid} / SP ${action.spPaid}`;
    case "play_action_card":
      return `使用行動卡 ${ACTION_CARD_DEFINITION_MAP[action.cardId]?.nameZh ?? action.cardId}`;
    case "adjacent_help":
      return action.freeMoveSeat && action.freeMoveToTileId
        ? `對 ${action.targetSeat} 進行相鄰互助（${action.resourceType}），並準備免費移動 ${action.freeMoveSeat} -> ${action.freeMoveToTileId}`
        : `對 ${action.targetSeat} 進行相鄰互助（${action.resourceType}）`;
    case "end_turn":
      return "結束回合";
    case "discard_cards":
      return `棄掉 ${action.discardedCardIds.length} 張牌`;
    case "use_companion_token":
      return action.mode === "prevent"
        ? `使用陪伴標記抵銷 ${action.preventResource ?? "SR"}`
        : "使用陪伴標記安撫";
    case "finalize_pending_loss":
      return "確認套用損失";
    case "declare_task":
      return `宣告任務 ${action.taskId}`;
    case "resolve_role_ability":
      return action.mode === "use" ? `發動角色技能 ${action.abilityId}` : `略過角色技能 ${action.abilityId}`;
    case "update_room_config":
      return `更新房間開關`;
    case "run_ai_turn":
      return `推進 AI 補位`;
    case "resolve_campfire":
      return "開始營火結算";
    default:
      return "未知操作";
  }
}

function appendActionLogEntry(params: {
  snapshot: GameSnapshot;
  action: RoomAction;
  actorSeat: SeatId | "SYSTEM";
  at: string;
  messageZh: string;
  statusBefore: ReturnType<typeof summarizeSnapshotForLog>;
}) {
  const { snapshot, action, actorSeat, at, messageZh, statusBefore } = params;
  const actorPlayer = actorSeat === "SYSTEM" ? null : snapshot.players.find((item) => item.seatId === actorSeat);
  const entry: ActionLogEntry = {
    roomRevision: snapshot.roomRevision,
    round: snapshot.round,
    phase: snapshot.phase,
    actorSeat,
    actorKind: actorSeat === "SYSTEM" ? "system" : actorPlayer?.isAi ? "ai" : "human",
    actorLabelZh: actorSeat === "SYSTEM" ? "系統" : actorPlayer?.isAi ? `${actorSeat}（AI｜${actorPlayer.roleNameZh ?? "未指派角色"}）` : `${actorSeat}${actorPlayer?.roleNameZh ? `｜${actorPlayer.roleNameZh}` : ""}`,
    actionType: action.type,
    payloadSummaryZh: summarizePayloadZh(action),
    resultSummaryZh: messageZh,
    statusBefore,
    statusAfter: summarizeSnapshotForLog(snapshot),
    timestamp: at,
  };
  snapshot.actionLog = [entry, ...snapshot.actionLog].slice(0, 200);
  return entry;
}

function buildLossWindowFromQueueItem(item: PendingLossQueueItem, merchantGuardSeat: SeatId | null = null): PendingLossWindow {
  return {
    kind: "loss",
    lossChainId: item.lossChainId,
    targetSeat: item.targetSeat,
    srLoss: item.srLoss,
    spLoss: item.spLoss,
    eligibleCompanionSeatIds: item.eligibleCompanionSeatIds,
    companionUsed: false,
    companionReaction: null,
    sourceType: item.sourceType,
    sourceLabelZh: item.sourceLabelZh,
    merchantGuardSeat,
  };
}

function buildMerchantGuardAbilityWindow(params: {
  snapshot: GameSnapshot;
  item: PendingLossQueueItem;
  eligibleGuards: PlayerState[];
}): PendingMerchantGuardAbilityWindow {
  const { snapshot, item, eligibleGuards } = params;
  const humanSeats = eligibleGuards.filter((player) => !player.isAi).map((player) => player.seatId);
  const fallbackAiSeatId = eligibleGuards.find((player) => player.isAi)?.seatId ?? null;
  return {
    kind: "ability",
    abilityId: "merchant_guard",
    actorSeat: humanSeats[0],
    remainingResponderSeatIds: humanSeats.slice(1),
    fallbackAiSeatId,
    loss: {
      lossChainId: item.lossChainId,
      targetSeat: item.targetSeat,
      srLoss: item.srLoss,
      spLoss: item.spLoss,
      eligibleCompanionSeatIds: item.eligibleCompanionSeatIds,
      companionUsed: false,
      companionReaction: null,
      sourceType: item.sourceType,
      sourceLabelZh: item.sourceLabelZh,
    },
  };
}

function openNextLossWindow(snapshot: GameSnapshot) {
  setPendingCampfireStage(snapshot, "resolve_losses");
  const next = snapshot.pendingLossQueue.shift();
  if (!next) {
    snapshot.blockingWindow = null;
    return false;
  }
  const eligibleGuards = getEligibleMerchantGuardsForLoss({ snapshot, lossItem: next });
  const humanGuards = eligibleGuards.filter((player) => !player.isAi);
  const aiGuard = eligibleGuards.find((player) => player.isAi) ?? null;
  if (humanGuards.length > 0) {
    snapshot.blockingWindow = buildMerchantGuardAbilityWindow({ snapshot, item: next, eligibleGuards });
    return true;
  }
  if (aiGuard) {
    const applied = applyMerchantGuardSelection({ snapshot, guardSeat: aiGuard.seatId });
    snapshot.blockingWindow = buildLossWindowFromQueueItem(next, applied.applied ? aiGuard.seatId : null);
    return true;
  }
  snapshot.blockingWindow = buildLossWindowFromQueueItem(next);
  return true;
}

function getLossWindow(snapshot: GameSnapshot): PendingLossWindow {
  if (!snapshot.blockingWindow || snapshot.blockingWindow.kind !== "loss") fail("LOSS_WINDOW_NOT_FOUND");
  return snapshot.blockingWindow;
}

function getAbilityWindow(snapshot: GameSnapshot): PendingMerchantGuardAbilityWindow | PendingStorytellerAbilityWindow {
  if (!snapshot.blockingWindow || snapshot.blockingWindow.kind !== "ability") fail("ABILITY_WINDOW_NOT_FOUND");
  return snapshot.blockingWindow;
}

function buildEligibleCompanionSeatIds(players: PlayerState[], targetSeat: SeatId): SeatId[] {
  return players.filter((player) => player.seatId !== targetSeat && player.companionTokensRemaining > 0).map((player) => player.seatId);
}

function findRiskTiles(mapTiles: MapTile[]) {
  return new Set(mapTiles.filter((tile) => tile.kind === "risk").map((tile) => tile.tileId));
}


function buildImmediateEventLosses(snapshot: GameSnapshot, event: EventState): PendingLossQueueItem[] {
  const effect = event.immediateEffect;
  if (!effect) return [];

  const losses: PendingLossQueueItem[] = [];
  const sourceLabelZh = `事件翻開立即效果：${event.nameZh}`;

  if (effect.mode === "each_player") {
    for (const player of snapshot.players) {
      enqueueLoss(losses, {
        lossChainId: `${event.cardId}-immediate-${player.seatId}-${snapshot.round}`,
        targetSeat: player.seatId,
        srLoss: effect.srLoss ?? 0,
        spLoss: effect.spLoss ?? 0,
        eligibleCompanionSeatIds: buildEligibleCompanionSeatIds(snapshot.players, player.seatId),
        sourceType: "event_penalty",
        sourceLabelZh,
      });
    }
    return losses;
  }

  if (effect.mode === "each_player_not_adjacent_to_any_teammate") {
    for (const player of snapshot.players) {
      if (!player.positionTileId) continue;
      const hasAdjacentTeammate = snapshot.players.some((other) => {
        if (other.seatId === player.seatId) return false;
        if (!other.positionTileId) return false;
        return areTilesSameOrAdjacent(snapshot.mapTiles, player.positionTileId!, other.positionTileId);
      });
      if (hasAdjacentTeammate) continue;
      enqueueLoss(losses, {
        lossChainId: `${event.cardId}-immediate-${player.seatId}-${snapshot.round}`,
        targetSeat: player.seatId,
        srLoss: effect.srLoss ?? 0,
        spLoss: effect.spLoss ?? 0,
        eligibleCompanionSeatIds: buildEligibleCompanionSeatIds(snapshot.players, player.seatId),
        sourceType: "event_penalty",
        sourceLabelZh,
      });
    }
  }

  return losses;
}

function resetRoundState(snapshot: GameSnapshot) {
  snapshot.flags.adjacentHelpPairsThisRound = [];
  snapshot.flags.adjacentHelpResourceTypesThisRound = [];
  snapshot.turnContext.actedSeatOrder = [];
  snapshot.turnContext.perSeat = structuredClone(TURN_CONTEXT_TEMPLATE);
  for (const player of snapshot.players) {
    player.perRoundFlags.hasAdjacentHelped = false;
    player.perRoundFlags.hasInvestedEvent = false;
    const loadout = getRoleLoadout(player.roleId);
    player.roleAbilityUsesRemaining = loadout?.roleAbilityUses ?? 1;
    player.remainingAp = 2;
  }
}


function setPendingCampfireStage(snapshot: GameSnapshot, stage: PendingCampfireStage, summaryZh?: string) {
  if (!snapshot.pendingCampfireResolution) return;
  snapshot.pendingCampfireResolution.stage = stage;
  if (summaryZh) snapshot.pendingCampfireResolution.summaryZh = summaryZh;
}

function applyCampfireFinalStep(snapshot: GameSnapshot) {
  setPendingCampfireStage(snapshot, "apply_pressure");
  const pendingPressure = snapshot.pendingCampfireResolution?.pendingPressureDelta ?? 0;
  snapshot.pressure += pendingPressure;
  setPendingCampfireStage(snapshot, "state_check", `壓力增加 ${pendingPressure}，接著進入狀態確認與勝敗檢查。`);
  snapshot.pendingCampfireResolution = null;
  if (snapshot.currentEvent?.cardId) {
    snapshot.eventDiscardPile.push(snapshot.currentEvent.cardId);
  }
  snapshot.currentEvent = null;
  snapshot.turnOrder = [];
  snapshot.activeSeat = null;

  const completedTasks = snapshot.tasks.filter((task) => task.completionCheckedByHost).length;
  const gameFailed = snapshot.pressure >= 10 || snapshot.players.some((player) => player.currentSr <= 0 || player.currentSp <= 0);
  const reachedFinalRound = snapshot.round >= 7;
  const gameWon = reachedFinalRound && !gameFailed && completedTasks >= 2;
  const gameLostByTaskShortfall = reachedFinalRound && !gameFailed && completedTasks < 2;

  if (gameFailed || gameWon || gameLostByTaskShortfall) {
    snapshot.phase = "gameover";
    snapshot.status = "finished";
    return {
      movedToGameover: true,
      finalReasonZh: gameWon ? "撐過第 7 回合，且任務達標，團隊成功守住局勢。" : gameLostByTaskShortfall ? "第 7 回合結束但完成任務不足 2 張，本局失敗。" : null,
    };
  }

  snapshot.phase = "crisis";
  snapshot.status = "in_progress";
  return { movedToGameover: false, finalReasonZh: null };
}

function continueCampfireAfterLosses(snapshot: GameSnapshot) {
  setPendingCampfireStage(snapshot, "apply_pressure", `${snapshot.pendingCampfireResolution?.summaryZh ?? "營火損失已處理完畢。"} 目前進入壓力、里程碑與狀態確認。`);
  const storyteller = snapshot.players.find((player) => player.roleId === "square_storyteller") ?? null;
  const storytellerCandidates = getStorytellerCandidates(snapshot);
  if (storyteller && storytellerCandidates.length > 0 && !storyteller.isAi) {
    snapshot.blockingWindow = {
      kind: "ability",
      abilityId: "square_storyteller",
      actorSeat: storyteller.seatId,
      candidateSeatIds: storytellerCandidates.map((player) => player.seatId),
    };
    return { pausedForAbility: true, messageZh: `${storyteller.seatId} 可決定是否發動〈協調分工〉。` };
  }
  let storytellerMessageZh: string | null = null;
  if (storyteller && storytellerCandidates.length > 0 && storyteller.isAi) {
    const sorted = storytellerCandidates.sort((a, b) => a.currentSp - b.currentSp);
    const applied = applyStorytellerRecoverySelection({ snapshot, targetSeat: sorted[0].seatId });
    storytellerMessageZh = applied.applied ? applied.messageZh : null;
  }
  const finalState = applyCampfireFinalStep(snapshot);
  return {
    pausedForAbility: false,
    storytellerMessageZh,
    finalState,
    messageZh: finalState.movedToGameover ? "本局進入遊戲結束" : "本輪營火結算完成，回到危機階段",
  };
}

function enqueueLoss(items: PendingLossQueueItem[], item: PendingLossQueueItem) {
  if (item.srLoss <= 0 && item.spLoss <= 0) return;
  items.push(item);
}

function resolveCurrentEvent(snapshot: GameSnapshot) {
  if (!snapshot.currentEvent) {
    return {
      eventResolved: true,
      pressureDelta: 1,
      summaryZh: "本輪沒有事件資料，直接進入營火後段。",
      queuedLosses: [] as PendingLossQueueItem[],
    };
  }

  const totals = getContributionTotals(snapshot.currentEvent);
  const contributors = getDistinctContributorCount(snapshot.currentEvent);
  const needsTwoContributors = snapshot.pressure >= 3;
  const requirementMet =
    totals.sr >= snapshot.currentEvent.requirement.srRequired &&
    totals.sp >= snapshot.currentEvent.requirement.spRequired &&
    (!needsTwoContributors || contributors >= 2);

  const queuedLosses: PendingLossQueueItem[] = [];
  let pressureDelta = 1;
  const unresolvedNotesZh: string[] = [];

  if (!requirementMet) {
    pressureDelta += snapshot.currentEvent.penalty.pressureDelta ?? 0;
    const mode = snapshot.currentEvent.penalty.mode ?? "single_target";
    const srLoss = snapshot.currentEvent.penalty.srLoss ?? 0;
    const spLoss = snapshot.currentEvent.penalty.spLoss ?? 0;
    const sourceLabelZh = `事件未解決：${snapshot.currentEvent.nameZh}`;

    if (mode === "each_player") {
      for (const player of snapshot.players) {
        enqueueLoss(queuedLosses, {
          lossChainId: `${snapshot.currentEvent.cardId}-${player.seatId}-${snapshot.round}`,
          targetSeat: player.seatId,
          srLoss,
          spLoss,
          eligibleCompanionSeatIds: buildEligibleCompanionSeatIds(snapshot.players, player.seatId),
          sourceType: "event_penalty",
          sourceLabelZh,
        });
      }
    } else if (mode === "two_distinct_players") {
      const targetCount = snapshot.currentEvent.penalty.targetCount ?? 2;
      for (const player of snapshot.players.slice(0, targetCount)) {
        enqueueLoss(queuedLosses, {
          lossChainId: `${snapshot.currentEvent.cardId}-${player.seatId}-${snapshot.round}`,
          targetSeat: player.seatId,
          srLoss,
          spLoss,
          eligibleCompanionSeatIds: buildEligibleCompanionSeatIds(snapshot.players, player.seatId),
          sourceType: "event_penalty",
          sourceLabelZh,
        });
      }
    } else if (mode === "each_player_choose_sr_or_sp") {
      for (const player of snapshot.players) {
        const chooseSr = player.currentSr <= player.currentSp;
        const selectedResource = chooseSr ? "SR" : "SP";
        unresolvedNotesZh.push(`${player.seatId} 目前由系統代選失去 1${selectedResource}`);
        enqueueLoss(queuedLosses, {
          lossChainId: `${snapshot.currentEvent.cardId}-${player.seatId}-${snapshot.round}`,
          targetSeat: player.seatId,
          srLoss: chooseSr ? 1 : 0,
          spLoss: chooseSr ? 0 : 1,
          eligibleCompanionSeatIds: buildEligibleCompanionSeatIds(snapshot.players, player.seatId),
          sourceType: "event_penalty",
          sourceLabelZh,
        });
      }
    } else {
      const targetSeat = snapshot.players[0]?.seatId;
      if (targetSeat) {
        enqueueLoss(queuedLosses, {
          lossChainId: `${snapshot.currentEvent.cardId}-${targetSeat}-${snapshot.round}`,
          targetSeat,
          srLoss,
          spLoss,
          eligibleCompanionSeatIds: buildEligibleCompanionSeatIds(snapshot.players, targetSeat),
          sourceType: "event_penalty",
          sourceLabelZh,
        });
      }
    }
  }

  return {
    eventResolved: requirementMet,
    pressureDelta,
    summaryZh: requirementMet
      ? `本輪事件〈${snapshot.currentEvent.nameZh}〉已成功解決。`
      : `本輪事件〈${snapshot.currentEvent.nameZh}〉未解決。`,
    queuedLosses,
  };
}

function buildRiskLosses(snapshot: GameSnapshot): PendingLossQueueItem[] {
  const riskTileIds = findRiskTiles(snapshot.mapTiles);
  return snapshot.players
    .filter((player) => player.positionTileId && riskTileIds.has(player.positionTileId))
    .map((player) => ({
      lossChainId: `risk-${snapshot.round}-${player.seatId}`,
      targetSeat: player.seatId,
      srLoss: 1,
      spLoss: 0,
      eligibleCompanionSeatIds: buildEligibleCompanionSeatIds(snapshot.players, player.seatId),
      sourceType: "risk_tile" as const,
      sourceLabelZh: "營火仍停留在風險地格",
    }));
}

function handleAssignRole(params: {
  snapshot: GameSnapshot;
  action: Extract<RoomAction, { type: "assign_role" }>;
  at: string;
}) {
  const { snapshot, action, at } = params;
  if (snapshot.phase !== "lobby" || snapshot.status !== "lobby") fail("INVALID_PHASE");
  const nextSnapshot = cloneSnapshot(snapshot);
  const target = nextSnapshot.players.find((player) => player.seatId === action.targetSeat);
  if (!target) fail("SEAT_NOT_FOUND");
  if (nextSnapshot.players.some((player) => player.seatId !== action.targetSeat && player.roleId === action.roleId)) {
    fail("ROLE_ALREADY_TAKEN");
  }
  target.roleId = action.roleId;
  target.roleNameZh = getRoleNameZh(action.roleId);
  nextSnapshot.updatedAt = at;
  return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 指派 ${action.targetSeat} 為 ${target.roleNameZh ?? action.roleId}` };
}

function handleStartGame(params: { snapshot: GameSnapshot; at: string }) {
  const { snapshot, at } = params;
  if (snapshot.phase !== "lobby" || snapshot.status !== "lobby") fail("INVALID_PHASE");
  const preparedSnapshot = cloneSnapshot(snapshot);
  autoAssignMissingAiRoles(preparedSnapshot.players);
  const missingRolePlayer = preparedSnapshot.players.find((player) => !player.roleId);
  if (missingRolePlayer) fail("MISSING_ROLE_ASSIGNMENTS");
  const startedSnapshot = createInitialGameSnapshot({
    roomId: preparedSnapshot.roomId,
    players: preparedSnapshot.players.map((player) => ({ seatId: player.seatId, displayName: player.displayName, roleId: player.roleId!, isAi: player.isAi })),
    roomConfig: preparedSnapshot.roomConfig ?? DEFAULT_ROOM_CONFIG,
    at,
  });
  return { snapshot: startedSnapshot, messageZh: `房主開始遊戲，進入危機階段（AI 角色已同步）` };
}

function handleStartRound(params: { snapshot: GameSnapshot; at: string }) {
  const { snapshot, at } = params;
  if (snapshot.phase !== "crisis") fail("INVALID_PHASE");
  const nextSnapshot = cloneSnapshot(snapshot);
  nextSnapshot.round += 1;
  nextSnapshot.phase = "action";
  nextSnapshot.currentEvent = drawRoundEvent(nextSnapshot);
  nextSnapshot.turnOrder = getRoundSeatOrder(nextSnapshot);
  nextSnapshot.activeSeat = nextSnapshot.turnOrder[0] ?? null;
  resetRoundState(nextSnapshot);

  const immediateLosses = nextSnapshot.currentEvent ? buildImmediateEventLosses(nextSnapshot, nextSnapshot.currentEvent) : [];
  nextSnapshot.pendingLossQueue = immediateLosses;
  let messageZh = `開始第 ${nextSnapshot.round} 輪，輪到 ${nextSnapshot.activeSeat}`;
  if (immediateLosses.length > 0) {
    openNextLossWindow(nextSnapshot);
    messageZh += `；已建立 ${immediateLosses.length} 筆事件立即效果損失處理`;
  }

  nextSnapshot.updatedAt = at;
  return { snapshot: nextSnapshot, messageZh };
}

function handleMove(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "move" }>; at: string }) {
  const { snapshot, action, at } = params;
  requireActiveSeat(snapshot, action.actorSeat);
  const nextSnapshot = cloneSnapshot(snapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  if (actor.remainingAp < 1) fail("INSUFFICIENT_RESOURCE");
  if (!actor.positionTileId) fail("TILE_NOT_FOUND");
  const currentTile = getTileById(nextSnapshot.mapTiles, actor.positionTileId);
  const targetTile = getTileById(nextSnapshot.mapTiles, action.toTileId);
  if (!currentTile || !targetTile) fail("TILE_NOT_FOUND");
  if (!currentTile.adjacentTileIds.includes(targetTile.tileId)) fail("MOVE_NOT_ADJACENT");

  const rangerEligible = canUseRangerFreeMove({
    snapshot: nextSnapshot,
    actor,
    fromTileId: currentTile.tileId,
    toTileId: targetTile.tileId,
  });
  const rangerMove = action.useRangerAbility && rangerEligible
    ? applyRangerFreeMove({ snapshot: nextSnapshot, actor })
    : { applied: false as const };

  actor.positionTileId = targetTile.tileId;
  if (!rangerMove.applied) {
    actor.remainingAp -= 1;
  }
  nextSnapshot.updatedAt = at;
  return {
    snapshot: nextSnapshot,
    messageZh: rangerMove.applied
      ? `${action.actorSeat} 移動到 ${targetTile.nameZh}；${rangerMove.messageZh}`
      : `${action.actorSeat} 移動到 ${targetTile.nameZh}`,
  };
}

function handleUseStationOrShelter(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "use_station_or_shelter" }>; at: string }) {
  const { snapshot, action, at } = params;
  requireActiveSeat(snapshot, action.actorSeat);
  const nextSnapshot = cloneSnapshot(snapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  if (actor.remainingAp < 1) fail("INSUFFICIENT_RESOURCE");
  if (!actor.positionTileId) fail("TILE_NOT_FOUND");
  const tile = getTileById(nextSnapshot.mapTiles, actor.positionTileId);
  if (!tile) fail("TILE_NOT_FOUND");
  if (tile.kind === "station") {
    if (!canRecoverResource(actor, "SR", 1, nextSnapshot.roomConfig)) fail("RESOURCE_AT_MAX");
    recoverResource(actor, "SR", 1, nextSnapshot.roomConfig);
  } else if (tile.kind === "shelter") {
    if (!canRecoverResource(actor, "SP", 1, nextSnapshot.roomConfig)) fail("RESOURCE_AT_MAX");
    recoverResource(actor, "SP", 1, nextSnapshot.roomConfig);
  } else {
    fail("NOT_ON_FUNCTION_TILE");
  }
  actor.remainingAp -= 1;
  nextSnapshot.updatedAt = at;
  return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 使用${tile.nameZh}` };
}

function handleInvestEvent(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "invest_event" }>; at: string }) {
  const { snapshot, action, at } = params;
  requireActiveSeat(snapshot, action.actorSeat);
  const nextSnapshot = cloneSnapshot(snapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  if (!nextSnapshot.currentEvent) fail("EVENT_NOT_AVAILABLE");
  if (actor.perRoundFlags.hasInvestedEvent) fail("EVENT_INVEST_LIMIT_REACHED");
  const { srPaid, spPaid } = action;
  if (srPaid < 0 || spPaid < 0 || srPaid + spPaid <= 0) fail("INVALID_ACTION_PAYLOAD");
  if (actor.currentSr < srPaid || actor.currentSp < spPaid) fail("INSUFFICIENT_RESOURCE");

  const conversion = applyBellTowerConversion({
    snapshot: nextSnapshot,
    actor,
    srPaid,
    spPaid,
    convertOne: action.convertOne,
  });

  const totals = getContributionTotals(nextSnapshot.currentEvent);
  const remainingSr = Math.max(0, nextSnapshot.currentEvent.requirement.srRequired - totals.sr);
  const remainingSp = Math.max(0, nextSnapshot.currentEvent.requirement.spRequired - totals.sp);
  if (conversion.srCounted > remainingSr || conversion.spCounted > remainingSp) fail("EVENT_REQUIREMENT_EXCEEDED");

  actor.currentSr -= srPaid;
  actor.currentSp -= spPaid;
  actor.perRoundFlags.hasInvestedEvent = true;
  nextSnapshot.currentEvent.contributions.push({
    seatId: actor.seatId,
    srPaid,
    spPaid,
    srCounted: conversion.srCounted,
    spCounted: conversion.spCounted,
  });
  nextSnapshot.updatedAt = at;

  const messageZh = conversion.messageZh
    ? `${action.actorSeat} 投入事件：SR ${srPaid} / SP ${spPaid}。${conversion.messageZh}`
    : `${action.actorSeat} 投入事件：SR ${srPaid} / SP ${spPaid}`;
  return { snapshot: nextSnapshot, messageZh };
}

function handleAdjacentHelp(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "adjacent_help" }>; at: string }) {
  const { snapshot, action, at } = params;
  requireActiveSeat(snapshot, action.actorSeat);
  const nextSnapshot = cloneSnapshot(snapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  const target = getPlayerBySeat(nextSnapshot, action.targetSeat);
  if (actor.seatId === target.seatId) fail("TARGET_NOT_REACHABLE");
  if (actor.perRoundFlags.hasAdjacentHelped) fail("HELP_LIMIT_REACHED");
  if (!actor.positionTileId || !target.positionTileId) fail("TILE_NOT_FOUND");
  if (!areTilesSameOrAdjacent(nextSnapshot.mapTiles, actor.positionTileId, target.positionTileId)) fail("TARGET_NOT_REACHABLE");
  if (action.resourceType === "SR") {
    if (actor.currentSr < 1) fail("INSUFFICIENT_RESOURCE");
    if (!canRecoverResource(target, "SR", 1, nextSnapshot.roomConfig)) fail("TARGET_RESOURCE_FULL");
    actor.currentSr -= 1;
    recoverResource(target, "SR", 1, nextSnapshot.roomConfig);
  } else {
    if (actor.currentSp < 1) fail("INSUFFICIENT_RESOURCE");
    if (!canRecoverResource(target, "SP", 1, nextSnapshot.roomConfig)) fail("TARGET_RESOURCE_FULL");
    actor.currentSp -= 1;
    recoverResource(target, "SP", 1, nextSnapshot.roomConfig);
  }

  actor.perRoundFlags.hasAdjacentHelped = true;
  nextSnapshot.flags.adjacentHelpPairsThisRound.push(`${actor.seatId}->${target.seatId}`);
  nextSnapshot.flags.adjacentHelpResourceTypesThisRound.push(action.resourceType);

  const medicAbility = action.useMedicAbility
    ? applyMedicBonus({
        snapshot: nextSnapshot,
        actor,
        target,
      })
    : { applied: false as const };

  const messengerAbility = action.useMessengerAbility
    ? applyMessengerFollowMove({
        snapshot: nextSnapshot,
        actor,
        target,
        moveSeat: action.freeMoveSeat,
        moveToTileId: action.freeMoveToTileId,
      })
    : { applied: false as const };

  nextSnapshot.updatedAt = at;
  const extraMessages = [medicAbility, messengerAbility]
    .filter((item) => item.applied)
    .map((item) => item.messageZh)
    .join(" ");
  const messageZh = extraMessages
    ? `${action.actorSeat} 對 ${action.targetSeat} 進行相鄰互助（${action.resourceType}）。${extraMessages}`
    : `${action.actorSeat} 對 ${action.targetSeat} 進行相鄰互助（${action.resourceType}）`;
  return { snapshot: nextSnapshot, messageZh };
}

function canReachWithinSteps(mapTiles: MapTile[], fromTileId: string, toTileId: string, maxSteps: number) {
  if (fromTileId === toTileId) return false;
  let frontier = new Set([fromTileId]);
  const visited = new Set([fromTileId]);
  for (let step = 1; step <= maxSteps; step += 1) {
    const nextFrontier = new Set<string>();
    for (const tileId of frontier) {
      const tile = getTileById(mapTiles, tileId);
      if (!tile) continue;
      for (const adjacentId of tile.adjacentTileIds) {
        if (adjacentId === toTileId) return true;
        if (!visited.has(adjacentId)) {
          visited.add(adjacentId);
          nextFrontier.add(adjacentId);
        }
      }
    }
    frontier = nextFrontier;
  }
  return false;
}

function consumeActionCard(snapshot: GameSnapshot, actor: PlayerState, cardId: string, apCost: number) {
  if (!actor.handCardIds.includes(cardId)) fail("CARD_NOT_IN_HAND");
  if (actor.remainingAp < apCost) fail("INSUFFICIENT_RESOURCE");
  actor.handCardIds = actor.handCardIds.filter((id) => id !== cardId);
  snapshot.discardPile.push(cardId);
  actor.remainingAp -= apCost;
}

function applyRecovery(snapshot: GameSnapshot, target: PlayerState, resourceType: "SR" | "SP", amount: number) {
  if (!canRecoverResource(target, resourceType, amount, snapshot.roomConfig)) fail("TARGET_RESOURCE_FULL");
  recoverResource(target, resourceType, amount, snapshot.roomConfig);
}

function handlePlayActionCard(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "play_action_card" }>; at: string }) {
  const { snapshot, action, at } = params;
  requireActiveSeat(snapshot, action.actorSeat);
  const nextSnapshot = cloneSnapshot(snapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  const card = ACTION_CARD_DEFINITION_MAP[action.cardId];
  if (!card) fail("UNSUPPORTED_ACTION");
  if (!nextSnapshot.roomConfig.cardToggles[action.cardId]) fail("ACTION_CARD_DISABLED");
  if (action.cardId === "card_respond_together" && !nextSnapshot.roomConfig.experimentalRuleToggles.respondTogetherEnabled) fail("ACTION_CARD_DISABLED");

  switch (action.cardId) {
    case "card_pull_you_a_bit": {
      if (!action.targetSeat || !action.toTileId) fail("INVALID_ACTION_PAYLOAD");
      const target = getPlayerBySeat(nextSnapshot, action.targetSeat);
      if (target.seatId === actor.seatId) fail("TARGET_NOT_REACHABLE");
      if (!actor.positionTileId || !target.positionTileId) fail("TILE_NOT_FOUND");
      if (!areTilesSameOrAdjacent(nextSnapshot.mapTiles, actor.positionTileId, target.positionTileId)) fail("TARGET_NOT_REACHABLE");
      const currentTargetTile = getTileById(nextSnapshot.mapTiles, target.positionTileId);
      const destinationTile = getTileById(nextSnapshot.mapTiles, action.toTileId);
      if (!currentTargetTile || !destinationTile) fail("TILE_NOT_FOUND");
      if (!currentTargetTile.adjacentTileIds.includes(destinationTile.tileId)) fail("MOVE_NOT_ADJACENT");
      consumeActionCard(nextSnapshot, actor, action.cardId, card.apCost);
      target.positionTileId = destinationTile.tileId;
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 使用〈${card.nameZh}〉，讓 ${target.seatId} 移動到 ${destinationTile.nameZh}` };
    }
    case "card_dash_to_goal": {
      if (!action.toTileId || !actor.positionTileId) fail("INVALID_ACTION_PAYLOAD");
      const destinationTile = getTileById(nextSnapshot.mapTiles, action.toTileId);
      if (!destinationTile) fail("TILE_NOT_FOUND");
      if (!["station", "shelter", "center"].includes(destinationTile.kind)) fail("ACTION_CARD_EFFECT_NOT_AVAILABLE");
      if (!canReachWithinSteps(nextSnapshot.mapTiles, actor.positionTileId, destinationTile.tileId, 2)) fail("ACTION_CARD_EFFECT_NOT_AVAILABLE");
      consumeActionCard(nextSnapshot, actor, action.cardId, card.apCost);
      actor.positionTileId = destinationTile.tileId;
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 使用〈${card.nameZh}〉，直奔 ${destinationTile.nameZh}` };
    }
    case "card_same_tile_care": {
      if (!action.targetSeat || !action.resourceType) fail("INVALID_ACTION_PAYLOAD");
      const target = getPlayerBySeat(nextSnapshot, action.targetSeat);
      if (target.seatId === actor.seatId) fail("TARGET_NOT_REACHABLE");
      if (!actor.positionTileId || actor.positionTileId !== target.positionTileId) fail("TARGET_NOT_REACHABLE");
      consumeActionCard(nextSnapshot, actor, action.cardId, card.apCost);
      applyRecovery(nextSnapshot, target, action.resourceType, 1);
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 使用〈${card.nameZh}〉，讓 ${target.seatId} 回復 1 ${action.resourceType}` };
    }
    case "card_hold_together": {
      if (!action.targetSeat) fail("INVALID_ACTION_PAYLOAD");
      const target = getPlayerBySeat(nextSnapshot, action.targetSeat);
      if (target.seatId === actor.seatId) fail("TARGET_NOT_REACHABLE");
      if (!actor.positionTileId || actor.positionTileId !== target.positionTileId) fail("TARGET_NOT_REACHABLE");
      consumeActionCard(nextSnapshot, actor, action.cardId, card.apCost);
      applyRecovery(nextSnapshot, actor, "SP", 1);
      applyRecovery(nextSnapshot, target, "SP", 1);
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 使用〈${card.nameZh}〉，與 ${target.seatId} 各回復 1 SP` };
    }
    case "card_focus_the_point": {
      if (!action.resourceType || !nextSnapshot.currentEvent) fail("INVALID_ACTION_PAYLOAD");
      if (action.resourceType === "SR") {
        if (nextSnapshot.currentEvent.requirement.srRequired <= 1) fail("ACTION_CARD_EFFECT_NOT_AVAILABLE");
      } else if (nextSnapshot.currentEvent.requirement.spRequired <= 1) fail("ACTION_CARD_EFFECT_NOT_AVAILABLE");
      consumeActionCard(nextSnapshot, actor, action.cardId, card.apCost);
      if (action.resourceType === "SR") nextSnapshot.currentEvent.requirement.srRequired -= 1;
      else nextSnapshot.currentEvent.requirement.spRequired -= 1;
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 使用〈${card.nameZh}〉，本輪事件 ${action.resourceType} 需求 -1` };
    }
    case "card_respond_together": {
      if (!nextSnapshot.currentEvent || !action.targetSeat || !action.resourceType || !action.teammateResourceType) fail("INVALID_ACTION_PAYLOAD");
      const target = getPlayerBySeat(nextSnapshot, action.targetSeat);
      if (target.seatId === actor.seatId) fail("TARGET_NOT_REACHABLE");
      if (!actor.positionTileId || !target.positionTileId) fail("TILE_NOT_FOUND");
      if (!areTilesSameOrAdjacent(nextSnapshot.mapTiles, actor.positionTileId, target.positionTileId)) fail("TARGET_NOT_REACHABLE");
      if (target.perRoundFlags.hasInvestedEvent) fail("EVENT_INVEST_LIMIT_REACHED");
      const totals = getContributionTotals(nextSnapshot.currentEvent);
      let remainingSr = Math.max(0, nextSnapshot.currentEvent.requirement.srRequired - totals.sr);
      let remainingSp = Math.max(0, nextSnapshot.currentEvent.requirement.spRequired - totals.sp);
      const actorSr = action.resourceType === "SR" ? 1 : 0;
      const actorSp = action.resourceType === "SP" ? 1 : 0;
      const mateSr = action.teammateResourceType === "SR" ? 1 : 0;
      const mateSp = action.teammateResourceType === "SP" ? 1 : 0;
      if (actor.currentSr < actorSr || actor.currentSp < actorSp || target.currentSr < mateSr || target.currentSp < mateSp) fail("INSUFFICIENT_RESOURCE");
      if (actorSr > remainingSr || actorSp > remainingSp) fail("EVENT_REQUIREMENT_EXCEEDED");
      remainingSr -= actorSr; remainingSp -= actorSp;
      if (mateSr > remainingSr || mateSp > remainingSp) fail("EVENT_REQUIREMENT_EXCEEDED");
      consumeActionCard(nextSnapshot, actor, action.cardId, card.apCost);
      actor.currentSr -= actorSr; actor.currentSp -= actorSp;
      target.currentSr -= mateSr; target.currentSp -= mateSp;
      actor.perRoundFlags.hasInvestedEvent = true;
      target.perRoundFlags.hasInvestedEvent = true;
      nextSnapshot.currentEvent.contributions.push({ seatId: actor.seatId, srPaid: actorSr, spPaid: actorSp, srCounted: actorSr, spCounted: actorSp });
      nextSnapshot.currentEvent.contributions.push({ seatId: target.seatId, srPaid: mateSr, spPaid: mateSp, srCounted: mateSr, spCounted: mateSp });
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 使用〈${card.nameZh}〉，與 ${target.seatId} 共同投入事件` };
    }
    default:
      fail("UNSUPPORTED_ACTION");
  }
}


function advanceAfterTurn(snapshot: GameSnapshot, actorSeat: SeatId) {
  snapshot.turnContext.perSeat[actorSeat].hasEndedTurn = true;
  if (!snapshot.turnContext.actedSeatOrder.includes(actorSeat)) snapshot.turnContext.actedSeatOrder.push(actorSeat);
  const remaining = snapshot.turnOrder.filter((seatId) => !snapshot.turnContext.perSeat[seatId].hasEndedTurn);
  if (remaining.length > 0) {
    snapshot.activeSeat = remaining[0];
    return { nextActiveSeat: remaining[0], movedToCampfire: false };
  }
  snapshot.activeSeat = null;
  snapshot.phase = "campfire";
  return { nextActiveSeat: null, movedToCampfire: true };
}

function handleDiscardCards(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "discard_cards" }>; at: string }) {
  const { snapshot, action, at } = params;
  if (!snapshot.blockingWindow || snapshot.blockingWindow.kind !== "discard") fail("DISCARD_WINDOW_NOT_FOUND");
  const windowState = snapshot.blockingWindow;
  if (windowState.targetSeat !== action.actorSeat) fail("DISCARD_NOT_OWNER");
  if (action.discardedCardIds.length !== windowState.requiredDiscardCount) fail("DISCARD_COUNT_MISMATCH");
  const nextSnapshot = cloneSnapshot(snapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  for (const cardId of action.discardedCardIds) {
    if (!actor.handCardIds.includes(cardId)) fail("CARD_NOT_IN_HAND");
  }
  for (const cardId of action.discardedCardIds) {
    actor.handCardIds = actor.handCardIds.filter((id) => id !== cardId);
    nextSnapshot.discardPile.push(cardId);
  }
  nextSnapshot.blockingWindow = null;
  const advanced = advanceAfterTurn(nextSnapshot, actor.seatId);
  nextSnapshot.updatedAt = at;
  if (advanced.movedToCampfire) {
    return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 完成棄牌，所有玩家已完成本輪行動，進入營火階段` };
  }
  return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 完成棄牌，輪到 ${advanced.nextActiveSeat}` };
}

function handleEndTurn(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "end_turn" }>; at: string }) {
  const { snapshot, action, at } = params;
  requireActiveSeat(snapshot, action.actorSeat);
  const nextSnapshot = cloneSnapshot(snapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  const drawnCardId = drawActionCard(nextSnapshot, actor);
  const drawMessageZh = drawnCardId ? "並抽 1 張牌" : "，但因手牌已滿未抽牌";
  const advanced = advanceAfterTurn(nextSnapshot, actor.seatId);
  nextSnapshot.updatedAt = at;
  if (advanced.movedToCampfire) return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 已結束回合${drawMessageZh}，所有玩家已完成本輪行動，進入營火階段` };
  return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 已結束回合${drawMessageZh}，輪到 ${advanced.nextActiveSeat}` };
}

function handleUseCompanionToken(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "use_companion_token" }>; at: string }) {
  const { snapshot, action, at } = params;
  const nextSnapshot = cloneSnapshot(snapshot);
  const windowState = getLossWindow(nextSnapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  if (windowState.targetSeat === actor.seatId) fail("LOSS_REACTION_SELF_TARGET");
  if (!windowState.eligibleCompanionSeatIds.includes(actor.seatId)) fail("LOSS_REACTION_NOT_ELIGIBLE");
  if (windowState.companionUsed) fail("COMPANION_ALREADY_USED");
  if (actor.companionTokensRemaining < 1) fail("NO_COMPANION_TOKEN_LEFT");
  if (action.mode === "prevent") {
    const resource = action.preventResource;
    if (!resource) fail("INVALID_PREVENT_RESOURCE");
    if (resource === "SR" && windowState.srLoss <= 0) fail("INVALID_PREVENT_RESOURCE");
    if (resource === "SP" && windowState.spLoss <= 0) fail("INVALID_PREVENT_RESOURCE");
    windowState.companionReaction = { type: "prevent", usedBySeat: actor.seatId, preventResource: resource };
  } else {
    windowState.companionReaction = { type: "comfort", usedBySeat: actor.seatId };
  }
  windowState.companionUsed = true;
  actor.companionTokensRemaining -= 1;
  nextSnapshot.updatedAt = at;
  return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 使用陪伴標記介入本次損失` };
}

function handleFinalizePendingLoss(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "finalize_pending_loss" }>; at: string }) {
  const { snapshot, action, at } = params;
  const nextSnapshot = cloneSnapshot(snapshot);
  const windowState = getLossWindow(nextSnapshot);
  const actor = getPlayerBySeat(nextSnapshot, action.actorSeat);
  if (actor.seatId !== windowState.targetSeat && !windowState.eligibleCompanionSeatIds.includes(actor.seatId)) {
    fail("LOSS_REACTION_NOT_ELIGIBLE");
  }
  const target = getPlayerBySeat(nextSnapshot, windowState.targetSeat);
  let srLoss = windowState.srLoss;
  let spLoss = windowState.spLoss;
  if (windowState.companionReaction?.type === "prevent") {
    if (windowState.companionReaction.preventResource === "SR") srLoss = Math.max(0, srLoss - 1);
    if (windowState.companionReaction.preventResource === "SP") spLoss = Math.max(0, spLoss - 1);
  }

  const redirectedAmount = windowState.merchantGuardSeat && srLoss > 0 ? 1 : 0;
  target.currentSr = Math.max(0, target.currentSr - Math.max(0, srLoss - redirectedAmount));
  if (windowState.merchantGuardSeat) {
    applyMerchantGuardRedirect({
      snapshot: nextSnapshot,
      originalTargetSeat: target.seatId,
      redirectedSeat: windowState.merchantGuardSeat,
      redirectedAmount,
    });
  }

  target.currentSp = Math.max(0, target.currentSp - spLoss);
  if (windowState.companionReaction?.type === "comfort") {
    recoverResource(target, "SP", 1, nextSnapshot.roomConfig);
  }

  const hadNext = openNextLossWindow(nextSnapshot);
  const messageParts = [
    `${action.actorSeat} 完成本次損失處理`,
    windowState.merchantGuardSeat ? `${windowState.merchantGuardSeat} 已代為承受 1 點 SR。` : "",
  ].filter(Boolean);

  if (hadNext) {
    messageParts.push("切換到下一筆損失");
  } else if (nextSnapshot.pendingCampfireResolution) {
    const continued = continueCampfireAfterLosses(nextSnapshot);
    if (continued.storytellerMessageZh) messageParts.push(continued.storytellerMessageZh);
    if (continued.finalState?.finalReasonZh) messageParts.push(continued.finalState.finalReasonZh);
    messageParts.push(continued.messageZh);
  }

  nextSnapshot.updatedAt = at;
  return { snapshot: nextSnapshot, messageZh: messageParts.join("，") };
}

function handleDeclareTask(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "declare_task" }>; at: string }) {
  const { snapshot, action, at } = params;
  const nextSnapshot = cloneSnapshot(snapshot);
  if (nextSnapshot.tasks.some((task) => task.declaredAtRound === nextSnapshot.round && task.completionCheckedByHost)) fail("TASK_ALREADY_DECLARED_THIS_ROUND");
  const task = nextSnapshot.tasks.find((item) => item.taskId === action.taskId);
  if (!task) fail("TASK_NOT_FOUND");
  if (task.declaredAtRound !== null && task.completionCheckedByHost) fail("TASK_ALREADY_COMPLETED");
  const verification = verifyTaskDeclaration(nextSnapshot, task);
  if (!verification.ok) fail(verification.code);
  task.declaredAtRound = nextSnapshot.round;
  task.declaredBySeat = action.actorSeat;
  task.completionCheckedByHost = true;
  task.rewardGrantedAtRound = nextSnapshot.round;
  nextSnapshot.pendingTaskReview = null;
  const reward = applyTaskReward({ snapshot: nextSnapshot, task });
  nextSnapshot.updatedAt = at;
  return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 已完成任務〈${task.nameZh}〉。${reward.rewardSummaryZh}` };
}

function handleResolveRoleAbility(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "resolve_role_ability" }>; at: string }) {
  const { snapshot, action, at } = params;
  const nextSnapshot = cloneSnapshot(snapshot);
  const windowState = getAbilityWindow(nextSnapshot);
  if (windowState.actorSeat !== action.actorSeat) fail("ABILITY_RESPONSE_NOT_ELIGIBLE");
  if (windowState.abilityId !== action.abilityId) fail("INVALID_ACTION_PAYLOAD");

  if (windowState.abilityId === "merchant_guard") {
    const guard = getPlayerBySeat(nextSnapshot, action.actorSeat);
    if (action.mode === "use") {
      const applied = applyMerchantGuardSelection({ snapshot: nextSnapshot, guardSeat: guard.seatId });
      if (!applied.applied) fail("ABILITY_RESPONSE_NOT_ELIGIBLE");
      nextSnapshot.blockingWindow = buildLossWindowFromQueueItem({
        lossChainId: windowState.loss.lossChainId,
        targetSeat: windowState.loss.targetSeat,
        srLoss: windowState.loss.srLoss,
        spLoss: windowState.loss.spLoss,
        eligibleCompanionSeatIds: windowState.loss.eligibleCompanionSeatIds,
        sourceType: windowState.loss.sourceType,
        sourceLabelZh: windowState.loss.sourceLabelZh,
      }, guard.seatId);
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${guard.seatId} 發動〈穩住陣腳〉，將由自己承受 1 點 SR。` };
    }

    if (windowState.remainingResponderSeatIds.length > 0) {
      nextSnapshot.blockingWindow = {
        ...windowState,
        actorSeat: windowState.remainingResponderSeatIds[0],
        remainingResponderSeatIds: windowState.remainingResponderSeatIds.slice(1),
      };
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 略過〈穩住陣腳〉，改由下一位符合條件的護衛決定。` };
    }

    if (windowState.fallbackAiSeatId) {
      const applied = applyMerchantGuardSelection({ snapshot: nextSnapshot, guardSeat: windowState.fallbackAiSeatId });
      nextSnapshot.blockingWindow = buildLossWindowFromQueueItem({
        lossChainId: windowState.loss.lossChainId,
        targetSeat: windowState.loss.targetSeat,
        srLoss: windowState.loss.srLoss,
        spLoss: windowState.loss.spLoss,
        eligibleCompanionSeatIds: windowState.loss.eligibleCompanionSeatIds,
        sourceType: windowState.loss.sourceType,
        sourceLabelZh: windowState.loss.sourceLabelZh,
      }, applied.applied ? windowState.fallbackAiSeatId : null);
      nextSnapshot.updatedAt = at;
      return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 略過〈穩住陣腳〉，進入損失結算。` };
    }

    nextSnapshot.blockingWindow = buildLossWindowFromQueueItem({
      lossChainId: windowState.loss.lossChainId,
      targetSeat: windowState.loss.targetSeat,
      srLoss: windowState.loss.srLoss,
      spLoss: windowState.loss.spLoss,
      eligibleCompanionSeatIds: windowState.loss.eligibleCompanionSeatIds,
      sourceType: windowState.loss.sourceType,
      sourceLabelZh: windowState.loss.sourceLabelZh,
    });
    nextSnapshot.updatedAt = at;
    return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 略過〈穩住陣腳〉，進入損失結算。` };
  }

  if (windowState.abilityId === "square_storyteller") {
    let abilityMessageZh = "";
    if (action.mode === "use") {
      if (!action.targetSeat || !windowState.candidateSeatIds.includes(action.targetSeat)) fail("ABILITY_TARGET_NOT_VALID");
      const applied = applyStorytellerRecoverySelection({ snapshot: nextSnapshot, targetSeat: action.targetSeat });
      if (!applied.applied) fail("ABILITY_TARGET_NOT_VALID");
      abilityMessageZh = applied.messageZh;
    }
    nextSnapshot.blockingWindow = null;
    const finalState = applyCampfireFinalStep(nextSnapshot);
    const messageParts = [
      action.mode === "skip" ? `${action.actorSeat} 略過〈協調分工〉。` : abilityMessageZh,
      finalState.finalReasonZh ?? "",
      finalState.movedToGameover ? "本局進入遊戲結束。" : "本輪營火結算完成，回到危機階段。",
    ].filter(Boolean);
    nextSnapshot.updatedAt = at;
    return { snapshot: nextSnapshot, messageZh: messageParts.join(" ") };
  }

  fail("ABILITY_WINDOW_NOT_FOUND");
}

function handleUpdateRoomConfig(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "update_room_config" }>; at: string }) {
  const { snapshot, action, at } = params;
  const nextSnapshot = cloneSnapshot(snapshot);
  const patch = action.patch;
  const touchesLobbyLockedConfig = Boolean(
    patch.aiSeatIds
    || patch.resourceCapMode !== undefined
    || patch.actionDeckProfileId
    || patch.eventPoolProfileId
    || patch.taskPoolProfileId,
  );
  if (touchesLobbyLockedConfig && nextSnapshot.phase !== "lobby") fail("AI_SEAT_CONFIG_LOCKED");
  if (patch.actionDeckProfileId && !ACTION_DECK_PROFILE_MAP[patch.actionDeckProfileId]) fail("ROOM_CONFIG_PATCH_INVALID");
  if (patch.eventPoolProfileId && !EVENT_POOL_PROFILE_MAP[patch.eventPoolProfileId]) fail("ROOM_CONFIG_PATCH_INVALID");
  if (patch.taskPoolProfileId && !TASK_POOL_PROFILE_MAP[patch.taskPoolProfileId]) fail("TASK_NOT_FOUND");
  nextSnapshot.roomConfig = {
    ...nextSnapshot.roomConfig,
    ...(patch.newcomerGuideEnabled !== undefined ? { newcomerGuideEnabled: patch.newcomerGuideEnabled } : {}),
    ...(patch.observerModeEnabled !== undefined ? { observerModeEnabled: patch.observerModeEnabled } : {}),
    ...(patch.actionLogEnabled !== undefined ? { actionLogEnabled: patch.actionLogEnabled } : {}),
    ...(patch.aiSimulationModeEnabled !== undefined ? { aiSimulationModeEnabled: patch.aiSimulationModeEnabled } : {}),
    ...(patch.replayEnabled !== undefined ? { replayEnabled: patch.replayEnabled } : {}),
    ...(patch.resourceCapMode !== undefined ? { resourceCapMode: patch.resourceCapMode } : {}),
    ...(patch.actionDeckProfileId ? { actionDeckProfileId: patch.actionDeckProfileId } : {}),
    ...(patch.eventPoolProfileId ? { eventPoolProfileId: patch.eventPoolProfileId } : {}),
    ...(patch.taskPoolProfileId ? { taskPoolProfileId: patch.taskPoolProfileId } : {}),
    ...(patch.aiSeatIds ? { aiSeatIds: Array.from(new Set(patch.aiSeatIds)).sort() as SeatId[] } : {}),
    cardToggles: { ...nextSnapshot.roomConfig.cardToggles, ...(patch.cardToggles ?? {}) },
    roleAbilityToggles: { ...nextSnapshot.roomConfig.roleAbilityToggles, ...(patch.roleAbilityToggles ?? {}) },
    experimentalRuleToggles: { ...nextSnapshot.roomConfig.experimentalRuleToggles, ...(patch.experimentalRuleToggles ?? {}) },
  };
  if (patch.aiSeatIds) {
    syncAiSeatsInLobby(nextSnapshot);
  }
  normalizeCardPoolsAgainstToggles(nextSnapshot);
  nextSnapshot.updatedAt = at;
  const messageParts: string[] = [];
  if (patch.aiSeatIds) messageParts.push("AI 補位座位");
  if (patch.resourceCapMode !== undefined) messageParts.push("資源上限模式");
  if (patch.actionDeckProfileId) messageParts.push("行動牌池");
  if (patch.eventPoolProfileId) messageParts.push("事件池");
  if (patch.taskPoolProfileId) messageParts.push("任務池");
  if (patch.newcomerGuideEnabled !== undefined || patch.observerModeEnabled !== undefined || patch.actionLogEnabled !== undefined || patch.aiSimulationModeEnabled !== undefined || patch.replayEnabled !== undefined) {
    messageParts.push("系統開關");
  }
  if (patch.experimentalRuleToggles) messageParts.push("實驗規則");
  return { snapshot: nextSnapshot, messageZh: `${action.actorSeat} 已更新${messageParts.length > 0 ? messageParts.join("、") : "房間設定"}` };
}

function handleRunAiTurn(params: { snapshot: GameSnapshot; action: Extract<RoomAction, { type: "run_ai_turn" }>; at: string }): ReducerResult {
  const { snapshot, at } = params;
  const aiAction = chooseAiStep(snapshot);
  if (!aiAction) fail("AI_STEP_NOT_AVAILABLE");
  const reduced = applyReducer({ snapshot, action: aiAction, at });
  return {
    snapshot: reduced.snapshot,
    messageZh: `AI 補位執行：${reduced.messageZh}`,
    logActorSeat: aiAction.actorSeat,
    logAction: aiAction,
  };
}

function handleResolveCampfire(params: { snapshot: GameSnapshot; at: string }) {
  const { snapshot, at } = params;
  if (snapshot.phase !== "campfire") fail("INVALID_PHASE");
  if (snapshot.blockingWindow) fail("CAMPFIRE_BLOCKING_WINDOW_PENDING");
  const nextSnapshot = cloneSnapshot(snapshot);
  const eventResult = resolveCurrentEvent(nextSnapshot);
  const riskLosses = buildRiskLosses(nextSnapshot);
  nextSnapshot.pendingLossQueue = [...eventResult.queuedLosses, ...riskLosses];
  nextSnapshot.pendingCampfireResolution = {
    stage: "resolve_event",
    pendingPressureDelta: eventResult.pressureDelta,
    eventResolved: eventResult.eventResolved,
    summaryZh: eventResult.summaryZh,
  };
  let messageZh = eventResult.summaryZh;
  if (nextSnapshot.pendingLossQueue.length > 0) {
    setPendingCampfireStage(nextSnapshot, "resolve_losses", `${eventResult.summaryZh} 接著處理營火損失。`);
    openNextLossWindow(nextSnapshot);
    messageZh += ` 已建立 ${eventResult.queuedLosses.length + riskLosses.length} 筆損失處理。`;
  } else {
    const continued = continueCampfireAfterLosses(nextSnapshot);
    if (continued.storytellerMessageZh) messageZh += ` ${continued.storytellerMessageZh}`;
    if (continued.finalState?.finalReasonZh) messageZh += ` ${continued.finalState.finalReasonZh}`;
    messageZh += continued.pausedForAbility ? ` 目前等待角色技能回應。` : continued.finalState?.movedToGameover ? ` 本局進入遊戲結束。` : ` 本輪營火結算完成，回到危機階段。`;
  }
  nextSnapshot.updatedAt = at;
  return { snapshot: nextSnapshot, messageZh };
}

function applyReducer(params: { snapshot: GameSnapshot; action: RoomAction; at: string }): ReducerResult {
  const { snapshot, action, at } = params;
  switch (action.type) {
    case "assign_role":
      return handleAssignRole({ snapshot, action, at });
    case "start_game":
      return handleStartGame({ snapshot, at });
    case "start_round":
      return handleStartRound({ snapshot, at });
    case "move":
      return handleMove({ snapshot, action, at });
    case "use_station_or_shelter":
      return handleUseStationOrShelter({ snapshot, action, at });
    case "invest_event":
      return handleInvestEvent({ snapshot, action, at });
    case "adjacent_help":
      return handleAdjacentHelp({ snapshot, action, at });
    case "play_action_card":
      return handlePlayActionCard({ snapshot, action, at });
    case "end_turn":
      return handleEndTurn({ snapshot, action, at });
    case "discard_cards":
      return handleDiscardCards({ snapshot, action, at });
    case "use_companion_token":
      return handleUseCompanionToken({ snapshot, action, at });
    case "finalize_pending_loss":
      return handleFinalizePendingLoss({ snapshot, action, at });
    case "declare_task":
      return handleDeclareTask({ snapshot, action, at });
    case "resolve_role_ability":
      return handleResolveRoleAbility({ snapshot, action, at });
    case "run_ai_turn":
      return handleRunAiTurn({ snapshot, action, at });
    case "resolve_campfire":
      return handleResolveCampfire({ snapshot, at });
    case "update_room_config":
      return handleUpdateRoomConfig({ snapshot, action, at });
    default:
      fail("UNSUPPORTED_ACTION");
  }
}

export function applyRoomActionReducer(params: { snapshot: GameSnapshot; action: RoomAction; at: string }): ReducerResult {
  return applyReducer(params);
}

export async function applyRoomActionService(params: {
  client: SupabaseClient;
  roomCode: string;
  joinToken: string;
  action: RoomAction;
}): Promise<ApplyRoomActionServiceResult> {
  const { client, roomCode, joinToken, action } = params;
  const at = new Date().toISOString();
  try {
    const room = await findRoomByCode({ client, roomCode });
    if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
    const latestSnapshot = await getLatestRoomSnapshot({ client, roomId: room.id });
    if (!latestSnapshot) return { ok: false, error: "SNAPSHOT_NOT_FOUND" };
    const resolved = await resolveRoomActor({ client, roomCode, joinToken });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    if (resolved.actor.isObserver) return { ok: false, error: "OBSERVER_CANNOT_ACT" };
    if (action.type !== "run_ai_turn" && action.actorSeat !== resolved.actor.seatId) return { ok: false, error: "FORGED_SEAT_ACTION" };
    const hostError = requireHostAction(action, resolved.actor.isHost);
    if (hostError) return { ok: false, error: hostError };
    const statusBefore = summarizeSnapshotForLog(latestSnapshot.snapshot_json);
    const reduced = applyReducer({ snapshot: latestSnapshot.snapshot_json, action, at });
    if (action.type === "assign_role") {
      await updateAssignedRoleIdForSeat({ client, roomId: room.id, seatId: action.targetSeat, roleId: action.roleId, at });
    }
    const nextVersion = latestSnapshot.version + 1;
    reduced.snapshot.roomRevision = nextVersion;
    reduced.snapshot.updatedAt = at;
    let persistedActionLogEntry = null;
    if (reduced.snapshot.roomConfig.actionLogEnabled) {
      persistedActionLogEntry = appendActionLogEntry({
        snapshot: reduced.snapshot,
        action: reduced.logAction ?? action,
        actorSeat: reduced.logActorSeat ?? resolved.actor.seatId!,
        at,
        messageZh: reduced.messageZh,
        statusBefore,
      });
    }
    await insertRoomSnapshot({ client, roomId: room.id, version: nextVersion, snapshot: reduced.snapshot });
    if (persistedActionLogEntry) {
      await insertRoomActionLog({ client, roomId: room.id, entry: persistedActionLogEntry });
    }
    await updateRoomVersionAndState({
      client,
      roomId: room.id,
      version: nextVersion,
      status: reduced.snapshot.status,
      phase: reduced.snapshot.phase,
      round: reduced.snapshot.round,
      updatedAt: at,
    });
    return {
      ok: true,
      snapshot: reduced.snapshot,
      version: nextVersion,
      logEntry: { actionType: action.type, messageZh: reduced.messageZh, at },
    };
  } catch (error) {
    const code = error instanceof Error ? (error.message as RoomServiceErrorCode) : "UNKNOWN_ACTION_ERROR";
    return { ok: false, error: code };
  }
}


export const __TESTING__ = {
  applyReducer,
};
