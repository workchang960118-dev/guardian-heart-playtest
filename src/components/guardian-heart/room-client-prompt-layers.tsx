import type { ReactNode } from "react";

type BroadcastTone = "success" | "error" | "neutral";

type Props = {
  criticalAlertZh: string | null;
  centerBroadcastText: string | null;
  centerBroadcastTone?: BroadcastTone;
  liveReactionText: string | null;
  taskPromptText?: string | null;
  taskPromptTone?: "sky" | "emerald" | "amber" | "stone";
};

function taskPromptToneClasses(tone: Props["taskPromptTone"] = "sky") {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50/95 text-emerald-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50/95 text-amber-800";
  if (tone === "stone") return "border-stone-200 bg-white/95 text-stone-700";
  return "border-sky-200 bg-sky-50/95 text-sky-800";
}

function LayerShell(props: { className: string; children: ReactNode }) {
  return <div className={props.className}>{props.children}</div>;
}

export function RoomClientPromptLayers(props: Props) {
  const {
    criticalAlertZh,
    centerBroadcastText,
    centerBroadcastTone = "neutral",
    liveReactionText,
    taskPromptText,
    taskPromptTone = "sky",
  } = props;

  const centerToneClasses =
    centerBroadcastTone === "error"
      ? "border border-rose-200 bg-rose-50/92 text-rose-800"
      : centerBroadcastTone === "success"
        ? "border border-emerald-200 bg-emerald-50/92 text-emerald-800"
        : "ring-1 ring-stone-200/80 bg-white/88 text-stone-900";

  return (
    <>
      {criticalAlertZh ? (
        <LayerShell className="pointer-events-none fixed inset-x-0 top-[76px] z-[45] flex justify-center px-4">
          <div className="max-w-[1100px] rounded-full bg-rose-50/95 px-4 py-2 text-[11px] font-semibold text-rose-800 shadow-[0_10px_26px_rgba(244,63,94,0.14)] ring-1 ring-rose-200 backdrop-blur-sm animate-pulse">
            危急示警：{criticalAlertZh}
          </div>
        </LayerShell>
      ) : null}

      {centerBroadcastText ? (
        <LayerShell className="pointer-events-none fixed inset-x-0 top-[116px] z-[44] flex justify-center px-4">
          <div className={["max-w-[860px] rounded-full px-5 py-2.5 text-sm font-semibold shadow-[0_12px_30px_rgba(255,244,214,0.26)] backdrop-blur-sm", centerToneClasses].join(" ")}>
            {centerBroadcastText}
          </div>
        </LayerShell>
      ) : null}

      {taskPromptText ? (
        <LayerShell className="pointer-events-none fixed right-5 top-[158px] z-[43] hidden max-w-[320px] xl:block">
          <div className={["rounded-[20px] border px-4 py-3 text-[11px] font-medium leading-5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm", taskPromptToneClasses(taskPromptTone)].join(" ")}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">任務浮窗提示</p>
            <p className="mt-1">{taskPromptText}</p>
          </div>
        </LayerShell>
      ) : null}

      {liveReactionText ? (
        <LayerShell className="pointer-events-none fixed inset-x-0 bottom-5 z-[42] flex justify-center px-4">
          <div className="max-w-[700px] rounded-full border border-sky-200 bg-sky-50/94 px-4 py-2 text-[11px] font-medium text-sky-800 shadow-[0_10px_26px_rgba(14,165,233,0.12)] backdrop-blur-sm animate-[fadein_.18s_ease-out]">
            即時反應：{liveReactionText}
          </div>
        </LayerShell>
      ) : null}
    </>
  );
}
