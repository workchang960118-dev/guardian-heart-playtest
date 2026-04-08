
import type { RoleSeedDefinition } from "@/domain/guardian-heart/types/game";

export const ROLE_OPENING_LOADOUT_MAP: Record<string, RoleSeedDefinition> = {
  merchant_guard: {
    roleId: "merchant_guard",
    roleNameZh: "商會護衛",
    startingSr: 5,
    startingSp: 3,
    companionTokens: 1,
    handSize: 2,
    roleAbilityUses: 1,
    abilityNameZh: "穩住陣腳",
    abilitySummaryZh: "營火時可替自己或相鄰隊友承受 1 點 SR 損失。",
  },
  medic_apprentice: {
    roleId: "medic_apprentice",
    roleNameZh: "白衣見習生",
    startingSr: 3,
    startingSp: 5,
    companionTokens: 1,
    handSize: 2,
    roleAbilityUses: 1,
    abilityNameZh: "安定陪伴",
    abilitySummaryZh: "以 0AP 相鄰互助轉移 SP 時，該隊友再回復 1 SP。",
  },
  bell_tower_observer: {
    roleId: "bell_tower_observer",
    roleNameZh: "鐘樓觀測員",
    startingSr: 4,
    startingSp: 4,
    companionTokens: 1,
    handSize: 2,
    roleAbilityUses: 1,
    abilityNameZh: "看清局勢",
    abilitySummaryZh: "投入事件時，其中 1 點 SR / SP 可改按另一種資源計算。",
  },
  alley_messenger: {
    roleId: "alley_messenger",
    roleNameZh: "街巷信使",
    startingSr: 4,
    startingSp: 4,
    companionTokens: 1,
    handSize: 2,
    roleAbilityUses: 1,
    abilityNameZh: "牽起連結",
    abilitySummaryZh: "完成 0AP 相鄰互助後，你或該隊友可立即移動 1 格。",
  },
  ranger_pathfinder: {
    roleId: "ranger_pathfinder",
    roleNameZh: "巡林探路者",
    startingSr: 5,
    startingSp: 3,
    companionTokens: 1,
    handSize: 2,
    roleAbilityUses: 1,
    abilityNameZh: "越野突破",
    abilitySummaryZh: "每輪 1 次，移動進入或離開風險地格時，該次移動不耗 AP。",
  },
  square_storyteller: {
    roleId: "square_storyteller",
    roleNameZh: "廣場說書人",
    startingSr: 4,
    startingSp: 4,
    companionTokens: 1,
    handSize: 2,
    roleAbilityUses: 1,
    abilityNameZh: "協調分工",
    abilitySummaryZh: "若本輪事件由至少 2 人投入，營火狀態確認時可令其中 1 人回復 1 SP。",
  },
};

export function getRoleNameZh(roleId: string | null): string | null {
  if (!roleId) return null;
  return ROLE_OPENING_LOADOUT_MAP[roleId]?.roleNameZh ?? null;
}

export function getRoleLoadout(roleId: string | null) {
  if (!roleId) return null;
  return ROLE_OPENING_LOADOUT_MAP[roleId] ?? null;
}


export const AI_ROLE_ASSIGNMENT_ORDER = [
  "merchant_guard",
  "medic_apprentice",
  "bell_tower_observer",
  "alley_messenger",
  "ranger_pathfinder",
  "square_storyteller",
] as const;

export function autoAssignMissingAiRoles<T extends { isAi: boolean; roleId: string | null; roleNameZh: string | null }>(players: T[]): T[] {
  const taken = new Set(players.map((p) => p.roleId).filter(Boolean));
  const remaining = AI_ROLE_ASSIGNMENT_ORDER.filter((roleId) => !taken.has(roleId));
  for (const player of players) {
    if (!player.isAi || player.roleId) continue;
    const nextRole = remaining.shift();
    if (!nextRole) break;
    player.roleId = nextRole;
    player.roleNameZh = getRoleNameZh(nextRole);
  }
  return players;
}
