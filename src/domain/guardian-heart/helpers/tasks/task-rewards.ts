import type { GameSnapshot, PlayerState, TaskState } from "@/domain/guardian-heart/types/game";
import { drawActionCard } from "@/domain/guardian-heart/helpers/cards/action-deck";
import { canRecoverResource, recoverResource } from "@/domain/guardian-heart/helpers/resources/resource-policy";

function getRecoveryCapacity(snapshot: GameSnapshot, player: PlayerState, resource: "SR" | "SP"): number {
  if (!canRecoverResource(player, resource, 1, snapshot.roomConfig)) return 0;
  if (snapshot.roomConfig.resourceCapMode === "uncapped") return 999;
  const before = resource === "SR" ? player.currentSr : player.currentSp;
  const clone = structuredClone(player);
  recoverResource(clone, resource, 999, snapshot.roomConfig);
  const after = resource === "SR" ? clone.currentSr : clone.currentSp;
  return Math.max(0, after - before);
}

function recoverPlayer(snapshot: GameSnapshot, player: PlayerState, resource: "SR" | "SP", amount: number) {
  return recoverResource(player, resource, amount, snapshot.roomConfig) > 0;
}

function pickPlayersNeeding(snapshot: GameSnapshot, resource: "SR" | "SP", count: number): PlayerState[] {
  return [...snapshot.players]
    .sort((a, b) => getRecoveryCapacity(snapshot, b, resource) - getRecoveryCapacity(snapshot, a, resource))
    .filter((p) => getRecoveryCapacity(snapshot, p, resource) > 0)
    .slice(0, count);
}

function pickPlayersForChoice(snapshot: GameSnapshot, count: number): Array<{ player: PlayerState; resource: "SR" | "SP" }> {
  return [...snapshot.players]
    .map((player) => {
      const srNeed = getRecoveryCapacity(snapshot, player, "SR");
      const spNeed = getRecoveryCapacity(snapshot, player, "SP");
      return { player, resource: srNeed >= spNeed ? "SR" : "SP", need: Math.max(srNeed, spNeed) };
    })
    .filter((item) => item.need > 0)
    .sort((a, b) => b.need - a.need)
    .slice(0, count)
    .map(({ player, resource }) => ({ player, resource: resource as "SR" | "SP" }));
}

export function applyTaskReward(params: { snapshot: GameSnapshot; task: TaskState }): { rewardSummaryZh: string } {
  const { snapshot, task } = params;
  const reward = task.rewardSpec;
  switch (reward.type) {
    case "recover_declared_seat": {
      const target = task.declaredBySeat ? snapshot.players.find((player) => player.seatId === task.declaredBySeat) ?? null : null;
      if (!target || !recoverPlayer(snapshot, target, reward.resource, reward.amount)) {
        return { rewardSummaryZh: `任務〈${task.nameZh}〉已核准，但目前無可套用的回復目標。` };
      }
      return { rewardSummaryZh: `任務〈${task.nameZh}〉獎勵生效：${target.seatId} 回復 ${reward.amount}${reward.resource}。` };
    }
    case "recover_all_players": {
      let recovered = 0;
      for (const player of snapshot.players) if (recoverPlayer(snapshot, player, reward.resource, reward.amount)) recovered += 1;
      return { rewardSummaryZh: recovered > 0 ? `任務〈${task.nameZh}〉獎勵生效：全隊各回復 ${reward.amount}${reward.resource}。` : `任務〈${task.nameZh}〉已核准，但目前無可回復的 ${reward.resource}。` };
    }
    case "recover_event_contributors": {
      const contributorSeats = new Set(snapshot.currentEvent?.contributions.map((item) => item.seatId) ?? []);
      let recovered = 0;
      for (const player of snapshot.players) {
        if (!contributorSeats.has(player.seatId)) continue;
        if (recoverPlayer(snapshot, player, reward.resource, reward.amount)) recovered += 1;
      }
      return { rewardSummaryZh: recovered > 0 ? `任務〈${task.nameZh}〉獎勵生效：本輪事件投入者各回復 ${reward.amount}${reward.resource}。` : `任務〈${task.nameZh}〉已核准，但目前沒有可回復的事件投入者。` };
    }
    case "reduce_pressure": {
      const before = snapshot.pressure;
      snapshot.pressure = Math.max(0, snapshot.pressure - reward.amount);
      return { rewardSummaryZh: before !== snapshot.pressure ? `任務〈${task.nameZh}〉獎勵生效：壓力 -${before - snapshot.pressure}。` : `任務〈${task.nameZh}〉已核准，但目前壓力已為 0。` };
    }
    case "draw_cards_all_players": {
      for (const player of snapshot.players) for (let i = 0; i < reward.amount; i += 1) drawActionCard(snapshot, player);
      return { rewardSummaryZh: `任務〈${task.nameZh}〉獎勵生效：全體玩家各抽 ${reward.amount} 張行動卡。` };
    }
    case "recover_two_players": {
      const targets = pickPlayersNeeding(snapshot, reward.resource, 2);
      let recovered = 0;
      for (const target of targets) if (recoverPlayer(snapshot, target, reward.resource, reward.amount)) recovered += 1;
      return { rewardSummaryZh: recovered > 0 ? `任務〈${task.nameZh}〉獎勵生效：指定 2 名最需要的玩家各回復 ${reward.amount}${reward.resource}。` : `任務〈${task.nameZh}〉已核准，但目前沒有需要回復 ${reward.resource} 的玩家。` };
    }
    case "recover_two_players_choice": {
      const targets = pickPlayersForChoice(snapshot, 2);
      let recovered = 0;
      for (const { player, resource } of targets) if (recoverPlayer(snapshot, player, resource, reward.amount)) recovered += 1;
      return { rewardSummaryZh: recovered > 0 ? `任務〈${task.nameZh}〉獎勵生效：指定 2 名最需要的玩家，各回復 1 點較缺的資源。` : `任務〈${task.nameZh}〉已核准，但目前沒有適合回復的玩家。` };
    }
    case "recover_two_players_and_draw_declared_seat": {
      const targets = pickPlayersNeeding(snapshot, reward.resource, 2);
      for (const target of targets) recoverPlayer(snapshot, target, reward.resource, reward.recoverAmount);
      const declaredSeatPlayer = task.declaredBySeat ? snapshot.players.find((player) => player.seatId === task.declaredBySeat) ?? null : null;
      if (declaredSeatPlayer) {
        for (let i = 0; i < reward.drawAmount; i += 1) drawActionCard(snapshot, declaredSeatPlayer);
      }
      const recoveredLabel = targets.length > 0 ? `指定 2 名最需要的玩家各回復 ${reward.recoverAmount}${reward.resource}` : `目前沒有適合領取 ${reward.resource} 回復的玩家`;
      const drawLabel = declaredSeatPlayer ? `，並由宣告者再抽 ${reward.drawAmount} 張行動卡` : "";
      return { rewardSummaryZh: `任務〈${task.nameZh}〉獎勵生效：${recoveredLabel}${drawLabel}。` };
    }
    default:
      return { rewardSummaryZh: `任務〈${task.nameZh}〉已核准。` };
  }
}
