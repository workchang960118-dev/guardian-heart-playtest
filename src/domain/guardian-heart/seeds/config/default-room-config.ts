import type { RoomConfig } from "@/domain/guardian-heart/types/game";
import { ACTION_CARD_DEFINITION_MAP } from "@/domain/guardian-heart/seeds/cards/minimal-action-cards";
import { ROLE_OPENING_LOADOUT_MAP } from "@/domain/guardian-heart/helpers/roles/role-loadout";

const cardToggles = Object.fromEntries(
  Object.keys(ACTION_CARD_DEFINITION_MAP).map((cardId) => [cardId, ACTION_CARD_DEFINITION_MAP[cardId].enabledByDefault]),
);

const roleAbilityToggles = Object.fromEntries(
  Object.keys(ROLE_OPENING_LOADOUT_MAP).map((roleId) => [roleId, true]),
);

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  language: "zh-TW",
  newcomerGuideEnabled: true,
  observerModeEnabled: true,
  actionLogEnabled: true,
  aiSimulationModeEnabled: true,
  replayEnabled: true,
  resourceCapMode: "uncapped",
  actionDeckProfileId: "core_baseline",
  eventPoolProfileId: "first_round_full_8",
  taskPoolProfileId: "first_round_full_6",
  aiPolicyProfileId: "solver_baseline",
  aiSeatIds: [],
  cardToggles,
  roleAbilityToggles,
  experimentalRuleToggles: {
    respondTogetherEnabled: false,
  },
};
