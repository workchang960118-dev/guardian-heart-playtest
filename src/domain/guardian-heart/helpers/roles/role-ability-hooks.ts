import type { EventState, GameSnapshot, PendingLossQueueItem, PendingLossWindow, PlayerState, SeatId } from "@/domain/guardian-heart/types/game";
import { getRoleLoadout } from "@/domain/guardian-heart/helpers/roles/role-loadout";
import { areTilesSameOrAdjacent, getTileById } from "@/domain/guardian-heart/helpers/map/tile-lookup";
import { canRecoverResource, recoverResource } from "@/domain/guardian-heart/helpers/resources/resource-policy";

export type InvestConversionMode = "SR_TO_SP" | "SP_TO_SR";
export type RoleAbilityApplication =
  | { applied: false; messageZh?: string }
  | { applied: true; messageZh: string };

export function isRoleAbilityEnabled(snapshot: GameSnapshot, roleId: string | null): boolean {
  if (!roleId) return false;
  return snapshot.roomConfig.roleAbilityToggles[roleId] !== false;
}

export function canUseRangerFreeMove(params: {
  snapshot: GameSnapshot;
  actor: PlayerState;
  fromTileId: string;
  toTileId: string;
}): boolean {
  const { snapshot, actor, fromTileId, toTileId } = params;
  if (actor.roleId !== "ranger_pathfinder") return false;
  if (!isRoleAbilityEnabled(snapshot, actor.roleId)) return false;
  if (actor.roleAbilityUsesRemaining <= 0) return false;
  const fromTile = getTileById(snapshot.mapTiles, fromTileId);
  const toTile = getTileById(snapshot.mapTiles, toTileId);
  if (!fromTile || !toTile) return false;
  return fromTile.kind === "risk" || toTile.kind === "risk";
}

export function applyRangerFreeMove(params: {
  snapshot: GameSnapshot;
  actor: PlayerState;
}): RoleAbilityApplication {
  const { snapshot, actor } = params;
  if (actor.roleId !== "ranger_pathfinder") return { applied: false };
  if (!isRoleAbilityEnabled(snapshot, actor.roleId)) return { applied: false };
  if (actor.roleAbilityUsesRemaining <= 0) return { applied: false };
  actor.roleAbilityUsesRemaining -= 1;
  return { applied: true, messageZh: `${actor.seatId} 發動〈越野突破〉，本次移動不消耗 AP。` };
}

export function canUseMedicBonus(params: {
  snapshot: GameSnapshot;
  actor: PlayerState;
  target: PlayerState;
  resourceType: "SR" | "SP";
}): boolean {
  const { snapshot, actor, target, resourceType } = params;
  if (actor.roleId !== "medic_apprentice" || resourceType !== "SP") return false;
  if (!isRoleAbilityEnabled(snapshot, actor.roleId)) return false;
  if (actor.roleAbilityUsesRemaining <= 0) return false;
  if (!getRoleLoadout(target.roleId)) return false;
  return canRecoverResource(target, "SP", 1, snapshot.roomConfig);
}

export function applyMedicBonus(params: {
  snapshot: GameSnapshot;
  actor: PlayerState;
  target: PlayerState;
}): RoleAbilityApplication {
  const { snapshot, actor, target } = params;
  if (!canUseMedicBonus({ snapshot, actor, target, resourceType: "SP" })) return { applied: false };
  recoverResource(target, "SP", 1, snapshot.roomConfig);
  actor.roleAbilityUsesRemaining -= 1;
  return { applied: true, messageZh: `${actor.seatId} 發動〈安定陪伴〉，${target.seatId} 額外回復 1 SP。` };
}

export function applyBellTowerConversion(params: {
  snapshot: GameSnapshot;
  actor: PlayerState;
  srPaid: number;
  spPaid: number;
  convertOne?: InvestConversionMode;
}): { srCounted: number; spCounted: number; messageZh: string | null } {
  const { snapshot, actor, srPaid, spPaid, convertOne } = params;
  if (actor.roleId !== "bell_tower_observer") {
    return { srCounted: srPaid, spCounted: spPaid, messageZh: null };
  }
  if (!isRoleAbilityEnabled(snapshot, actor.roleId) || actor.roleAbilityUsesRemaining <= 0 || !convertOne) {
    return { srCounted: srPaid, spCounted: spPaid, messageZh: null };
  }
  if (convertOne === "SR_TO_SP" && srPaid >= 1) {
    actor.roleAbilityUsesRemaining -= 1;
    return {
      srCounted: Math.max(0, srPaid - 1),
      spCounted: spPaid + 1,
      messageZh: `${actor.seatId} 發動〈看清局勢〉，將 1 點 SR 改按 SP 計算。`,
    };
  }
  if (convertOne === "SP_TO_SR" && spPaid >= 1) {
    actor.roleAbilityUsesRemaining -= 1;
    return {
      srCounted: srPaid + 1,
      spCounted: Math.max(0, spPaid - 1),
      messageZh: `${actor.seatId} 發動〈看清局勢〉，將 1 點 SP 改按 SR 計算。`,
    };
  }
  return { srCounted: srPaid, spCounted: spPaid, messageZh: null };
}

export function canUseMessengerFollowMove(params: {
  snapshot: GameSnapshot;
  actor: PlayerState;
  target: PlayerState;
  moveSeat: SeatId | undefined;
  moveToTileId: string | undefined;
}): boolean {
  const { snapshot, actor, target, moveSeat, moveToTileId } = params;
  if (actor.roleId !== "alley_messenger") return false;
  if (!isRoleAbilityEnabled(snapshot, actor.roleId)) return false;
  if (actor.roleAbilityUsesRemaining <= 0) return false;
  if (!moveSeat || !moveToTileId) return false;
  if (moveSeat !== actor.seatId && moveSeat !== target.seatId) return false;
  const mover = moveSeat === actor.seatId ? actor : target;
  if (!mover.positionTileId) return false;
  return areTilesSameOrAdjacent(snapshot.mapTiles, mover.positionTileId, moveToTileId) && Boolean(getTileById(snapshot.mapTiles, moveToTileId));
}

export function applyMessengerFollowMove(params: {
  snapshot: GameSnapshot;
  actor: PlayerState;
  target: PlayerState;
  moveSeat: SeatId | undefined;
  moveToTileId: string | undefined;
}): RoleAbilityApplication {
  const { snapshot, actor, target, moveSeat, moveToTileId } = params;
  if (!canUseMessengerFollowMove({ snapshot, actor, target, moveSeat, moveToTileId })) return { applied: false };
  const mover = moveSeat === actor.seatId ? actor : target;
  const tile = moveToTileId ? getTileById(snapshot.mapTiles, moveToTileId) : null;
  if (!tile || !moveToTileId) return { applied: false };
  mover.positionTileId = moveToTileId;
  actor.roleAbilityUsesRemaining -= 1;
  return { applied: true, messageZh: `${actor.seatId} 發動〈牽起連結〉，讓 ${mover.seatId} 立即移動到 ${tile.nameZh}。` };
}

export function getEligibleMerchantGuardsForLoss(params: {
  snapshot: GameSnapshot;
  lossItem: Pick<PendingLossQueueItem, "targetSeat" | "srLoss"> | Pick<PendingLossWindow, "targetSeat" | "srLoss">;
}): PlayerState[] {
  const { snapshot, lossItem } = params;
  if (lossItem.srLoss <= 0) return [];
  const target = snapshot.players.find((player) => player.seatId === lossItem.targetSeat);
  if (!target?.positionTileId) return [];
  return snapshot.players.filter((player) => {
    if (player.roleId !== "merchant_guard") return false;
    if (player.seatId === lossItem.targetSeat) return false;
    if (!isRoleAbilityEnabled(snapshot, player.roleId)) return false;
    if (player.roleAbilityUsesRemaining <= 0) return false;
    if (!player.positionTileId) return false;
    return areTilesSameOrAdjacent(snapshot.mapTiles, player.positionTileId, target.positionTileId!);
  });
}

export function applyMerchantGuardSelection(params: {
  snapshot: GameSnapshot;
  guardSeat: SeatId;
}): RoleAbilityApplication {
  const { snapshot, guardSeat } = params;
  const guard = snapshot.players.find((player) => player.seatId === guardSeat);
  if (!guard || guard.roleId !== "merchant_guard") return { applied: false };
  if (!isRoleAbilityEnabled(snapshot, guard.roleId)) return { applied: false };
  if (guard.roleAbilityUsesRemaining <= 0) return { applied: false };
  guard.roleAbilityUsesRemaining -= 1;
  return { applied: true, messageZh: `${guard.seatId} 發動〈穩住陣腳〉，改由自己承受 1 點 SR。` };
}

export function applyMerchantGuardRedirect(params: {
  snapshot: GameSnapshot;
  originalTargetSeat: SeatId;
  redirectedSeat: SeatId;
  redirectedAmount: number;
}) {
  const { snapshot, originalTargetSeat, redirectedSeat, redirectedAmount } = params;
  if (redirectedAmount <= 0 || originalTargetSeat === redirectedSeat) return;
  const redirectedTarget = snapshot.players.find((player) => player.seatId === redirectedSeat);
  if (!redirectedTarget) return;
  redirectedTarget.currentSr = Math.max(0, redirectedTarget.currentSr - redirectedAmount);
}

export function getStorytellerCandidates(snapshot: GameSnapshot): PlayerState[] {
  const storyteller = snapshot.players.find((player) => player.roleId === "square_storyteller");
  if (!storyteller) return [];
  if (!isRoleAbilityEnabled(snapshot, storyteller.roleId)) return [];
  if (storyteller.roleAbilityUsesRemaining <= 0) return [];
  const event = snapshot.currentEvent;
  if (!event) return [];
  const contributorIds = Array.from(new Set(event.contributions.map((item) => item.seatId)));
  if (contributorIds.length < 2) return [];
  return snapshot.players
    .filter((player) => contributorIds.includes(player.seatId))
    .filter((player) => canRecoverResource(player, "SP", 1, snapshot.roomConfig));
}

export function applyStorytellerRecoverySelection(params: {
  snapshot: GameSnapshot;
  targetSeat: SeatId;
}): RoleAbilityApplication {
  const { snapshot, targetSeat } = params;
  const storyteller = snapshot.players.find((player) => player.roleId === "square_storyteller");
  const target = snapshot.players.find((player) => player.seatId === targetSeat);
  if (!storyteller || !target) return { applied: false };
  if (!isRoleAbilityEnabled(snapshot, storyteller.roleId)) return { applied: false };
  if (storyteller.roleAbilityUsesRemaining <= 0) return { applied: false };
  const candidates = getStorytellerCandidates(snapshot).map((player) => player.seatId);
  if (!candidates.includes(targetSeat)) return { applied: false };
  recoverResource(target, "SP", 1, snapshot.roomConfig);
  storyteller.roleAbilityUsesRemaining -= 1;
  return { applied: true, messageZh: `${storyteller.seatId} 發動〈協調分工〉，令 ${target.seatId} 回復 1 SP。` };
}
