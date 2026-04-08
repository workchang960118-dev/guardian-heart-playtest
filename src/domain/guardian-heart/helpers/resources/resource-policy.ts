import { getRoleLoadout } from "@/domain/guardian-heart/helpers/roles/role-loadout";
import type { PlayerState, RoomConfig } from "@/domain/guardian-heart/types/game";

export type ResourceType = "SR" | "SP";

function getConfiguredMax(player: PlayerState, resourceType: ResourceType, roomConfig: RoomConfig): number {
  if (roomConfig.resourceCapMode === "uncapped") {
    return Number.MAX_SAFE_INTEGER;
  }

  const loadout = getRoleLoadout(player.roleId);
  if (!loadout) {
    return resourceType === "SR" ? player.currentSr : player.currentSp;
  }

  return resourceType === "SR" ? loadout.startingSr : loadout.startingSp;
}

export function canRecoverResource(player: PlayerState, resourceType: ResourceType, amount: number, roomConfig: RoomConfig): boolean {
  const current = resourceType === "SR" ? player.currentSr : player.currentSp;
  return current < getConfiguredMax(player, resourceType, roomConfig) && amount > 0;
}

export function recoverResource(player: PlayerState, resourceType: ResourceType, amount: number, roomConfig: RoomConfig): number {
  if (amount <= 0) return 0;
  const maxValue = getConfiguredMax(player, resourceType, roomConfig);
  if (resourceType === "SR") {
    const next = Math.min(maxValue, player.currentSr + amount);
    const recovered = next - player.currentSr;
    player.currentSr = next;
    return recovered;
  }

  const next = Math.min(maxValue, player.currentSp + amount);
  const recovered = next - player.currentSp;
  player.currentSp = next;
  return recovered;
}
