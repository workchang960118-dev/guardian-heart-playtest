import type { BadgeTone, CardChannelSection, CardMetaPill } from "@/components/guardian-heart/room-client-desktop-types";

function toneClasses(tone: BadgeTone = "stone") {
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "violet") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-[#D9DEC0] bg-[#FAFBF6] text-stone-700";
}

export function DesktopCardMetaStrip({ items, className = "" }: { items: CardMetaPill[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <div className={["flex flex-wrap items-center gap-1.5", className].join(" ").trim()}>
      {items.map((item) => (
        <span
          key={item.key}
          className={["rounded-full border px-2 py-0.5 text-[9px] font-medium", toneClasses(item.tone)].join(" ")}
        >
          {item.labelZh}
        </span>
      ))}
    </div>
  );
}

export function DesktopCardChannelSections({
  items,
  columns = 2,
}: {
  items: CardChannelSection[];
  columns?: 1 | 2;
}) {
  if (items.length === 0) return null;

  return (
    <div className={["grid gap-1.5", columns === 2 ? "sm:grid-cols-2" : ""].join(" ").trim()}>
      {items.map((item) => (
        <div
          key={item.key}
          className={["rounded-[12px] border px-2.5 py-2", toneClasses(item.tone)].join(" ")}
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-80">{item.titleZh}</p>
          <p className="mt-1 text-[10px] leading-5 text-stone-700">{item.bodyZh}</p>
        </div>
      ))}
    </div>
  );
}
