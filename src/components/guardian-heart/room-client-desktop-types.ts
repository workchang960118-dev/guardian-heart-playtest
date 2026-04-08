export type BadgeTone = "stone" | "amber" | "emerald" | "sky" | "rose" | "violet";
export type FeedbackTone = "success" | "error";

export type CardMetaPill = {
  key: string;
  labelZh: string;
  tone?: BadgeTone;
};

export type CardChannelSection = {
  key: string;
  titleZh: string;
  bodyZh: string;
  tone?: BadgeTone;
};

export type CardReservedSlot = {
  key: string;
  labelZh: string;
  statusZh: string;
};

export type TaskRailItem = {
  taskId: string;
  title: string;
  subtitle: string;
  reward: string;
  isDone: boolean;
  isSelected: boolean;
  hint?: string;
  summaryZh?: string;
  badgeZh: string;
  tone: BadgeTone;
  canDeclare: boolean;
};

export type RosterItem = {
  seat: string;
  name: string;
  roleName: string;
  roleAbilityName?: string;
  sr: number;
  sp: number;
  ap: number;
  companionUsed: boolean;
  isActive: boolean;
  isViewer: boolean;
  isAi: boolean;
  positionTileId: string | null;
  roleAbilitySummary?: string;
  roleAbilityUsesRemaining?: number;
  roleAbilityUsesTotal?: number;
  abilityStateLabelZh?: string;
  abilityStateTone?: BadgeTone;
  canSelectTarget?: boolean;
  isSelectedTarget?: boolean;
  targetHintZh?: string;
};

export type HandItem = {
  cardId: string;
  title: string;
  category: string;
  description: string;
  note: string;
  selected: boolean;
  metaPills?: CardMetaPill[];
};

export type SelectedCardPanel = {
  title: string;
  rulesText: string;
  disabled: boolean;
  actionLabel: string;
  helperText: string;
  targetPromptZh?: string;
  targetSummaryZh?: string;
  targetOptions?: Array<{
    seat: string;
    labelZh: string;
    selected: boolean;
    disabled?: boolean;
  }>;
  tilePromptZh?: string;
  tileSummaryZh?: string;
  tileOptions?: Array<{
    tileId: string;
    labelZh: string;
    selected: boolean;
    disabled?: boolean;
  }>;
  resourcePromptZh?: string;
  resourceSummaryZh?: string;
  resourceOptions?: Array<{
    value: "SR" | "SP";
    labelZh: string;
    selected: boolean;
    disabled?: boolean;
  }>;
  teammateResourcePromptZh?: string;
  teammateResourceSummaryZh?: string;
  teammateResourceOptions?: Array<{
    value: "SR" | "SP";
    labelZh: string;
    selected: boolean;
    disabled?: boolean;
  }>;
  metaPills?: CardMetaPill[];
  channelSections?: CardChannelSection[];
  reservedSlots?: CardReservedSlot[];
};

export type SelectedTaskPanel = {
  taskId: string;
  title: string;
  subtitle: string;
  rulesText: string;
  reward: string;
  badgeZh: string;
  tone: BadgeTone;
  summaryZh: string;
  reasonsZh: string[];
  progressLinesZh: string[];
  canDeclare: boolean;
  declareDisabledReasonZh?: string;
  overviewCounts: {
    completed: number;
    ready: number;
    waitCampfire: number;
    blocked: number;
  };
  metaPills?: CardMetaPill[];
  channelSections?: CardChannelSection[];
  reservedSlots?: CardReservedSlot[];
};

export type RoleAbilityPanel = {
  roleNameZh: string;
  abilityNameZh: string;
  abilitySummaryZh: string;
  usesRemaining: number;
  usesTotal: number;
  stateLabelZh: string;
  detailZh: string;
  tone: BadgeTone;
  interactionHintZh?: string;
};

export type ActionFeedItem = {
  occurredAt: string;
  titleZh: string;
  text: string;
  detailsZh: string[];
  tone: FeedbackTone;
};

export type AbilityStatusItem = {
  key: string;
  labelZh: string;
  stateLabelZh: string;
  detailZh: string;
  tone: BadgeTone;
};
