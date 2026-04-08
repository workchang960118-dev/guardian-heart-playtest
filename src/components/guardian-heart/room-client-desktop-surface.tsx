import { useState, type ReactNode } from "react";
import { DesktopCardMetaStrip } from "@/components/guardian-heart/room-client-desktop-card-channels";
import { DesktopSinglePageHeader } from "@/components/guardian-heart/room-client-desktop-header";
import {
  DesktopAbilityStatusPanel,
  DesktopRecentActionFeedPanel,
  DesktopRoleAbilityPanel,
  DesktopSelectedCardPanel,
  DesktopSelectedTaskPanelCard,
  DesktopSurfaceFocusPanel,
  DesktopTaskEmptyStateCard,
} from "@/components/guardian-heart/room-client-desktop-status-panels";
import type {
  AbilityStatusItem,
  HandItem,
  RosterItem,
  RoleAbilityPanel,
  SelectedCardPanel,
  SelectedTaskPanel,
  TaskRailItem,
  ActionFeedItem,
  CardChannelSection,
  CardMetaPill,
  CardReservedSlot,
} from "@/components/guardian-heart/room-client-desktop-types";

type Props = {
  roomCode?: string;
  viewerRoleZh?: string;
  eventTitleZh: string;
  eventRequirementZh: string;
  eventRemainingZh: string;
  eventPenaltyZh: string;
  eventMetaPills?: CardMetaPill[];
  eventChannelSections?: CardChannelSection[];
  eventReservedSlots?: CardReservedSlot[];
  roundValueZh: string;
  pressureValue: number;
  remainingDaysZh?: string | null;
  pulseTaskRail: boolean;
  completedTasks: number;
  totalTasks: number;
  tasks: TaskRailItem[];
  roster: RosterItem[];
  handCards: HandItem[];
  selectedCardPanel: SelectedCardPanel | null;
  selectedTaskPanel: SelectedTaskPanel | null;
  roleAbilityPanel: RoleAbilityPanel | null;
  abilityStatuses: AbilityStatusItem[];
  mapStage: ReactNode;
  recentActionFeed: ActionFeedItem[];
  phaseLabelZh: string;
  phaseSummaryZh: string;
  focusSummaryZh: string;
  onSelectTask: (taskId: string) => void;
  onDeclareTask: (taskId: string) => void;
  onSelectCard: (cardId: string) => void;
  onSelectCardTarget?: (seat: string) => void;
  onSelectCardTile?: (tileId: string) => void;
  onSelectCardResource?: (value: "SR" | "SP") => void;
  onSelectCardTeammateResource?: (value: "SR" | "SP") => void;
  onCancelSelectedCard: () => void;
  onUseSelectedCard: () => void;
  canQuickInvest: boolean;
  investSr: number;
  investSp: number;
  onChangeInvestSr: (value: number) => void;
  onChangeInvestSp: (value: number) => void;
  onInvest: () => void;
  onSelectInvestConversion?: (value: "" | "SR_TO_SP" | "SP_TO_SR") => void;
  investConversionOptions?: Array<{
    value: "" | "SR_TO_SP" | "SP_TO_SR";
    labelZh: string;
    selected: boolean;
    disabled?: boolean;
  }>;
  investDisabled?: boolean;
  investedContributorCount?: number;
  investedContributorNamesZh?: string[];
};

function TaskPill({ item, onSelect }: { item: TaskRailItem; onSelect: (taskId: string) => void }) {
  const toneClasses = item.tone === "emerald"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : item.tone === "amber"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : item.tone === "sky"
        ? "border-sky-300 bg-sky-50 text-sky-800"
        : item.tone === "rose"
          ? "border-rose-300 bg-rose-50 text-rose-800"
          : "border-stone-200 bg-white text-stone-700";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(item.taskId)}
        className={[
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] whitespace-nowrap transition",
          item.isSelected
            ? "border-sky-500 bg-sky-50 text-sky-900 shadow-[0_2px_8px_rgba(56,189,248,0.14)]"
            : toneClasses,
          !item.isSelected && !item.isDone ? "hover:border-sky-300 hover:bg-sky-50/35" : "",
        ].join(" ")}
      >
        <span className={[
          "h-1.5 w-1.5 flex-none rounded-full",
          item.isDone ? "bg-emerald-400" : item.canDeclare ? "animate-pulse bg-emerald-500" : item.tone === "amber" ? "bg-amber-400" : item.tone === "sky" ? "bg-sky-400" : "bg-stone-300",
        ].join(" ")} />
        <span className="max-w-[92px] truncate font-medium">{item.title}</span>
        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] text-stone-500">{item.badgeZh}</span>
      </button>
      <div className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-[280px] -translate-x-1/2 rounded-[16px] border border-stone-200 bg-white/98 px-3 py-2 text-left shadow-xl backdrop-blur group-hover:block">
        <p className="text-[10px] font-semibold text-stone-900">{item.title}</p>
        <p className="mt-1 text-[10px] leading-5 text-stone-600">{item.summaryZh ?? item.hint}</p>
        <p className="mt-1 text-[9px] leading-4 text-stone-500">獎勵：{item.reward}</p>
      </div>
    </div>
  );
}

function PlayerRosterRow({ item, onSelectTarget }: { item: RosterItem; onSelectTarget?: (seat: string) => void }) {
  const emphasizedAbilityStateLabels = new Set(["可回應", "可轉換", "已建立"]);
  const shouldShowAbilityStateBadge =
    Boolean(item.abilityStateLabelZh) && emphasizedAbilityStateLabels.has(item.abilityStateLabelZh ?? "");
  const rowClasses = [
    "rounded-[14px] border px-2 py-2 transition text-left",
    item.isSelectedTarget
      ? "border-sky-400 bg-sky-50 shadow-[0_2px_8px_rgba(56,189,248,0.12)]"
      : item.canSelectTarget
        ? "border-sky-200 bg-sky-50/40 hover:border-sky-400 hover:bg-sky-50"
        : item.isActive
          ? "border-amber-300 bg-amber-50/80"
          : "border-stone-200 bg-white",
  ].join(" ");

  const content = (
    <>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[12px] font-semibold text-stone-900">{item.seat} {item.name}</span>
        <div className="flex gap-1">
          {item.isViewer ? <span className="rounded-full bg-stone-900 px-1.5 py-0.5 text-[8px] text-white">你</span> : null}
          {item.isActive ? <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[8px] text-amber-900">行動中</span> : null}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-stone-500">
        <span className="line-clamp-1">{item.roleName}</span>
        {item.roleAbilityName ? <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[8px] text-violet-700">{item.roleAbilityName}</span> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
        <span className="rounded-md bg-stone-100 px-1.5 py-0.5">SR <b>{item.sr}</b></span>
        <span className="rounded-md bg-stone-100 px-1.5 py-0.5">SP <b>{item.sp}</b></span>
        <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[9px] text-stone-600">{item.companionUsed ? "陪伴已用" : "陪伴"}</span>
        {typeof item.roleAbilityUsesRemaining === "number" && typeof item.roleAbilityUsesTotal === "number" ? <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[8px] text-violet-700">技能 {item.roleAbilityUsesRemaining}/{item.roleAbilityUsesTotal}</span> : null}
        {shouldShowAbilityStateBadge ? <span className={["rounded-full border px-1.5 py-0.5 text-[8px]", item.abilityStateTone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.abilityStateTone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : item.abilityStateTone === "rose" ? "border-rose-200 bg-rose-50 text-rose-700" : item.abilityStateTone === "violet" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-stone-200 bg-stone-50 text-stone-600"].join(" ")}>{item.abilityStateLabelZh}</span> : null}
      </div>
      {item.targetHintZh ? (
        <div className="mt-1 text-[9px]">
          <span className={item.isSelectedTarget ? "font-medium text-sky-700" : item.canSelectTarget ? "text-sky-700" : "text-stone-400"}>{item.targetHintZh}</span>
        </div>
      ) : null}
    </>
  );

  if (item.canSelectTarget || item.isSelectedTarget) {
    return (
      <button type="button" className={rowClasses} onClick={() => onSelectTarget?.(item.seat)}>
        {content}
      </button>
    );
  }

  return <div className={rowClasses}>{content}</div>;
}

function RoleSkillPanel({ item }: { item: RosterItem | null }) {
  if (!item || !item.roleAbilitySummary) {
    return (
      <div className="rounded-[14px] border border-dashed border-violet-200 bg-violet-50/50 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-violet-700">角色技能</p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[8px] text-violet-600">待確認</span>
        </div>
        <p className="mt-1 text-[9px] leading-4 text-stone-500">尚未取得角色技能說明。</p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-violet-200 bg-violet-50/70 px-2.5 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-violet-700">角色技能</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-medium text-violet-700">{item.roleName}</span>
      </div>
      <p className="mt-1 text-[9px] leading-4 text-stone-700">{item.roleAbilitySummary}</p>
    </div>
  );
}

function CollapsibleAbilityPanels({
  roleAbilityPanel,
  abilityStatuses,
}: {
  roleAbilityPanel: RoleAbilityPanel | null;
  abilityStatuses: AbilityStatusItem[];
}) {
  const [collapsed, setCollapsed] = useState(true);

  if (!roleAbilityPanel && abilityStatuses.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[16px] border border-stone-200 bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold text-violet-700">角色資訊</p>
          <p className="mt-0.5 text-[9px] text-stone-500">可摺疊查看技能與全隊狀態</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-700 hover:bg-stone-50"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? "展開" : "摺疊"}
        </button>
      </div>
      {collapsed ? (
        <div className="mt-2 rounded-[12px] border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-center text-[10px] text-stone-500">
          已摺疊角色技能資訊
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {roleAbilityPanel ? <DesktopRoleAbilityPanel panel={roleAbilityPanel} /> : null}
          {abilityStatuses.length > 0 ? <DesktopAbilityStatusPanel items={abilityStatuses} /> : null}
        </div>
      )}
    </div>
  );
}

function MapApOverlay({ item }: { item: RosterItem | null }) {
  if (!item) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/92 px-2.5 py-1 text-[10px] text-stone-700 shadow-sm backdrop-blur-[2px]">
      <span className="text-stone-500">目前行動</span>
      <span className="font-semibold text-stone-900">{item.seat}</span>
      <span className="font-semibold text-amber-700">AP {item.ap}</span>
    </div>
  );
}

function HandCard({ item, onSelect }: { item: HandItem; onSelect: (cardId: string) => void }) {
  const categoryLabel = item.category === "mobility" ? "機動" : item.category === "event_response" ? "事件" : "支援";
  return (
    <button
      type="button"
      onClick={() => onSelect(item.cardId)}
      className={[
        "w-full rounded-[14px] border px-2.5 py-2 text-left transition",
        item.selected ? "border-sky-400 bg-sky-50 shadow-[0_2px_8px_rgba(56,189,248,0.12)]" : "border-stone-200 bg-white hover:border-sky-300 hover:bg-sky-50/25",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="line-clamp-1 text-[11px] font-bold leading-5 text-stone-900">{item.title}</span>
        <span className="rounded-full border border-stone-200 px-1.5 py-0.5 text-[8px] text-stone-500">{categoryLabel}</span>
      </div>
      <DesktopCardMetaStrip items={item.metaPills ?? []} className="mt-1" />
      <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-stone-600">{item.description}</p>
    </button>
  );
}

export function DesktopSinglePageSurface(props: Props) {
  const {
    eventTitleZh,
    eventRequirementZh,
    eventRemainingZh,
    eventPenaltyZh,
    eventMetaPills = [],
    eventChannelSections = [],
    eventReservedSlots = [],
    roundValueZh,
    pressureValue,
    remainingDaysZh,
    pulseTaskRail,
    completedTasks,
    totalTasks,
    tasks,
    roster,
    handCards,
    selectedCardPanel,
    selectedTaskPanel,
    roleAbilityPanel,
    abilityStatuses,
    mapStage,
    recentActionFeed,
    phaseLabelZh,
    phaseSummaryZh,
    focusSummaryZh,
    onSelectTask,
    onDeclareTask,
    onSelectCard,
    onSelectCardTarget,
    onSelectCardTile,
    onSelectCardResource,
    onSelectCardTeammateResource,
    onCancelSelectedCard,
    onUseSelectedCard,
    canQuickInvest,
    investSr,
    investSp,
    onChangeInvestSr,
    onChangeInvestSp,
    onInvest,
    onSelectInvestConversion,
    investConversionOptions = [],
    investDisabled = false,
    investedContributorCount = 0,
    investedContributorNamesZh = [],
  } = props;

  const featuredRosterItem = roster.find((item) => item.isViewer && item.roleAbilitySummary)
    ?? roster.find((item) => item.isActive && item.roleAbilitySummary)
    ?? roster.find((item) => item.roleAbilitySummary)
    ?? null;
  const activeRosterItem = roster.find((item) => item.isActive)
    ?? roster.find((item) => item.isViewer)
    ?? null;

  return (
    <section className="space-y-1.5 rounded-[24px] border border-[#D9DEC0] bg-[#FBFBF7] p-2 shadow-sm">
      <DesktopSinglePageHeader
        eventTitleZh={eventTitleZh}
        eventRequirementZh={eventRequirementZh}
        eventRemainingZh={eventRemainingZh}
        eventPenaltyZh={eventPenaltyZh}
        eventMetaPills={eventMetaPills}
        eventChannelSections={eventChannelSections}
        eventReservedSlots={eventReservedSlots}
        pressureValue={pressureValue}
        roundValueZh={roundValueZh}
        remainingDaysZh={remainingDaysZh}
        canQuickInvest={canQuickInvest}
        investSr={investSr}
        investSp={investSp}
        onChangeInvestSr={onChangeInvestSr}
        onChangeInvestSp={onChangeInvestSp}
        onInvest={onInvest}
        onSelectInvestConversion={onSelectInvestConversion}
        investConversionOptions={investConversionOptions}
        investDisabled={investDisabled}
        investedContributorCount={investedContributorCount}
        investedContributorNamesZh={investedContributorNamesZh}
      />

      <div className="flex flex-col gap-1.5 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div
            id="gh-guide-zone-tasks"
            className={[
              "flex items-center gap-2 rounded-[16px] border border-[#E7EAD6] bg-white px-2 py-1",
              pulseTaskRail ? "animate-pulse" : "",
            ].join(" ")}
          >
            <span className="flex-none text-[10px] font-semibold text-[#5E6B2C]">任務</span>
            <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
              <div className="flex min-w-max items-center gap-1.5 pr-2">
                {tasks.map((task) => <TaskPill key={`rail-${task.taskId}`} item={task} onSelect={onSelectTask} />)}
              </div>
            </div>
            <span className="flex-none text-[10px] font-medium text-stone-500"><b className={completedTasks >= 2 ? "text-emerald-600" : "text-rose-600"}>{completedTasks}</b>/{totalTasks}</span>
          </div>

          <div className="flex flex-col gap-1.5 xl:flex-row xl:items-start">
            <aside id="gh-guide-zone-roster" className="w-full space-y-1.5 xl:w-[124px] xl:flex-none">
              <RoleSkillPanel item={featuredRosterItem} />
              {roster.map((player) => <PlayerRosterRow key={`roster-${player.seat}`} item={player} onSelectTarget={onSelectCardTarget} />)}
            </aside>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="rounded-[20px] border border-[#D9DEC0] bg-white p-1 shadow-sm">
                <div id="gh-guide-zone-map" className="relative min-h-[700px] overflow-hidden rounded-[18px] bg-[#FCFCFA] xl:min-h-[780px]">
                  <MapApOverlay item={activeRosterItem} />
                  {mapStage}
                </div>
              </div>
              <div className="grid gap-1.5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <DesktopRecentActionFeedPanel items={recentActionFeed} />
                <DesktopSurfaceFocusPanel phaseLabelZh={phaseLabelZh} phaseSummaryZh={phaseSummaryZh} focusSummaryZh={focusSummaryZh} />
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full space-y-1.5 xl:w-[290px] xl:flex-none">
          {selectedTaskPanel ? <DesktopSelectedTaskPanelCard panel={selectedTaskPanel} onDeclare={onDeclareTask} /> : <DesktopTaskEmptyStateCard />}

          <div id="gh-guide-zone-hand" className="rounded-[16px] border border-stone-200 bg-white p-2 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <p className="text-[10px] font-semibold text-[#5E6B2C]">手牌</p>
              <div className="flex items-center gap-1">
                {selectedCardPanel ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] text-sky-700">已選 1 張</span> : null}
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] text-stone-500">{handCards.length}/3</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {handCards.length > 0 ? handCards.map((card, index) => <HandCard key={`hand-${card.cardId}-${index}`} item={card} onSelect={onSelectCard} />) : <div className="rounded-[14px] border border-dashed border-stone-200 px-3 py-3 text-center text-[10px] text-stone-400">沒有手牌</div>}
            </div>
          </div>

          {selectedCardPanel ? (
            <DesktopSelectedCardPanel
              panel={selectedCardPanel}
              onCancel={onCancelSelectedCard}
              onUse={onUseSelectedCard}
              onSelectTarget={onSelectCardTarget}
              onSelectTile={onSelectCardTile}
              onSelectResource={onSelectCardResource}
              onSelectTeammateResource={onSelectCardTeammateResource}
            />
          ) : null}

          <CollapsibleAbilityPanels roleAbilityPanel={roleAbilityPanel} abilityStatuses={abilityStatuses} />
        </aside>
      </div>
    </section>
  );
}
