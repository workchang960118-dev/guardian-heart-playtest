import type { GameSnapshot, RoomConfig, SeatId, TaskState } from "@/domain/guardian-heart/types/game";
import { MINIMAL_MAP } from "@/domain/guardian-heart/seeds/map/minimal-map";
import { MINIMAL_TASKS } from "@/domain/guardian-heart/seeds/tasks/minimal-tasks";
import { buildActionDeck } from "@/domain/guardian-heart/helpers/cards/action-deck";
import { buildEventDeck } from "@/domain/guardian-heart/helpers/setup/select-round-event";
import { TASK_POOL_PROFILE_MAP } from "@/domain/guardian-heart/seeds/tasks/task-pool-profiles";
import { ROLE_OPENING_LOADOUT_MAP, getRoleNameZh } from "@/domain/guardian-heart/helpers/roles/role-loadout";

const TURN_CONTEXT_TEMPLATE = {
  P1: { hasEndedTurn: false },
  P2: { hasEndedTurn: false },
  P3: { hasEndedTurn: false },
  P4: { hasEndedTurn: false },
};

const TASK_MAP = Object.fromEntries(MINIMAL_TASKS.map((task) => [task.taskId, task]));

function dealOpeningHand(deck: string[], count: number): string[] {
  return deck.splice(0, count);
}

function buildTaskPool(roomConfig: RoomConfig): TaskState[] {
  const profile = TASK_POOL_PROFILE_MAP[roomConfig.taskPoolProfileId] ?? TASK_POOL_PROFILE_MAP.first_round_full_6;
  return profile.taskIds
    .map((taskId) => TASK_MAP[taskId])
    .filter(Boolean)
    .map((task) => structuredClone(task));
}

export function createInitialGameSnapshot(params: {
  roomId: string;
  players: Array<{ seatId: SeatId; displayName: string; roleId: string; isAi?: boolean }>;
  roomConfig: RoomConfig;
  at: string;
}): GameSnapshot {
  const { roomId, players, roomConfig, at } = params;
  const actionDeck = buildActionDeck(roomConfig);
  const eventDeck = buildEventDeck(roomConfig);

  return {
    roomId,
    roomRevision: 1,
    phase: "crisis",
    status: "in_progress",
    round: 0,
    pressure: 0,
    roomConfig,
    mapTiles: structuredClone(MINIMAL_MAP),
    players: players.map((player) => {
      const loadout = ROLE_OPENING_LOADOUT_MAP[player.roleId];
      const handSize = loadout?.handSize ?? 2;

      return {
        seatId: player.seatId,
        displayName: player.displayName,
        isAi: Boolean(player.isAi),
        roleId: player.roleId,
        roleNameZh: getRoleNameZh(player.roleId),
        currentSr: loadout?.startingSr ?? 1,
        currentSp: loadout?.startingSp ?? 1,
        remainingAp: 0,
        positionTileId: "C",
        companionTokensRemaining: loadout?.companionTokens ?? 1,
        handCardIds: dealOpeningHand(actionDeck, handSize),
        roleAbilityUsesRemaining: loadout?.roleAbilityUses ?? 1,
        perRoundFlags: {
          hasInvestedEvent: false,
          hasAdjacentHelped: false,
        },
      };
    }),
    currentEvent: null,
    eventDeck,
    eventDiscardPile: [],
    tasks: buildTaskPool(roomConfig),
    actionDeck,
    discardPile: [],
    activeSeat: null,
    turnOrder: [],
    blockingWindow: null,
    pendingLossQueue: [],
    pendingCampfireResolution: null,
    pendingTaskReview: null,
    actionLog: [],
    flags: {
      adjacentHelpPairsThisRound: [],
      adjacentHelpResourceTypesThisRound: [],
    },
    turnContext: {
      actedSeatOrder: [],
      perSeat: structuredClone(TURN_CONTEXT_TEMPLATE),
    },
    createdAt: at,
    updatedAt: at,
  };
}
