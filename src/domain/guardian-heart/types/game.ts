export type SeatId = "P1" | "P2" | "P3" | "P4";

export type ViewerRole = "host" | "player" | "observer";

export type GamePhase =
  | "lobby"
  | "crisis"
  | "action"
  | "campfire"
  | "gameover";

export type RoomStatus = "lobby" | "in_progress" | "finished";

export type TileKind = "center" | "safe" | "risk" | "station" | "shelter";

export type RoomSummary = {
  roomId: string;
  roomCode: string;
  status: RoomStatus;
  phase: GamePhase;
  round: number;
  version: number;
  hostSeat: SeatId | null;
  createdAt: string;
  updatedAt: string;
};

export type RoomPlayerSummary = {
  seatId: SeatId;
  displayName: string;
  isConnected: boolean;
  isAi: boolean;
  joinedAt: string;
};

export type RoomConfig = {
  language: "zh-TW";
  newcomerGuideEnabled: boolean;
  observerModeEnabled: boolean;
  actionLogEnabled: boolean;
  aiSimulationModeEnabled: boolean;
  replayEnabled: boolean;
  resourceCapMode: "capped" | "uncapped";
  actionDeckProfileId: string;
  eventPoolProfileId: string;
  taskPoolProfileId: string;
  aiPolicyProfileId: "solver_baseline" | "task_noise_only" | "risk_help_humanized" | "risk_move_only" | "help_gate_only" | "invest_timing_only" | "event_invest_harder" | "event_alignment_combo" | "canonical_humanized" | "canonical_humanized_help_gate" | "canonical_humanized_risk_exposure" | "canonical_v2_companion_first" | "canonical_v2_help_companion" | "canonical_v2b_help_light" | "canonical_humanized_v2b" | "canonical_humanized_v2" | "canonical_v2c_recovery_companion" | "canonical_humanized_v2c" | "canonical_v2d_sp_recovery_companion" | "canonical_v2d_sr_recovery_companion" | "canonical_humanized_v2d" | "canonical_v2e_dual_recovery_companion" | "canonical_v2e_companion_guarded" | "canonical_v2e_soft_sp_help" | "canonical_humanized_v2e" | "canonical_v2f_sp_recovery_companion" | "canonical_v2f_sp_recovery_guarded" | "canonical_humanized_v2f" | "canonical_v2f_help_gate" | "canonical_v2f_risk_exposure" | "survival_companion_guarded" | "survival_recovery_tighter" | "survival_risk_exposure" | "survival_cadence_combo" | "humanized_v1";
  aiSeatIds: SeatId[];
  cardToggles: Record<string, boolean>;
  roleAbilityToggles: Record<string, boolean>;
  experimentalRuleToggles: {
    respondTogetherEnabled: boolean;
  };
};

export type MapTile = {
  tileId: string;
  nameZh: string;
  kind: TileKind;
  adjacentTileIds: string[];
};

export type RoleSeedDefinition = {
  roleId: string;
  roleNameZh: string;
  startingSr: number;
  startingSp: number;
  companionTokens: number;
  handSize: number;
  roleAbilityUses: number;
  abilityNameZh: string;
  abilitySummaryZh: string;
};

export type PlayerState = {
  seatId: SeatId;
  displayName: string;
  isAi: boolean;
  roleId: string | null;
  roleNameZh: string | null;
  currentSr: number;
  currentSp: number;
  remainingAp: number;
  positionTileId: string | null;
  companionTokensRemaining: number;
  handCardIds: string[];
  roleAbilityUsesRemaining: number;
  perRoundFlags: {
    hasInvestedEvent: boolean;
    hasAdjacentHelped: boolean;
  };
};

export type EventPenaltyMode =
  | "single_target"
  | "each_player"
  | "two_distinct_players"
  | "each_player_choose_sr_or_sp";

export type EventPenalty = {
  pressureDelta?: number;
  srLoss?: number;
  spLoss?: number;
  mode?: EventPenaltyMode;
  targetCount?: number;
};

export type EventImmediateEffect =
  | { mode: "each_player"; srLoss?: number; spLoss?: number }
  | { mode: "each_player_not_adjacent_to_any_teammate"; srLoss?: number; spLoss?: number };

export type EventState = {
  cardId: string;
  nameZh: string;
  rulesTextZh: string;
  unresolvedPenaltyTextZh: string;
  requirement: {
    srRequired: number;
    spRequired: number;
  };
  penalty: EventPenalty;
  immediateEffect?: EventImmediateEffect;
  contributions: Array<{
    seatId: SeatId;
    srPaid: number;
    spPaid: number;
    srCounted: number;
    spCounted: number;
  }>;
  revealedAtRound: number;
  tags: string[];
};

export type TaskRewardSpec =
  | { type: "recover_declared_seat"; resource: "SR" | "SP"; amount: number }
  | { type: "recover_all_players"; resource: "SR" | "SP"; amount: number }
  | { type: "recover_event_contributors"; resource: "SR" | "SP"; amount: number }
  | { type: "reduce_pressure"; amount: number }
  | { type: "draw_cards_all_players"; amount: number }
  | { type: "recover_two_players"; resource: "SR" | "SP"; amount: number }
  | { type: "recover_two_players_choice"; amount: number }
  | { type: "recover_two_players_and_draw_declared_seat"; resource: "SP"; recoverAmount: number; drawAmount: number };

export type TaskState = {
  taskId: string;
  nameZh: string;
  rulesTextZh: string;
  completionHintZh: string;
  rewardTextZh: string;
  rewardSpec: TaskRewardSpec;
  declaredAtRound: number | null;
  declaredBySeat: SeatId | null;
  completionCheckedByHost: boolean;
  rewardGrantedAtRound: number | null;
};

export type ActionCardDefinition = {
  cardId: string;
  nameZh: string;
  category: "mobility" | "support" | "event_response";
  apCost: number;
  rulesTextZh: string;
  noteZh: string;
  enabledByDefault: boolean;
};

export type PendingDiscardWindow = {
  kind: "discard";
  targetSeat: SeatId;
  requiredDiscardCount: number;
};

export type PendingLossQueueItem = {
  lossChainId: string;
  targetSeat: SeatId;
  srLoss: number;
  spLoss: number;
  eligibleCompanionSeatIds: SeatId[];
  sourceType: "event_penalty" | "risk_tile";
  sourceLabelZh: string;
};

export type CompanionReaction =
  | {
      type: "prevent";
      usedBySeat: SeatId;
      preventResource: "SR" | "SP";
    }
  | {
      type: "comfort";
      usedBySeat: SeatId;
    }
  | null;

export type PendingLossWindow = {
  kind: "loss";
  lossChainId: string;
  targetSeat: SeatId;
  srLoss: number;
  spLoss: number;
  eligibleCompanionSeatIds: SeatId[];
  companionUsed: boolean;
  companionReaction: CompanionReaction;
  sourceType: "event_penalty" | "risk_tile";
  sourceLabelZh: string;
  merchantGuardSeat: SeatId | null;
};

export type PendingMerchantGuardAbilityWindow = {
  kind: "ability";
  abilityId: "merchant_guard";
  actorSeat: SeatId;
  remainingResponderSeatIds: SeatId[];
  fallbackAiSeatId: SeatId | null;
  loss: Omit<PendingLossWindow, "kind" | "merchantGuardSeat">;
};

export type PendingStorytellerAbilityWindow = {
  kind: "ability";
  abilityId: "square_storyteller";
  actorSeat: SeatId;
  candidateSeatIds: SeatId[];
};

export type PendingAbilityWindow = PendingMerchantGuardAbilityWindow | PendingStorytellerAbilityWindow;

export type PendingCampfireStage =
  | "resolve_event"
  | "resolve_losses"
  | "apply_pressure"
  | "state_check";

export type PendingCampfireResolution = {
  stage: PendingCampfireStage;
  pendingPressureDelta: number;
  eventResolved: boolean;
  summaryZh: string;
};

export type BlockingWindow = PendingDiscardWindow | PendingLossWindow | PendingAbilityWindow | null;


export type PendingTaskReview = {
  /** Legacy field kept for backward compatibility. Task declarations are now system-validated immediately. */
  taskId: string;
  taskNameZh: string;
  declaredBySeat: SeatId;
  declaredAtRound: number;
  requestedAt: string;
};

export type ActionLogEntry = {
  roomRevision: number;
  round: number;
  phase: GamePhase;
  actorSeat: SeatId | "SYSTEM";
  actorKind: "human" | "ai" | "system";
  actorLabelZh: string;
  actionType: string;
  payloadSummaryZh: string;
  resultSummaryZh: string;
  statusBefore: {
    phase: GamePhase;
    round: number;
    pressure: number;
    activeSeat: SeatId | null;
    blockingWindowKind: "discard" | "loss" | "ability" | null;
    players: Array<{
      seatId: SeatId;
      sr: number;
      sp: number;
      ap: number;
      tileId: string | null;
    }>;
  };
  statusAfter: {
    phase: GamePhase;
    round: number;
    pressure: number;
    activeSeat: SeatId | null;
    blockingWindowKind: "discard" | "loss" | "ability" | null;
    players: Array<{
      seatId: SeatId;
      sr: number;
      sp: number;
      ap: number;
      tileId: string | null;
    }>;
  };
  timestamp: string;
};

export type GameSnapshot = {
  roomId: string;
  roomRevision: number;
  phase: GamePhase;
  status: RoomStatus;
  round: number;
  pressure: number;
  roomConfig: RoomConfig;
  mapTiles: MapTile[];
  players: PlayerState[];
  currentEvent: EventState | null;
  eventDeck: string[];
  eventDiscardPile: string[];
  tasks: TaskState[];
  actionDeck: string[];
  discardPile: string[];
  activeSeat: SeatId | null;
  turnOrder: SeatId[];
  blockingWindow: BlockingWindow;
  pendingLossQueue: PendingLossQueueItem[];
  pendingCampfireResolution: PendingCampfireResolution | null;
  pendingTaskReview: PendingTaskReview | null;
  actionLog: ActionLogEntry[];
  flags: {
    adjacentHelpPairsThisRound: string[];
    adjacentHelpResourceTypesThisRound: Array<"SR" | "SP">;
  };
  turnContext: {
    actedSeatOrder: SeatId[];
    perSeat: Record<SeatId, { hasEndedTurn: boolean }>;
  };
  createdAt: string;
  updatedAt: string;
};
