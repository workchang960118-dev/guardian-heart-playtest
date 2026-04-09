import { useState } from "react";
import {
  DesktopCardChannelSections,
  DesktopCardMetaStrip,
} from "@/components/guardian-heart/room-client-desktop-card-channels";
import type {
  AbilityStatusItem,
  ActionFeedItem,
  BadgeTone,
  SelectedCardPanel,
  SelectedTaskPanel,
  RoleAbilityPanel,
} from "@/components/guardian-heart/room-client-desktop-types";

function toneBadgeClasses(tone: BadgeTone) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "violet") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-[#D9DEC0] bg-[#FAFBF6] text-stone-700";
}

export function DesktopSelectedCardPanel({
  panel,
  onCancel,
  onUse,
  onSelectTarget,
  onSelectTile,
  onSelectResource,
  onSelectTeammateResource,
}: {
  panel: SelectedCardPanel;
  onCancel: () => void;
  onUse: () => void;
  onSelectTarget?: (seat: string) => void;
  onSelectTile?: (tileId: string) => void;
  onSelectResource?: (value: "SR" | "SP") => void;
  onSelectTeammateResource?: (value: "SR" | "SP") => void;
}) {
  return (
    <div className="rounded-[16px] border border-[#C9D7A0] bg-white p-2.5 shadow-[0_14px_30px_rgba(94,107,44,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-stone-950">{panel.title}</p>
        </div>
        <button type="button" className="rounded-full border border-[#C8D1A7] bg-white px-2.5 py-1 text-[10px] text-[#5E6B2C] transition hover:bg-[#F0F4E2]" onClick={onCancel}>取消</button>
      </div>
      <DesktopCardMetaStrip items={panel.metaPills ?? []} className="mt-2" />
      <div className="mt-2">
        <DesktopCardChannelSections
          items={panel.channelSections ?? [{ key: "rules", titleZh: "牌面規則", bodyZh: panel.rulesText, tone: "stone" }]}
          columns={1}
        />
      </div>
      {panel.targetPromptZh ? (
        <div className="mt-3 rounded-[12px] border border-sky-200 bg-sky-50/70 p-2">
          <p className="text-[10px] font-semibold text-sky-800">{panel.targetPromptZh}</p>
          {panel.targetOptions && panel.targetOptions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {panel.targetOptions.map((option) => (
                <button
                  key={`selected-card-target-${option.seat}`}
                  type="button"
                  className={[
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                    option.selected
                      ? "border-sky-500 bg-sky-600 text-white"
                      : option.disabled
                        ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                        : "border-sky-200 bg-white text-sky-800 hover:border-sky-400 hover:bg-sky-50",
                  ].join(" ")}
                  disabled={option.disabled || !onSelectTarget}
                  onClick={() => onSelectTarget?.(option.seat)}
                >
                  {option.labelZh}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[10px] leading-5 text-stone-500">暫無合法目標。</p>
          )}
          {panel.targetSummaryZh ? <p className="mt-2 text-[10px] leading-5 text-stone-600">{panel.targetSummaryZh}</p> : null}
        </div>
      ) : null}
      {panel.tilePromptZh ? (
        <div className="mt-3 rounded-[12px] border border-violet-200 bg-violet-50/70 p-2">
          <p className="text-[10px] font-semibold text-violet-800">{panel.tilePromptZh}</p>
          {panel.tileOptions && panel.tileOptions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {panel.tileOptions.map((option) => (
                <button
                  key={`selected-card-tile-${option.tileId}`}
                  type="button"
                  className={[
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                    option.selected
                      ? "border-violet-500 bg-violet-600 text-white"
                      : option.disabled
                        ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                        : "border-violet-200 bg-white text-violet-800 hover:border-violet-400 hover:bg-violet-50",
                  ].join(" ")}
                  disabled={option.disabled || !onSelectTile}
                  onClick={() => onSelectTile?.(option.tileId)}
                >
                  {option.labelZh}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[10px] leading-5 text-stone-500">暫無合法地格。</p>
          )}
          {panel.tileSummaryZh ? <p className="mt-2 text-[10px] leading-5 text-stone-600">{panel.tileSummaryZh}</p> : null}
        </div>
      ) : null}
      {panel.resourcePromptZh ? (
        <div className="mt-3 rounded-[12px] border border-amber-200 bg-amber-50/70 p-2">
          <p className="text-[10px] font-semibold text-amber-800">{panel.resourcePromptZh}</p>
          {panel.resourceOptions && panel.resourceOptions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {panel.resourceOptions.map((option) => (
                <button
                  key={`selected-card-resource-${option.value}`}
                  type="button"
                  className={[
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                    option.selected
                      ? "border-amber-500 bg-amber-500 text-white"
                      : option.disabled
                        ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                        : "border-amber-200 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-50",
                  ].join(" ")}
                  disabled={option.disabled || !onSelectResource}
                  onClick={() => onSelectResource?.(option.value)}
                >
                  {option.labelZh}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[10px] leading-5 text-stone-500">暫無可選資源。</p>
          )}
          {panel.resourceSummaryZh ? <p className="mt-2 text-[10px] leading-5 text-stone-600">{panel.resourceSummaryZh}</p> : null}
        </div>
      ) : null}
      {panel.teammateResourcePromptZh ? (
        <div className="mt-3 rounded-[12px] border border-emerald-200 bg-emerald-50/70 p-2">
          <p className="text-[10px] font-semibold text-emerald-800">{panel.teammateResourcePromptZh}</p>
          {panel.teammateResourceOptions && panel.teammateResourceOptions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {panel.teammateResourceOptions.map((option) => (
                <button
                  key={`selected-card-teammate-resource-${option.value}`}
                  type="button"
                  className={[
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                    option.selected
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : option.disabled
                        ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                        : "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50",
                  ].join(" ")}
                  disabled={option.disabled || !onSelectTeammateResource}
                  onClick={() => onSelectTeammateResource?.(option.value)}
                >
                  {option.labelZh}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[10px] leading-5 text-stone-500">暫無可選隊友投入資源。</p>
          )}
          {panel.teammateResourceSummaryZh ? <p className="mt-2 text-[10px] leading-5 text-stone-600">{panel.teammateResourceSummaryZh}</p> : null}
        </div>
      ) : null}
      <button className="mt-3 w-full rounded-[12px] bg-[#5E6B2C] px-3 py-2 text-[12px] font-medium text-white shadow-[0_8px_18px_rgba(94,107,44,0.18)] disabled:opacity-40" disabled={panel.disabled} onClick={onUse}>{panel.actionLabel}</button>
      <p className="mt-2 text-[10px] leading-5 text-stone-400">{panel.helperText}</p>
    </div>
  );
}

export function DesktopTaskEmptyStateCard() {
  return (
    <div className="rounded-[16px] border border-dashed border-[#D9DEC0] bg-[#FCFCFA] px-3 py-3 shadow-[0_6px_16px_rgba(94,107,44,0.025)]">
      <p className="text-[10px] font-semibold text-[#5E6B2C]">任務</p>
      <p className="mt-1 text-[10px] leading-5 text-stone-500">點上方任務看詳情。</p>
    </div>
  );
}

export function DesktopSelectedTaskPanelCard({ panel, onDeclare }: { panel: SelectedTaskPanel; onDeclare: (taskId: string) => void; }) {
  const [showFullText, setShowFullText] = useState(false);
  const detailLines = panel.progressLinesZh.filter((line, index, array) => array.indexOf(line) === index);
  const noteLines = panel.reasonsZh
    .filter((reason, index, array) => array.indexOf(reason) === index)
    .filter((reason) => reason !== panel.summaryZh && !detailLines.includes(reason) && reason !== panel.declareDisabledReasonZh)
    .slice(0, 2);

  return (
    <>
      <div className="rounded-[16px] border border-[#C9D7A0] bg-white p-2.5 shadow-[0_16px_32px_rgba(94,107,44,0.08)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-700">任務詳情</p>
            <h3 className="mt-1 text-[14px] font-bold leading-5 tracking-[-0.01em] text-stone-950">{panel.title}</h3>
          </div>
          <span className={["rounded-full border px-2 py-0.5 text-[9px] font-medium", toneBadgeClasses(panel.tone)].join(" ")}>{panel.badgeZh}</span>
        </div>

        <div className="mt-2 rounded-[12px] bg-emerald-50/65 px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">目前狀態</p>
          <p className="mt-1 text-[10px] leading-5 text-emerald-900">{panel.summaryZh}</p>
        </div>

        <div className="mt-2 space-y-1.5 text-[10px] leading-5 text-stone-700">
          <div className="rounded-[12px] border border-[#D9DEC0] bg-[#FAFBF6] px-3 py-2">
            <p className="font-semibold text-stone-900">條件</p>
            <p className="mt-1 text-stone-600">{panel.subtitle}</p>
          </div>
          <div className="rounded-[12px] border border-[#D9DEC0] bg-[#FAFBF6] px-3 py-2">
            <p className="font-semibold text-stone-900">獎勵</p>
            <p className="mt-1 text-stone-600">{panel.reward}</p>
          </div>
        </div>

        {detailLines.length > 0 ? (
          <div className="mt-2 rounded-[12px] border border-sky-100 bg-sky-50/55 px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-700">{panel.canDeclare ? "目前進度" : "目前差什麼"}</p>
            <ul className="mt-1 space-y-1 text-[10px] leading-5 text-stone-700">
              {detailLines.slice(0, 2).map((line) => <li key={line}>• {line}</li>)}
            </ul>
          </div>
        ) : null}

        {!panel.canDeclare && panel.declareDisabledReasonZh ? (
          <div className="mt-2 rounded-[12px] border border-[#D9DEC0] bg-[#FAFBF6] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-600">目前不可宣告</p>
            <p className="mt-1 text-[10px] leading-5 text-stone-600">{panel.declareDisabledReasonZh}</p>
          </div>
        ) : null}

        {noteLines.length > 0 ? (
          <div className="mt-2 rounded-[12px] border border-[#D9DEC0] bg-white px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-600">提醒</p>
            <ul className="mt-1 space-y-1 text-[10px] leading-5 text-stone-700">
              {noteLines.map((line) => <li key={line}>• {line}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="rounded-[12px] border border-[#D9DEC0] bg-[#FAFBF6] px-3 py-2 text-[11px] font-medium text-stone-600" onClick={() => setShowFullText(true)}>查看全文</button>
          <button type="button" className="rounded-[12px] bg-[#5E6B2C] px-3 py-2 text-[12px] font-medium text-white shadow-[0_8px_18px_rgba(94,107,44,0.18)] disabled:opacity-40" disabled={!panel.canDeclare} onClick={() => onDeclare(panel.taskId)}>
            {panel.canDeclare ? "宣告任務" : "目前不可宣告"}
          </button>
        </div>
      </div>

      {showFullText ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-stone-950/50 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[720px] rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">任務全文</p>
                <h3 className="mt-1 text-[22px] font-bold text-stone-950">{panel.title}</h3>
              </div>
              <button type="button" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[11px] text-stone-600" onClick={() => setShowFullText(false)}>關閉</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={["rounded-full border px-2.5 py-1 text-[10px] font-medium", toneBadgeClasses(panel.tone)].join(" ")}>{panel.badgeZh}</span>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] text-stone-600">條件：{panel.subtitle}</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-3">
                <div className="rounded-[16px] border border-[#D9DEC0] bg-[#FAFBF6] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">條件</p>
                  <p className="mt-2 text-[13px] leading-7 text-stone-800">{panel.rulesText}</p>
                </div>
                <div className="rounded-[16px] border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">獎勵</p>
                  <p className="mt-2 text-[13px] leading-7 text-stone-800">{panel.reward}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-[16px] border border-sky-100 bg-sky-50/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">{panel.canDeclare ? "目前進度" : "目前差什麼"}</p>
                  <ul className="mt-2 space-y-1.5 text-[12px] leading-6 text-stone-700">
                    {(detailLines.length > 0 ? detailLines : [panel.summaryZh]).map((line) => <li key={line}>• {line}</li>)}
                  </ul>
                </div>
                {panel.declareDisabledReasonZh || noteLines.length > 0 ? (
                  <div className="rounded-[16px] border border-[#D9DEC0] bg-white px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">{panel.canDeclare ? "補充" : "目前不可宣告"}</p>
                    <ul className="mt-2 space-y-1.5 text-[12px] leading-6 text-stone-700">
                      {(panel.canDeclare ? noteLines : [panel.declareDisabledReasonZh, ...noteLines].filter(Boolean) as string[]).map((reason) => <li key={reason}>• {reason}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-stone-200 pt-4 sm:flex-row">
              <button type="button" className="rounded-[14px] border border-stone-300 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-700" onClick={() => setShowFullText(false)}>關閉</button>
              <button type="button" className="rounded-[14px] bg-emerald-600 px-4 py-2.5 text-[12px] font-medium text-white disabled:opacity-40" disabled={!panel.canDeclare} onClick={() => onDeclare(panel.taskId)}>
                {panel.canDeclare ? "宣告任務" : "目前不可宣告"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DesktopAbilityStatusPanel({ items }: { items: AbilityStatusItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-[16px] border border-violet-100 bg-[#FCFCFA] p-2.5 shadow-[0_8px_20px_rgba(109,40,217,0.04)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-700">角色技能總覽</p>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] text-violet-700">本輪</span>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 6).map((item) => (
          <div key={item.key} className="rounded-[12px] border border-[#D9DEC0] bg-[#FAFBF6] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[10px] font-medium text-stone-900">{item.labelZh}</p>
              <span className={["rounded-full border px-2 py-0.5 text-[9px] font-medium", toneBadgeClasses(item.tone)].join(" ")}>{item.stateLabelZh}</span>
            </div>
            <p className="mt-1 text-[10px] leading-5 text-stone-600">{item.detailZh}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DesktopRoleAbilityPanel({ panel }: { panel: RoleAbilityPanel }) {
  return (
    <div className="rounded-[16px] border border-violet-200 bg-[#FCFCFA] p-2.5 shadow-[0_8px_20px_rgba(109,40,217,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-700">角色技能</p>
          <h3 className="mt-1 text-[14px] font-bold text-stone-950">{panel.roleNameZh}｜{panel.abilityNameZh}</h3>
        </div>
        <span className={["rounded-full border px-2 py-0.5 text-[9px] font-medium", toneBadgeClasses(panel.tone)].join(" ")}>{panel.stateLabelZh}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-stone-600">
        <span>剩餘次數</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-700">{panel.usesRemaining}/{panel.usesTotal}</span>
      </div>
      <p className="mt-2 rounded-[12px] bg-violet-50/70 px-3 py-2 text-[10px] leading-5 text-violet-950">{panel.abilitySummaryZh}</p>
      <p className="mt-2 text-[10px] leading-5 text-stone-700">{panel.detailZh}</p>
      {panel.interactionHintZh ? <p className="mt-2 text-[10px] leading-5 text-stone-500">{panel.interactionHintZh}</p> : null}
    </div>
  );
}

export function DesktopRecentActionFeedPanel({ items }: { items: ActionFeedItem[] }) {
  return (
    <div className="rounded-[16px] border border-[#D9DEC0] bg-[#FDFDFB] px-3 py-2 shadow-[0_6px_16px_rgba(94,107,44,0.03)]">
      <div className="flex items-center gap-2 text-[10px] text-stone-500">
        <span className="font-semibold text-[#5E6B2C]">最近動作</span>
        <span>保留 {Math.min(items.length, 3)} 筆</span>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {items.slice(0, 3).map((feedback) => (
            <div key={`${feedback.occurredAt}-${feedback.titleZh}`} className={["rounded-[12px] px-2.5 py-2 text-[10px]", feedback.tone === "success" ? "bg-[#F2F6E4] text-[#5E6B2C]" : "bg-rose-50 text-rose-800"].join(" ")}>
              <p className="font-semibold">{feedback.titleZh}</p>
          {feedback.detailsZh[0] ? <p className="mt-0.5 line-clamp-1 text-[9px] text-current/70">{feedback.detailsZh[0]}</p> : null}
            </div>
          ))}
        </div>
      ) : <p className="mt-2 text-[10px] leading-5 text-stone-500">暫無新回饋。</p>}
    </div>
  );
}

export function DesktopSurfaceFocusPanel({ phaseLabelZh, phaseSummaryZh, focusSummaryZh }: { phaseLabelZh: string; phaseSummaryZh: string; focusSummaryZh: string }) {
  return (
    <div className="rounded-[16px] border border-[#D9DEC0] bg-[#FDFDFB] px-3 py-2 shadow-[0_6px_16px_rgba(94,107,44,0.03)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-[#5E6B2C]">目前焦點</p>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] text-stone-700">{phaseLabelZh}</span>
      </div>
      <div className="mt-2 rounded-[12px] bg-[#FAFBF6] px-2.5 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">流程</p>
        <p className="mt-1 text-[10px] leading-5 text-stone-600">{phaseSummaryZh}</p>
        <p className="mt-2 border-t border-[#E7EAD6] pt-2 text-[10px] leading-5 text-stone-500">
          <span className="font-semibold text-stone-700">下一步：</span>
          {focusSummaryZh}
        </p>
      </div>
    </div>
  );
}
