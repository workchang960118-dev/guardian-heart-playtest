import type { RoomConfig, SeatId } from "./game";

export type AssignRoleAction = {
  type: "assign_role";
  actorSeat: SeatId;
  targetSeat: SeatId;
  roleId: string;
};

export type StartGameAction = {
  type: "start_game";
  actorSeat: SeatId;
};

export type StartRoundAction = {
  type: "start_round";
  actorSeat: SeatId;
};

export type MoveAction = {
  type: "move";
  actorSeat: SeatId;
  toTileId: string;
  useRangerAbility?: boolean;
};

export type UseStationOrShelterAction = {
  type: "use_station_or_shelter";
  actorSeat: SeatId;
};

export type InvestEventAction = {
  type: "invest_event";
  actorSeat: SeatId;
  srPaid: number;
  spPaid: number;
  convertOne?: "SR_TO_SP" | "SP_TO_SR";
};

export type AdjacentHelpAction = {
  type: "adjacent_help";
  actorSeat: SeatId;
  targetSeat: SeatId;
  resourceType: "SR" | "SP";
  useMedicAbility?: boolean;
  useMessengerAbility?: boolean;
  freeMoveSeat?: SeatId;
  freeMoveToTileId?: string;
};


export type PlayActionCardAction = {
  type: "play_action_card";
  actorSeat: SeatId;
  cardId: string;
  targetSeat?: SeatId;
  toTileId?: string;
  resourceType?: "SR" | "SP";
  teammateResourceType?: "SR" | "SP";
};

export type EndTurnAction = {
  type: "end_turn";
  actorSeat: SeatId;
};

export type DiscardCardsAction = {
  type: "discard_cards";
  actorSeat: SeatId;
  discardedCardIds: string[];
};

export type UseCompanionTokenAction = {
  type: "use_companion_token";
  actorSeat: SeatId;
  mode: "prevent" | "comfort";
  preventResource?: "SR" | "SP";
};

export type FinalizePendingLossAction = {
  type: "finalize_pending_loss";
  actorSeat: SeatId;
};

export type DeclareTaskAction = {
  type: "declare_task";
  actorSeat: SeatId;
  taskId: string;
};

export type ResolveCampfireAction = {
  type: "resolve_campfire";
  actorSeat: SeatId;
};

export type ResolveRoleAbilityAction = {
  type: "resolve_role_ability";
  actorSeat: SeatId;
  abilityId: "merchant_guard" | "square_storyteller";
  mode: "use" | "skip";
  targetSeat?: SeatId;
};



export type UpdateRoomConfigAction = {
  type: "update_room_config";
  actorSeat: SeatId;
  patch: Partial<Pick<RoomConfig, "newcomerGuideEnabled" | "observerModeEnabled" | "actionLogEnabled" | "aiSimulationModeEnabled" | "replayEnabled" | "resourceCapMode" | "actionDeckProfileId" | "eventPoolProfileId" | "taskPoolProfileId" | "aiPolicyProfileId" | "aiSeatIds">> & {
    cardToggles?: Record<string, boolean>;
    roleAbilityToggles?: Record<string, boolean>;
    experimentalRuleToggles?: Partial<RoomConfig["experimentalRuleToggles"]>;
  };
};

export type RunAiTurnAction = {
  type: "run_ai_turn";
  actorSeat: SeatId;
};


export type RoomAction =
  | AssignRoleAction
  | StartGameAction
  | StartRoundAction
  | MoveAction
  | UseStationOrShelterAction
  | InvestEventAction
  | AdjacentHelpAction
  | PlayActionCardAction
  | EndTurnAction
  | DiscardCardsAction
  | UseCompanionTokenAction
  | FinalizePendingLossAction
  | DeclareTaskAction
  | ResolveCampfireAction
  | ResolveRoleAbilityAction
  | UpdateRoomConfigAction
  | RunAiTurnAction;
