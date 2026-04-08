import type { ReactNode } from "react";
import { DesktopCardMetaStrip } from "@/components/guardian-heart/room-client-desktop-card-channels";
import type { BadgeTone, CardChannelSection, CardMetaPill, CardReservedSlot } from "@/components/guardian-heart/room-client-desktop-types";

type MetricCard = {
  labelZh: string;
  valueZh: string;
  tone?: BadgeTone;
};

type Props = {
  eventTitleZh: string;
  eventRequirementZh: string;
  eventRemainingZh: string;
  eventPenaltyZh: string;
  eventMetaPills?: CardMetaPill[];
  eventChannelSections?: CardChannelSection[];
  eventReservedSlots?: CardReservedSlot[];
  pressureValue: number;
  roundValueZh: string;
  remainingDaysZh?: string | null;
  metrics?: MetricCard[];
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

function toneClasses(tone: BadgeTone = "stone") {
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "violet") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-stone-200 bg-stone-50 text-stone-700";
}

function MetricPill({ item }: { item: MetricCard }) {
  return (
    <span className={["inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] leading-none whitespace-nowrap", toneClasses(item.tone)].join(" ")}>
      <span className="opacity-65">{item.labelZh}</span>
      <span className="font-semibold">{item.valueZh}</span>
    </span>
  );
}

function clampPressureBand(value: number) {
  if (value >= 7) {
    return {
      toneClass: "border-rose-300 bg-rose-50 text-rose-700",
      dotClass: "bg-rose-500",
      bandLabelZh: "高壓",
    };
  }

  if (value >= 4) {
    return {
      toneClass: "border-amber-300 bg-amber-50 text-amber-700",
      dotClass: "bg-amber-500",
      bandLabelZh: "警戒",
    };
  }

  return {
    toneClass: "border-emerald-300 bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
    bandLabelZh: "穩定",
  };
}

function HoverBubble({
  label,
  content,
  align = "left",
}: {
  label: ReactNode;
  content: string;
  align?: "left" | "center" | "right";
}) {
  const alignClass = align === "center"
    ? "left-1/2 -translate-x-1/2"
    : align === "right"
      ? "right-0"
      : "left-0";

  return (
    <div className="group relative inline-flex">
      <div className="cursor-help">{label}</div>
      <div className={["pointer-events-none absolute top-[calc(100%+8px)] z-30 hidden w-[260px] rounded-[18px] border border-stone-200 bg-stone-950 px-3 py-2 text-[10px] leading-5 text-stone-50 shadow-xl group-hover:block", alignClass].join(" ")}>
        {content.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
      </div>
    </div>
  );
}

function InvestContributorPill({ count, namesZh }: { count: number; namesZh: string[] }) {
  const hoverText = namesZh.length > 0 ? `已投入玩家：${namesZh.join("、")}` : "無人投入";

  return (
    <HoverBubble
      align="left"
      content={hoverText}
      label={<span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] text-stone-500">投入 {count} 人</span>}
    />
  );
}

function InvestHintPill() {
  return (
    <HoverBubble
      align="left"
      content={"填入要投入的 SR / SP 後按下投入。\n若角色允許資源轉換，會在這裡出現切換按鈕。"}
      label={<span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[9px] text-amber-700">操作提示</span>}
    />
  );
}

function CompactEventEffectCard({
  titleZh,
  bodyZh,
  tone = "rose",
}: {
  titleZh: string;
  bodyZh: string;
  tone?: BadgeTone;
}) {
  return (
    <div className={["min-w-0 flex-1 rounded-[16px] border px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.85)]", toneClasses(tone)].join(" ")}>
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em]">{titleZh}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[10px] leading-4">{bodyZh}</p>
    </div>
  );
}

function PressureStatusSlider({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(10, value));
  const pressureBand = clampPressureBand(clampedValue);
  const thumbPercent = `${(clampedValue / 10) * 100}%`;
  const markPercent = (threshold: number) => `${(threshold / 10) * 100}%`;

  return (
    <HoverBubble
      align="right"
      content={`0–3 綠燈，4–6 黃燈，7–10 紅燈。\n壓力 3：下一輪起，事件需至少 2 名不同玩家實際投入。\n壓力 6：下一輪起，若本輪無 0AP 相鄰互助，不能宣告任務。\n壓力 10：遊戲失敗。`}
      label={(
        <div className={[
          "flex min-w-[154px] flex-col rounded-[16px] border px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.85)]",
          pressureBand.toneClass,
        ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] leading-none">
            <span className="font-semibold">壓力 {clampedValue}</span>
            <span className="rounded-full bg-white/75 px-1.5 py-0.5 text-[9px] font-medium">{pressureBand.bandLabelZh}</span>
          </div>

          <div className="relative mt-2 h-3">
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[linear-gradient(to_right,#22c55e_0%,#22c55e_30%,#f59e0b_30%,#f59e0b_60%,#ef4444_60%,#ef4444_100%)] shadow-inner" />
            {[0, 3, 6, 10].map((threshold) => (
              <span
                key={`pressure-threshold-${threshold}`}
                className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                style={{ left: markPercent(threshold) }}
              />
            ))}
            <span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-stone-900 shadow-[0_3px_10px_rgba(15,23,42,0.28)] transition-[left] duration-700 ease-out"
              style={{ left: thumbPercent }}
            />
          </div>

          <div className="mt-1 flex items-center justify-between text-[8px] font-medium leading-none text-stone-500">
            <span>0</span>
            <span>3</span>
            <span>6</span>
            <span>10</span>
          </div>
        </div>
      )}
    />
  );
}

function RoundTimelineCard({ roundValueZh, remainingDaysZh }: { roundValueZh: string; remainingDaysZh?: string | null }) {
  const compactDaysZh = remainingDaysZh?.replace(/^剩餘\s*/, "") ?? null;

  return (
    <div className="flex min-w-[96px] flex-col items-end self-stretch rounded-[16px] border border-stone-200 bg-white px-3 py-2 text-right shadow-[0_1px_0_rgba(255,255,255,0.85)]">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">回合</span>
      <span className="text-[12px] font-bold leading-4 text-stone-900">{roundValueZh}</span>
      {compactDaysZh ? <span className="mt-0.5 text-[9px] leading-none text-stone-500">剩餘 {compactDaysZh}</span> : null}
    </div>
  );
}

function InvestStepper({
  label,
  value,
  onChange,
}: {
  label: "SR" | "SP";
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] text-stone-700">
      <span className="font-semibold text-amber-900">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-8 bg-transparent text-center font-semibold text-stone-900 outline-none"
        inputMode="numeric"
      />
    </label>
  );
}

export function DesktopSinglePageHeader(props: Props) {
  const {
    eventTitleZh,
    eventRequirementZh,
    eventRemainingZh,
    eventPenaltyZh,
    eventMetaPills = [],
    eventChannelSections = [],
    eventReservedSlots = [],
    pressureValue,
    roundValueZh,
    remainingDaysZh,
    metrics = [],
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

  const immediateEffectBodyZh = eventChannelSections[0]?.bodyZh ?? "本輪沒有立即效果。";

  return (
    <header className="rounded-[18px] border border-[#D9DEC0] bg-white px-3 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.9)]">
      <div className="grid gap-1.5 xl:grid-cols-[minmax(260px,340px)_minmax(320px,1fr)_minmax(250px,300px)_minmax(154px,154px)_minmax(96px,96px)] xl:items-stretch">
        <div id="gh-guide-zone-event" className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-500">
            <span className="font-semibold uppercase tracking-[0.16em] text-[#5E6B2C]">本輪事件</span>
            <span className="text-[16px] font-bold text-stone-950">{eventTitleZh}</span>
            <InvestContributorPill count={investedContributorCount} namesZh={investedContributorNamesZh} />
          </div>

          {eventMetaPills.length > 0 ? <DesktopCardMetaStrip items={eventMetaPills} className="mt-1" /> : null}

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-none text-stone-600">
            <span className="rounded-full bg-stone-50 px-2 py-1 text-stone-700">解決 <span className="font-semibold text-stone-950">{eventRequirementZh}</span></span>
            <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">缺 <span className="font-semibold">{eventRemainingZh}</span></span>
          </div>
        </div>

        <div className="flex min-w-0 items-stretch gap-1.5">
          <CompactEventEffectCard titleZh="立即效果" bodyZh={immediateEffectBodyZh} tone="rose" />
          <CompactEventEffectCard titleZh="未解懲罰" bodyZh={eventPenaltyZh.replace(/^未解懲罰：/, "")} tone="amber" />
        </div>

        <div className="flex flex-col justify-center gap-1 rounded-[16px] border border-amber-200 bg-amber-50 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-amber-900">投入</span>
            <InvestStepper label="SR" value={investSr} onChange={onChangeInvestSr} />
            <InvestStepper label="SP" value={investSp} onChange={onChangeInvestSp} />
            <button
              type="button"
              disabled={!canQuickInvest || investDisabled}
              onClick={onInvest}
              className="rounded-full bg-stone-900 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
            >
              投入
            </button>
          </div>
          {investConversionOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 pl-1">
              <span className="text-[9px] font-medium text-violet-700">資源轉換</span>
              {investConversionOptions.map((option) => (
                <button
                  key={`invest-convert-${option.value || "none"}`}
                  type="button"
                  disabled={option.disabled || !onSelectInvestConversion}
                  onClick={() => onSelectInvestConversion?.(option.value)}
                  className={[
                    "rounded-full border px-2 py-0.5 text-[9px] transition",
                    option.selected
                      ? "border-violet-500 bg-violet-600 text-white"
                      : option.disabled
                        ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                        : "border-violet-200 bg-white text-violet-800 hover:border-violet-400 hover:bg-violet-50",
                  ].join(" ")}
                >
                  {option.labelZh}
                </button>
              ))}
            </div>
          ) : null}
          <div className="pl-1">
            <InvestHintPill />
          </div>
        </div>

        <div className="flex items-stretch justify-end self-stretch">
          <PressureStatusSlider value={pressureValue} />
        </div>

        <div className="flex items-stretch justify-end gap-2 self-stretch">
          {metrics.map((item) => <MetricPill key={`hdr-${item.labelZh}-${item.valueZh}`} item={item} />)}
          <RoundTimelineCard roundValueZh={roundValueZh} remainingDaysZh={remainingDaysZh} />
        </div>
      </div>
    </header>
  );
}
