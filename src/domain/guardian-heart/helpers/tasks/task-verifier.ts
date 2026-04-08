import type { GameSnapshot, TaskState } from "@/domain/guardian-heart/types/game";

export type TaskVerificationFailureCode =
  | "TASK_DECLARATION_LOCKED"
  | "TASK_REQUIRES_STATION_AND_SR"
  | "TASK_REQUIRES_SHELTER_AND_SP"
  | "TASK_REQUIRES_TWO_ADJACENT_HELPS"
  | "TASK_REQUIRES_EVENT_RESOLVED_AND_NO_RISK"
  | "TASK_REQUIRES_THREE_ON_SAME_TILE"
  | "TASK_REQUIRES_SR_AND_SP_HELP";

export type TaskVerificationResult =
  | { ok: true }
  | { ok: false; code: TaskVerificationFailureCode; messageZh: string };

function getRiskTileIds(snapshot: GameSnapshot): Set<string> {
  return new Set(snapshot.mapTiles.filter((tile) => tile.kind === "risk").map((tile) => tile.tileId));
}

function getCountOnTile(snapshot: GameSnapshot): number {
  const counts = new Map<string, number>();
  for (const player of snapshot.players) {
    if (!player.positionTileId) continue;
    counts.set(player.positionTileId, (counts.get(player.positionTileId) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

function isCurrentEventResolved(snapshot: GameSnapshot): boolean {
  if (!snapshot.currentEvent) return false;
  const sr = snapshot.currentEvent.contributions.reduce((sum, item) => sum + item.srCounted, 0);
  const sp = snapshot.currentEvent.contributions.reduce((sum, item) => sum + item.spCounted, 0);
  return sr >= snapshot.currentEvent.requirement.srRequired && sp >= snapshot.currentEvent.requirement.spRequired;
}

export function verifyTaskDeclaration(snapshot: GameSnapshot, task: TaskState): TaskVerificationResult {
  if (snapshot.phase !== "campfire" || snapshot.blockingWindow) {
    return { ok: false, code: "TASK_DECLARATION_LOCKED", messageZh: "目前不是可宣告任務的時機。" };
  }

  if (snapshot.pressure >= 6 && snapshot.flags.adjacentHelpPairsThisRound.length === 0) {
    return {
      ok: false,
      code: "TASK_DECLARATION_LOCKED",
      messageZh: "壓力已達 6，本輪若沒有發生過 0AP 相鄰互助，不能宣告任務。",
    };
  }

  const riskTileIds = getRiskTileIds(snapshot);
  const helpCount = snapshot.flags.adjacentHelpPairsThisRound.length;
  const helpResources = new Set(snapshot.flags.adjacentHelpResourceTypesThisRound ?? []);

  switch (task.taskId) {
    case "task_temporary_supply_line": {
      const hasStationPlayer = snapshot.players.some((p) => snapshot.mapTiles.find((t) => t.tileId === p.positionTileId)?.kind === "station");
      const srEnough = snapshot.players.filter((p) => p.currentSr >= 3).length >= 2;
      return hasStationPlayer && srEnough
        ? { ok: true }
        : { ok: false, code: "TASK_REQUIRES_STATION_AND_SR", messageZh: "需至少 1 名玩家位於物資站，且全隊至少有 2 名玩家的 SR 不低於 3，才能宣告〈臨時補給線〉。" };
    }
    case "task_comfort_circle": {
      const hasShelterPlayer = snapshot.players.some((p) => snapshot.mapTiles.find((t) => t.tileId === p.positionTileId)?.kind === "shelter");
      const spEnough = snapshot.players.filter((p) => p.currentSp >= 3).length >= 2;
      return hasShelterPlayer && spEnough
        ? { ok: true }
        : { ok: false, code: "TASK_REQUIRES_SHELTER_AND_SP", messageZh: "需至少 1 名玩家位於庇護所，且全隊至少有 2 名玩家的 SP 不低於 3，才能宣告〈安心陪伴圈〉。" };
    }
    case "task_neighborhood_relay":
      return helpCount >= 2
        ? { ok: true }
        : { ok: false, code: "TASK_REQUIRES_TWO_ADJACENT_HELPS", messageZh: "本輪至少要發生 2 次 0AP 相鄰互助，才能宣告〈街坊接力〉。" };
    case "task_crisis_control":
      return isCurrentEventResolved(snapshot) && snapshot.players.every((p) => !p.positionTileId || !riskTileIds.has(p.positionTileId))
        ? { ok: true }
        : { ok: false, code: "TASK_REQUIRES_EVENT_RESOLVED_AND_NO_RISK", messageZh: "本輪事件需成功解決，且無人位於風險地格，才能宣告〈危機控管〉。" };
    case "task_small_gathering_point":
      return getCountOnTile(snapshot) >= 3
        ? { ok: true }
        : { ok: false, code: "TASK_REQUIRES_THREE_ON_SAME_TILE", messageZh: "至少 3 名玩家位於同一地格，才能宣告〈安置小聚點〉。" };
    case "task_support_network_formed":
      return helpCount >= 2 && helpResources.has("SR") && helpResources.has("SP")
        ? { ok: true }
        : { ok: false, code: "TASK_REQUIRES_SR_AND_SP_HELP", messageZh: "本輪需至少發生 2 次 0AP 相鄰互助，且 SR 與 SP 互助各至少 1 次，才能宣告〈支援網成形〉。" };
    default:
      return { ok: false, code: "TASK_DECLARATION_LOCKED", messageZh: `目前無法宣告任務〈${task.nameZh}〉。` };
  }
}
