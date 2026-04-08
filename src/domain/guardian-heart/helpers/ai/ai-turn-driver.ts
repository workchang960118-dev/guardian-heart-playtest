import { getTileById } from "@/domain/guardian-heart/helpers/map/tile-lookup";
import type { GameSnapshot, MapTile, PlayerState, SeatId } from "@/domain/guardian-heart/types/game";
import type { RoomAction } from "@/domain/guardian-heart/types/room-actions";

type AiPolicyProfileId = "solver_baseline" | "task_noise_only" | "risk_help_humanized" | "risk_move_only" | "help_gate_only" | "invest_timing_only" | "event_invest_harder" | "event_alignment_combo" | "canonical_humanized" | "canonical_humanized_help_gate" | "canonical_humanized_risk_exposure" | "canonical_v2_companion_first" | "canonical_v2_help_companion" | "canonical_v2b_help_light" | "canonical_humanized_v2b" | "canonical_humanized_v2" | "canonical_v2c_recovery_companion" | "canonical_humanized_v2c" | "canonical_v2d_sp_recovery_companion" | "canonical_v2d_sr_recovery_companion" | "canonical_humanized_v2d" | "canonical_v2e_dual_recovery_companion" | "canonical_v2e_companion_guarded" | "canonical_v2e_soft_sp_help" | "canonical_humanized_v2e" | "canonical_v2f_sp_recovery_companion" | "canonical_v2f_sp_recovery_guarded" | "canonical_humanized_v2f" | "canonical_v2f_help_gate" | "canonical_v2f_risk_exposure" | "survival_companion_guarded" | "survival_recovery_tighter" | "survival_risk_exposure" | "survival_cadence_combo" | "humanized_v1" | "custom_builder";

export type CustomAiPriorityId =
  | "stabilize_self"
  | "stabilize_team"
  | "resolve_event"
  | "play_cards"
  | "move_position";

export type CustomAiPolicyInput = {
  labelZh?: string;
  priorityOrder: CustomAiPriorityId[];
  selfSafetyLine: number;
  teamSafetyLine: number;
  eventContributionBuffer: number;
};

type AiPolicy = {
  profileId: AiPolicyProfileId;
  taskDeclarationMissRate: number;
  helpOnlyWhenCritical: boolean;
  helpTargetThreshold: {
    sr: number;
    sp: number;
  };
  donorBuffer: {
    sr: number;
    sp: number;
  };
  cardUseThreshold: {
    sameTileCare: number;
    holdTogether: number;
    focusMinRemaining: number;
  };
  investRequiresBuffer: number;
  riskBias: "avoid" | "balanced" | "expose";
  recoveryThreshold: {
    sr: number;
    sp: number;
  };
  prefersGroupPositioning: boolean;
  companionInterveneAtOrBelow: {
    sr: number;
    sp: number;
  };
  priorityOrder?: CustomAiPriorityId[];
  labelZh?: string;
};

const AI_POLICIES: Record<AiPolicyProfileId, AiPolicy> = {
  solver_baseline: {
    profileId: "solver_baseline",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 1, sp: 1 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 3,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "avoid",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  task_noise_only: {
    profileId: "task_noise_only",
    taskDeclarationMissRate: 0.22,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 1, sp: 1 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 3,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "avoid",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  risk_help_humanized: {
    profileId: "risk_help_humanized",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: true,
    helpTargetThreshold: { sr: 0, sp: 0 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 1,
      holdTogether: 2,
      focusMinRemaining: 3,
    },
    investRequiresBuffer: 1,
    riskBias: "balanced",
    recoveryThreshold: { sr: 3, sp: 3 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  risk_move_only: {
    profileId: "risk_move_only",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 1, sp: 1 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 3,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "expose",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  help_gate_only: {
    profileId: "help_gate_only",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: true,
    helpTargetThreshold: { sr: 0, sp: 0 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 3,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "avoid",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  invest_timing_only: {
    profileId: "invest_timing_only",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 1, sp: 1 },
    cardUseThreshold: {
      sameTileCare: 1,
      holdTogether: 2,
      focusMinRemaining: 3,
    },
    investRequiresBuffer: 1,
    riskBias: "avoid",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  event_invest_harder: {
    profileId: "event_invest_harder",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 3,
    },
    investRequiresBuffer: 1,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  event_alignment_combo: {
    profileId: "event_alignment_combo",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 4,
    },
    investRequiresBuffer: 1,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  canonical_humanized: {
    profileId: "canonical_humanized",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  canonical_humanized_help_gate: {
    profileId: "canonical_humanized_help_gate",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: true,
    helpTargetThreshold: { sr: 0, sp: 0 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  canonical_humanized_risk_exposure: {
    profileId: "canonical_humanized_risk_exposure",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "expose",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  canonical_v2_companion_first: {
    profileId: "canonical_v2_companion_first",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_v2_help_companion: {
    profileId: "canonical_v2_help_companion",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 3 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_v2b_help_light: {
    profileId: "canonical_v2b_help_light",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 0, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_humanized_v2b: {
    profileId: "canonical_humanized_v2b",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: false,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_humanized_v2: {
    profileId: "canonical_humanized_v2",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 3 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "expose",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: false,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_v2c_recovery_companion: {
    profileId: "canonical_v2c_recovery_companion",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 3, sp: 3 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_humanized_v2c: {
    profileId: "canonical_humanized_v2c",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 3, sp: 3 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  canonical_v2d_sp_recovery_companion: {
    profileId: "canonical_v2d_sp_recovery_companion",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 3, sp: 2 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_v2d_sr_recovery_companion: {
    profileId: "canonical_v2d_sr_recovery_companion",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 3 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_v2e_dual_recovery_companion: {
    profileId: "canonical_v2e_dual_recovery_companion",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 2 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_v2e_companion_guarded: {
    profileId: "canonical_v2e_companion_guarded",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 3, sp: 2 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  canonical_v2e_soft_sp_help: {
    profileId: "canonical_v2e_soft_sp_help",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 2 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 2 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_humanized_v2e: {
    profileId: "canonical_humanized_v2e",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 2 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  canonical_v2f_sp_recovery_companion: {
    profileId: "canonical_v2f_sp_recovery_companion",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 1 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
  },
  canonical_v2f_sp_recovery_guarded: {
    profileId: "canonical_v2f_sp_recovery_guarded",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 1 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  canonical_humanized_v2f: {
    profileId: "canonical_humanized_v2f",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 1 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -2 },
  },
  canonical_v2f_help_gate: {
    profileId: "canonical_v2f_help_gate",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: true,
    helpTargetThreshold: { sr: 0, sp: 0 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 1 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -2 },
  },
  canonical_v2f_risk_exposure: {
    profileId: "canonical_v2f_risk_exposure",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "expose",
    recoveryThreshold: { sr: 2, sp: 1 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -2 },
  },
  canonical_humanized_v2d: {
    profileId: "canonical_humanized_v2d",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 3, sp: 2 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  survival_companion_guarded: {
    profileId: "survival_companion_guarded",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  survival_recovery_tighter: {
    profileId: "survival_recovery_tighter",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 3, sp: 3 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  survival_risk_exposure: {
    profileId: "survival_risk_exposure",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "balanced",
    recoveryThreshold: { sr: 4, sp: 4 },
    prefersGroupPositioning: false,
    companionInterveneAtOrBelow: { sr: 0, sp: 0 },
  },
  survival_cadence_combo: {
    profileId: "survival_cadence_combo",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 0,
    riskBias: "expose",
    recoveryThreshold: { sr: 3, sp: 3 },
    prefersGroupPositioning: false,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  humanized_v1: {
    profileId: "humanized_v1",
    taskDeclarationMissRate: 0.22,
    helpOnlyWhenCritical: true,
    helpTargetThreshold: { sr: 0, sp: 0 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 1,
      holdTogether: 2,
      focusMinRemaining: 3,
    },
    investRequiresBuffer: 1,
    riskBias: "balanced",
    recoveryThreshold: { sr: 3, sp: 3 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: -1, sp: -1 },
  },
  custom_builder: {
    profileId: "custom_builder",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: 1, sp: 1 },
    donorBuffer: { sr: 2, sp: 2 },
    cardUseThreshold: {
      sameTileCare: 2,
      holdTogether: 2,
      focusMinRemaining: 2,
    },
    investRequiresBuffer: 1,
    riskBias: "balanced",
    recoveryThreshold: { sr: 2, sp: 2 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
    priorityOrder: ["stabilize_team", "play_cards", "resolve_event", "stabilize_self", "move_position"],
    labelZh: "自定義 AI",
  },
};

function getAiPolicy(snapshot: GameSnapshot): AiPolicy {
  return AI_POLICIES[snapshot.roomConfig.aiPolicyProfileId] ?? AI_POLICIES.solver_baseline;
}

const DEFAULT_PRIORITY_ORDER: CustomAiPriorityId[] = ["stabilize_team", "play_cards", "resolve_event", "stabilize_self", "move_position"];

function clampPriorityThreshold(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizePriorityOrder(priorityOrder: CustomAiPriorityId[]) {
  const seen = new Set<CustomAiPriorityId>();
  const normalized: CustomAiPriorityId[] = [];
  for (const priority of priorityOrder) {
    if (!DEFAULT_PRIORITY_ORDER.includes(priority) || seen.has(priority)) continue;
    seen.add(priority);
    normalized.push(priority);
  }
  for (const priority of DEFAULT_PRIORITY_ORDER) {
    if (seen.has(priority)) continue;
    normalized.push(priority);
  }
  return normalized;
}

export function buildCustomAiPolicy(input: CustomAiPolicyInput): AiPolicy {
  const selfSafetyLine = clampPriorityThreshold(input.selfSafetyLine, 1, 3);
  const teamSafetyLine = clampPriorityThreshold(input.teamSafetyLine, 1, 3);
  const eventContributionBuffer = clampPriorityThreshold(input.eventContributionBuffer, 0, 2);
  return {
    profileId: "custom_builder",
    labelZh: input.labelZh?.trim() || "自定義 AI",
    taskDeclarationMissRate: 0,
    helpOnlyWhenCritical: false,
    helpTargetThreshold: { sr: teamSafetyLine, sp: teamSafetyLine },
    donorBuffer: { sr: teamSafetyLine + 1, sp: teamSafetyLine + 1 },
    cardUseThreshold: {
      sameTileCare: Math.max(1, teamSafetyLine),
      holdTogether: Math.max(2, teamSafetyLine + 1),
      focusMinRemaining: 2,
    },
    investRequiresBuffer: eventContributionBuffer,
    riskBias: "balanced",
    recoveryThreshold: { sr: selfSafetyLine + 1, sp: selfSafetyLine + 1 },
    prefersGroupPositioning: true,
    companionInterveneAtOrBelow: { sr: 0, sp: -1 },
    priorityOrder: normalizePriorityOrder(input.priorityOrder),
  };
}

function getPlayer(snapshot: GameSnapshot, seatId: SeatId): PlayerState | null {
  return snapshot.players.find((player) => player.seatId === seatId) ?? null;
}

function getEventRemaining(snapshot: GameSnapshot) {
  const currentEvent = snapshot.currentEvent;
  if (!currentEvent) return { sr: 0, sp: 0 };
  const srContributed = currentEvent.contributions.reduce((sum, item) => sum + item.srCounted, 0);
  const spContributed = currentEvent.contributions.reduce((sum, item) => sum + item.spCounted, 0);
  return {
    sr: Math.max(0, currentEvent.requirement.srRequired - srContributed),
    sp: Math.max(0, currentEvent.requirement.spRequired - spContributed),
  };
}

function getNeighbors(snapshot: GameSnapshot, actor: PlayerState): PlayerState[] {
  const actorTile = actor.positionTileId ? getTileById(snapshot.mapTiles, actor.positionTileId) : null;
  if (!actorTile) return [];

  return snapshot.players.filter((player) => {
    if (player.seatId === actor.seatId || !player.positionTileId) return false;
    if (player.positionTileId === actor.positionTileId) return true;
    return actorTile.adjacentTileIds.includes(player.positionTileId);
  });
}

function choosePlayActionCard(snapshot: GameSnapshot, actor: PlayerState, policy: AiPolicy): Extract<RoomAction, { type: "play_action_card" }> | null {
  if (actor.remainingAp < 1) return null;

  if (actor.handCardIds.includes("card_focus_the_point") && snapshot.currentEvent) {
    const remaining = getEventRemaining(snapshot);
    const totalRemaining = remaining.sr + remaining.sp;
    if (totalRemaining >= policy.cardUseThreshold.focusMinRemaining) {
      if (remaining.sr > remaining.sp && snapshot.currentEvent.requirement.srRequired > 1 && actor.currentSr > policy.investRequiresBuffer) {
        return { type: "play_action_card", actorSeat: actor.seatId, cardId: "card_focus_the_point", resourceType: "SR" };
      }
      if (remaining.sp > 0 && snapshot.currentEvent.requirement.spRequired > 1 && actor.currentSp > policy.investRequiresBuffer) {
        return { type: "play_action_card", actorSeat: actor.seatId, cardId: "card_focus_the_point", resourceType: "SP" };
      }
    }
  }

  const sameTileTeammates = snapshot.players.filter((player) => player.seatId !== actor.seatId && player.positionTileId && player.positionTileId === actor.positionTileId);

  if (actor.handCardIds.includes("card_same_tile_care")) {
    const srTarget = sameTileTeammates.find((player) => player.currentSr <= policy.cardUseThreshold.sameTileCare);
    if (srTarget) {
      return { type: "play_action_card", actorSeat: actor.seatId, cardId: "card_same_tile_care", targetSeat: srTarget.seatId, resourceType: "SR" };
    }
    const spTarget = sameTileTeammates.find((player) => player.currentSp <= policy.cardUseThreshold.sameTileCare);
    if (spTarget) {
      return { type: "play_action_card", actorSeat: actor.seatId, cardId: "card_same_tile_care", targetSeat: spTarget.seatId, resourceType: "SP" };
    }
  }

  if (actor.handCardIds.includes("card_hold_together") && actor.currentSp <= policy.cardUseThreshold.holdTogether) {
    const lowSpTeammate = sameTileTeammates.find((player) => player.currentSp <= policy.cardUseThreshold.holdTogether);
    if (lowSpTeammate) {
      return { type: "play_action_card", actorSeat: actor.seatId, cardId: "card_hold_together", targetSeat: lowSpTeammate.seatId };
    }
  }

  return null;
}

function chooseInvestAction(snapshot: GameSnapshot, actor: PlayerState, policy: AiPolicy): Extract<RoomAction, { type: "invest_event" }> | null {
  const currentEvent = snapshot.currentEvent;
  if (!currentEvent || actor.perRoundFlags.hasInvestedEvent) return null;
  const remaining = getEventRemaining(snapshot);
  if (remaining.sr <= 0 && remaining.sp <= 0) return null;

  let srPaid = 0;
  let spPaid = 0;

  if (remaining.sr > 0 && actor.currentSr > policy.investRequiresBuffer) srPaid = 1;
  if (remaining.sp > 0 && actor.currentSp > policy.investRequiresBuffer) spPaid = 1;

  if (srPaid === 0 && spPaid === 0) {
    if (!policy.helpOnlyWhenCritical) {
      if (remaining.sr > 0 && actor.currentSp > 1 + policy.investRequiresBuffer) {
        return {
          type: "invest_event",
          actorSeat: actor.seatId,
          srPaid: 0,
          spPaid: 1,
          convertOne: "SP_TO_SR",
        };
      }
      if (remaining.sp > 0 && actor.currentSr > 1 + policy.investRequiresBuffer) {
        return {
          type: "invest_event",
          actorSeat: actor.seatId,
          srPaid: 1,
          spPaid: 0,
          convertOne: "SR_TO_SP",
        };
      }
    }
    return null;
  }

  return {
    type: "invest_event",
    actorSeat: actor.seatId,
    srPaid,
    spPaid,
  };
}

function chooseAdjacentHelpAction(snapshot: GameSnapshot, actor: PlayerState, policy: AiPolicy): Extract<RoomAction, { type: "adjacent_help" }> | null {
  if (actor.perRoundFlags.hasAdjacentHelped) return null;
  const neighbors = getNeighbors(snapshot, actor);

  const spThreshold = policy.helpTargetThreshold.sp;
  const srThreshold = policy.helpTargetThreshold.sr;
  const donorSpBuffer = policy.donorBuffer.sp;
  const donorSrBuffer = policy.donorBuffer.sr;

  const criticalSpTarget = neighbors.find((player) => player.currentSp <= spThreshold && actor.currentSp > donorSpBuffer);
  if (criticalSpTarget) {
    return {
      type: "adjacent_help",
      actorSeat: actor.seatId,
      targetSeat: criticalSpTarget.seatId,
      resourceType: "SP",
      useMedicAbility: actor.roleId === "medic_apprentice",
    };
  }

  const criticalSrTarget = neighbors.find((player) => player.currentSr <= srThreshold && actor.currentSr > donorSrBuffer);
  if (criticalSrTarget) {
    return {
      type: "adjacent_help",
      actorSeat: actor.seatId,
      targetSeat: criticalSrTarget.seatId,
      resourceType: "SR",
    };
  }

  return null;
}

function chooseUseTileAction(snapshot: GameSnapshot, actor: PlayerState, policy: AiPolicy): Extract<RoomAction, { type: "use_station_or_shelter" }> | null {
  if (!actor.positionTileId || actor.remainingAp < 1) return null;
  const tile = getTileById(snapshot.mapTiles, actor.positionTileId);
  if (!tile) return null;
  const srThreshold = policy.recoveryThreshold.sr;
  const spThreshold = policy.recoveryThreshold.sp;
  if (tile.kind === "station" && actor.currentSr < srThreshold) {
    return { type: "use_station_or_shelter", actorSeat: actor.seatId };
  }
  if (tile.kind === "shelter" && actor.currentSp < spThreshold) {
    return { type: "use_station_or_shelter", actorSeat: actor.seatId };
  }
  return null;
}

function wantsSr(actor: PlayerState, remaining: ReturnType<typeof getEventRemaining>) {
  return actor.currentSr <= actor.currentSp || remaining.sr > remaining.sp;
}

function wantsSp(actor: PlayerState, remaining: ReturnType<typeof getEventRemaining>) {
  return actor.currentSp < actor.currentSr || remaining.sp > remaining.sr;
}

function scoreMoveTile(snapshot: GameSnapshot, actor: PlayerState, tile: MapTile, policy: AiPolicy, remaining: ReturnType<typeof getEventRemaining>) {
  let score = 0;
  const needSr = wantsSr(actor, remaining);
  const needSp = wantsSp(actor, remaining);
  const resourceCrisis = actor.currentSr <= 2 || actor.currentSp <= 2;

  if (tile.kind === "station") score += needSr ? 100 : 50;
  if (tile.kind === "shelter") score += needSp ? 100 : 50;
  if (tile.kind === "center") score += policy.riskBias === "avoid" ? 60 : policy.riskBias === "balanced" ? 48 : 40;
  if (tile.kind === "safe") score += policy.riskBias === "avoid" ? 55 : policy.riskBias === "balanced" ? 45 : 38;
  if (tile.kind === "risk") {
    score += policy.riskBias === "avoid"
      ? 10
      : policy.riskBias === "balanced"
        ? (resourceCrisis ? 62 : 52)
        : (resourceCrisis ? 76 : 66);
  }

  const nearbyAllies = snapshot.players.filter((player) => player.seatId !== actor.seatId && player.positionTileId === tile.tileId).length;
  score += nearbyAllies * (policy.prefersGroupPositioning ? 6 : 4);

  if (needSr && tile.kind === "risk" && remaining.sr > 0) score += policy.riskBias === "expose" ? 16 : 8;
  if (needSp && tile.kind === "risk" && remaining.sp > 0) score += policy.riskBias === "expose" ? 16 : 8;
  if (actor.currentSr <= 1 && tile.kind === "risk") score -= 25;
  if (actor.currentSp <= 1 && tile.kind === "risk") score -= 20;

  return score;
}

function chooseMoveAction(snapshot: GameSnapshot, actor: PlayerState, policy: AiPolicy): Extract<RoomAction, { type: "move" }> | null {
  if (!actor.positionTileId || actor.remainingAp < 1) return null;
  const currentTile = getTileById(snapshot.mapTiles, actor.positionTileId);
  if (!currentTile) return null;
  const adjacentTiles = snapshot.mapTiles.filter((tile) => currentTile.adjacentTileIds.includes(tile.tileId));
  if (adjacentTiles.length === 0) return null;

  const remaining = getEventRemaining(snapshot);
  const preferred = adjacentTiles
    .map((tile) => ({ tile, score: scoreMoveTile(snapshot, actor, tile, policy, remaining) + Math.random() * 0.5 }))
    .sort((a, b) => b.score - a.score || a.tile.tileId.localeCompare(b.tile.tileId))[0]?.tile;

  if (!preferred) return null;
  return {
    type: "move",
    actorSeat: actor.seatId,
    toTileId: preferred.tileId,
    useRangerAbility: actor.roleId === "ranger_pathfinder" && (currentTile.kind === "risk" || preferred.kind === "risk"),
  };
}

function chooseDiscardAction(snapshot: GameSnapshot): Extract<RoomAction, { type: "discard_cards" }> | null {
  if (!snapshot.blockingWindow || snapshot.blockingWindow.kind !== "discard") return null;
  const actor = getPlayer(snapshot, snapshot.blockingWindow.targetSeat);
  if (!actor?.isAi) return null;
  return {
    type: "discard_cards",
    actorSeat: actor.seatId,
    discardedCardIds: actor.handCardIds.slice(0, snapshot.blockingWindow.requiredDiscardCount),
  };
}

function chooseLossAction(snapshot: GameSnapshot, policy: AiPolicy): Extract<RoomAction, { type: "use_companion_token" | "finalize_pending_loss" }> | null {
  if (!snapshot.blockingWindow || snapshot.blockingWindow.kind !== "loss") return null;
  const loss = snapshot.blockingWindow;
  const target = getPlayer(snapshot, loss.targetSeat);
  if (!target) return null;

  const aiSupportSeat = loss.eligibleCompanionSeatIds.find((seatId) => {
    const player = getPlayer(snapshot, seatId);
    return Boolean(player?.isAi && player.companionTokensRemaining > 0);
  });
  const aiFinalizeSeat = target.isAi
    ? target.seatId
    : loss.eligibleCompanionSeatIds.find((seatId) => Boolean(getPlayer(snapshot, seatId)?.isAi));

  const shouldInterveneForSr = loss.srLoss > 0 && target.currentSr - loss.srLoss <= policy.companionInterveneAtOrBelow.sr;
  const shouldInterveneForSp = loss.spLoss > 0 && target.currentSp - loss.spLoss <= policy.companionInterveneAtOrBelow.sp;
  if (!loss.companionUsed && aiSupportSeat && (shouldInterveneForSr || shouldInterveneForSp)) {
    return {
      type: "use_companion_token",
      actorSeat: aiSupportSeat,
      mode: "prevent",
      preventResource: shouldInterveneForSp ? "SP" : "SR",
    };
  }

  if (aiFinalizeSeat) {
    return { type: "finalize_pending_loss", actorSeat: aiFinalizeSeat };
  }

  return null;
}

function resolvePriorityAction(snapshot: GameSnapshot, actor: PlayerState, policy: AiPolicy, priority: CustomAiPriorityId) {
  switch (priority) {
    case "stabilize_self":
      return chooseUseTileAction(snapshot, actor, policy);
    case "stabilize_team":
      return chooseAdjacentHelpAction(snapshot, actor, policy);
    case "resolve_event":
      return chooseInvestAction(snapshot, actor, policy);
    case "play_cards":
      return choosePlayActionCard(snapshot, actor, policy);
    case "move_position":
      return chooseMoveAction(snapshot, actor, policy);
    default:
      return null;
  }
}

export function chooseAiStep(snapshot: GameSnapshot, overridePolicy?: AiPolicy): RoomAction | null {
  const policy = overridePolicy ?? getAiPolicy(snapshot);
  const discardAction = chooseDiscardAction(snapshot);
  if (discardAction) return discardAction;

  const lossAction = chooseLossAction(snapshot, policy);
  if (lossAction) return lossAction;

  if (snapshot.phase !== "action" || !snapshot.activeSeat) return null;
  const actor = getPlayer(snapshot, snapshot.activeSeat);
  if (!actor?.isAi) return null;

  const priorityOrder = policy.priorityOrder ?? DEFAULT_PRIORITY_ORDER;
  for (const priority of priorityOrder) {
    const action = resolvePriorityAction(snapshot, actor, policy, priority);
    if (action) return action;
  }

  return { type: "end_turn", actorSeat: actor.seatId };
}
