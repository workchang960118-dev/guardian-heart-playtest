"use client";

import { useMemo, useState } from "react";

import { mapLayoutToPercentages } from "@/domain/guardian-heart/seeds/map/canonical-map-layout-v1";
import type { MapTile, PlayerState, SeatId } from "@/domain/guardian-heart/types/game";

const MAP_LAYOUT_19 = mapLayoutToPercentages();

const TILE_ICONS: Record<MapTile["kind"], string> = {
  center: "🏛️",
  safe: "",
  risk: "⚠️",
  station: "📦",
  shelter: "🛖",
};

function kindPalette(kind: MapTile["kind"]) {
  switch (kind) {
    case "center":
      return "border-stone-900 bg-stone-900 text-white";
    case "safe":
      return "border-stone-300 bg-white text-stone-900";
    case "risk":
      return "border-rose-300 bg-rose-100 text-rose-900";
    case "station":
      return "border-amber-300 bg-amber-100 text-amber-950";
    case "shelter":
      return "border-sky-300 bg-sky-100 text-sky-950";
    default:
      return "border-stone-300 bg-white text-stone-900";
  }
}

function kindLabel(kind: MapTile["kind"]) {
  switch (kind) {
    case "center":
      return "中央";
    case "safe":
      return "一般";
    case "risk":
      return "風險";
    case "station":
      return "物資";
    case "shelter":
      return "庇護";
    default:
      return kind;
  }
}

function fullKindLabel(kind: MapTile["kind"]) {
  switch (kind) {
    case "center":
      return "中央大道";
    case "safe":
      return "一般地格";
    case "risk":
      return "風險地格";
    case "station":
      return "物資站";
    case "shelter":
      return "庇護所";
    default:
      return kind;
  }
}

function kindEffectSummary(tile: MapTile) {
  switch (tile.kind) {
    case "center":
      return "全員固定起點，適合重新集結。";
    case "safe":
      return "一般地格，適合會合與互助。";
    case "risk":
      return "營火時若仍停留，會承受風險損失。";
    case "station":
      return "物資站：花 1AP，可回 1SR。";
    case "shelter":
      return "庇護所：花 1AP，可回 1SP。";
    default:
      return "";
  }
}

function buildEdgePairs(mapTiles: MapTile[]) {
  const seen = new Set<string>();
  const pairs: Array<[string, string]> = [];

  for (const tile of mapTiles) {
    for (const adjacentTileId of tile.adjacentTileIds) {
      const pairKey = [tile.tileId, adjacentTileId].sort().join("::");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      pairs.push([tile.tileId, adjacentTileId]);
    }
  }

  return pairs;
}

type AdjacentHelpOption = {
  seatId: SeatId;
  displayName: string;
  positionTileId: string | null;
  currentSr: number;
  currentSp: number;
  isAi: boolean;
  followMoveChoices?: Array<{
    moveSeat: SeatId;
    moveToTileId: string;
    moveToTileNameZh: string;
    labelZh: string;
  }>;
};

export function GuardianHeartMapStage(props: {
  mapTiles: MapTile[];
  players: PlayerState[];
  viewerSeat: SeatId | null;
  activeSeat: SeatId | null;
  legalMoveTileIds: Set<string>;
  selectedMoveTileId: string;
  selectedTileId: string;
  actionDisabledReasonZh?: string | null;
  adjacentHelpOptions?: AdjacentHelpOption[];
  canUseAdjacentHelp?: boolean;
  canUseMessengerAbility?: boolean;
  canUseMedicBonusHint?: boolean;
  latestActionFeedbackZh?: string | null;
  pressureTaskUnlockStatusZh?: string;
  roleAbilityHintsZh?: string[];
  onAdjacentHelp?: (
    targetSeat: SeatId,
    resourceType: "SR" | "SP",
    followMove?: { moveSeat: SeatId; moveToTileId: string },
  ) => void;
  onSelectTile: (tileId: string) => void;
  onSelectMoveTile?: (tileId: string) => void;
  onMoveHere?: (tileId: string) => void;
  onUseCurrentTile?: () => void;
  interactionEnabled: boolean;
  hideMetaBar?: boolean;
}) {
  const {
    mapTiles,
    players,
    viewerSeat,
    activeSeat,
    legalMoveTileIds,
    selectedMoveTileId,
    selectedTileId,
    actionDisabledReasonZh,
    adjacentHelpOptions = [],
    canUseAdjacentHelp = false,
    canUseMessengerAbility = false,
    canUseMedicBonusHint = false,
    latestActionFeedbackZh = null,
    pressureTaskUnlockStatusZh,
    roleAbilityHintsZh = [],
    onAdjacentHelp,
    onSelectTile,
    onSelectMoveTile,
    onMoveHere,
    onUseCurrentTile,
    interactionEnabled,
    hideMetaBar = false,
  } = props;
  const [hoveredTileId, setHoveredTileId] = useState("");
  const [selectedHelpMenuSeatId, setSelectedHelpMenuSeatId] = useState<SeatId | "">("");

  const viewerPlayer = viewerSeat
    ? players.find((player) => player.seatId === viewerSeat) ?? null
    : null;
  const viewerTile = viewerPlayer?.positionTileId
    ? mapTiles.find((tile) => tile.tileId === viewerPlayer.positionTileId) ?? null
    : null;

  const focusTileId = selectedTileId;
  const focusTile = mapTiles.find((tile) => tile.tileId === focusTileId) ?? null;
  const focusTileAdjacentTiles = focusTile
    ? mapTiles.filter((tile) => focusTile.adjacentTileIds.includes(tile.tileId))
    : [];
  const focusTileOccupants = focusTile
    ? players.filter((player) => player.positionTileId === focusTile.tileId)
    : [];
  const hoveredTile = hoveredTileId ? mapTiles.find((tile) => tile.tileId === hoveredTileId) ?? null : null;
  const hoveredTileLayout = hoveredTile ? MAP_LAYOUT_19[hoveredTile.tileId] : null;
  const hoverTooltipAnchorRight = Boolean(hoveredTileLayout && hoveredTileLayout.x >= 68);
  const hoverTooltipLeftPercent = hoveredTileLayout && !hoverTooltipAnchorRight ? Math.min(Math.max(hoveredTileLayout.x + 8, 6), 78) : null;
  const hoverTooltipRightPercent = hoveredTileLayout && hoverTooltipAnchorRight ? Math.min(Math.max(100 - hoveredTileLayout.x + 8, 6), 78) : null;
  const hoverTooltipTopPercent = hoveredTileLayout ? Math.min(Math.max(hoveredTileLayout.y - 6, 6), 78) : null;
  const focusTileLayout = focusTile ? MAP_LAYOUT_19[focusTile.tileId] : null;
  const tileMenuAnchorRight = Boolean(focusTileLayout && focusTileLayout.x >= 60);
  const tileMenuLeftPercent = focusTileLayout && !tileMenuAnchorRight ? Math.min(Math.max(focusTileLayout.x + 8, 8), 72) : null;
  const tileMenuRightPercent = focusTileLayout && tileMenuAnchorRight ? Math.min(Math.max(100 - focusTileLayout.x + 8, 8), 72) : null;
  const tileMenuTopPercent = focusTileLayout ? Math.min(Math.max(focusTileLayout.y - 4, 8), 74) : null;
  const adjacentHelpTargetSeatIds = new Set(adjacentHelpOptions.map((option) => option.seatId));
  const selectedHelpMenuTarget = selectedHelpMenuSeatId
    ? adjacentHelpOptions.find((option) => option.seatId === selectedHelpMenuSeatId) ?? null
    : null;
  const selectedHelpMenuTileLayout = selectedHelpMenuTarget?.positionTileId
    ? MAP_LAYOUT_19[selectedHelpMenuTarget.positionTileId] ?? null
    : null;
  const helpMenuAnchorRight = Boolean(selectedHelpMenuTileLayout && selectedHelpMenuTileLayout.x >= 60);
  const helpMenuLeftPercent = selectedHelpMenuTileLayout && !helpMenuAnchorRight
    ? Math.min(Math.max(selectedHelpMenuTileLayout.x + 8, 8), 74)
    : null;
  const helpMenuRightPercent = selectedHelpMenuTileLayout && helpMenuAnchorRight
    ? Math.min(Math.max(100 - selectedHelpMenuTileLayout.x + 8, 8), 74)
    : null;
  const helpMenuTopPercent = selectedHelpMenuTileLayout
    ? Math.min(Math.max(selectedHelpMenuTileLayout.y + 4, 10), 78)
    : null;
  const focusTileAdjacentHelpTargets = focusTile
    ? adjacentHelpOptions.filter((option) => option.positionTileId === focusTile.tileId)
    : [];
  const activePlayer = activeSeat
    ? players.find((player) => player.seatId === activeSeat) ?? null
    : null;
  const activePlayerTileId = activePlayer?.positionTileId ?? null;
  const edgePairs = useMemo(() => buildEdgePairs(mapTiles), [mapTiles]);
  const positionedTiles = mapTiles.filter((tile) => MAP_LAYOUT_19[tile.tileId]);
  const hasRenderableTiles = positionedTiles.length > 0;

  const canUseDirectMapActions = interactionEnabled && !actionDisabledReasonZh;
  const focusTileIsLegalMove = focusTile ? legalMoveTileIds.has(focusTile.tileId) : false;
  const focusTileIsViewerTile = focusTile && viewerPlayer?.positionTileId === focusTile.tileId;
  const canUseFocusTile = Boolean(focusTile && focusTileIsViewerTile && (focusTile.kind === "station" || focusTile.kind === "shelter"));
  const focusRouteHintZh = !focusTile || !viewerPlayer?.positionTileId
    ? ""
    : focusTile.tileId === viewerPlayer.positionTileId
      ? "這是你目前所在位置。"
      : legalMoveTileIds.has(focusTile.tileId)
        ? "此格相鄰，可直接移動。"
        : "此格不在本回合的一步移動範圍。";

  return (
    <div className={hideMetaBar ? "space-y-0" : "space-y-2"}>
      {!hideMetaBar ? <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-stone-600">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">位置：{viewerTile?.nameZh ?? viewerPlayer?.positionTileId ?? "—"}</span>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">輪到：{activeSeat ?? "—"}</span>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">可移動 {legalMoveTileIds.size} 格</span>
        </div>
      </div> : null}

      <div className={hideMetaBar ? "rounded-[26px] border border-stone-200 bg-stone-50 p-1" : "rounded-[28px] border border-stone-200 bg-stone-50 p-2"}>
        <div className={hideMetaBar ? "relative mx-auto h-[660px] w-full rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(244,244,245,0.96)_52%,_rgba(231,229,228,0.98)_100%)] lg:h-[760px]" : "relative mx-auto h-[620px] w-full rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(244,244,245,0.96)_52%,_rgba(231,229,228,0.98)_100%)] lg:h-[700px]"}>
          {hasRenderableTiles ? (
            <>
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {edgePairs.map(([fromTileId, toTileId]) => {
                  const from = MAP_LAYOUT_19[fromTileId];
                  const to = MAP_LAYOUT_19[toTileId];
                  if (!from || !to) return null;
                  const isFocusedEdge = focusTile && (focusTile.tileId === fromTileId || focusTile.tileId === toTileId);
                  return (
                    <line
                      key={`${fromTileId}-${toTileId}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={isFocusedEdge ? "rgba(245,158,11,0.42)" : "rgba(120,113,108,0.22)"}
                      strokeWidth={isFocusedEdge ? "0.72" : "0.38"}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>

              {mapTiles.map((tile) => {
                const layout = MAP_LAYOUT_19[tile.tileId];
                if (!layout) return null;

            const occupants = players.filter((player) => player.positionTileId === tile.tileId);
            const isLegalMove = legalMoveTileIds.has(tile.tileId);
            const isSelectedMove = selectedMoveTileId === tile.tileId;
            const isSelectedTile = selectedTileId === tile.tileId;
            const isHovered = hoveredTileId === tile.tileId;
            const isViewerHere = viewerPlayer?.positionTileId === tile.tileId;
            const isCurrentActorHere = activePlayerTileId === tile.tileId;

            return (
              <div
                key={tile.tileId}
                className={[
                  "absolute flex h-[108px] w-[128px] -translate-x-1/2 -translate-y-1/2 flex-col justify-between rounded-[24px] border p-2.5 text-left shadow-sm transition lg:h-[122px] lg:w-[142px]",
                  kindPalette(tile.kind),
                  isLegalMove ? "ring-4 ring-emerald-300 shadow-md" : "",
                  isSelectedMove ? "ring-4 ring-amber-300 shadow-lg" : "",
                  isSelectedTile ? "outline outline-2 outline-offset-2 outline-violet-500" : "",
                  isHovered ? "outline outline-2 outline-offset-2 outline-sky-300" : "",
                  interactionEnabled ? "hover:-translate-y-[52%] hover:shadow-md" : "cursor-default",
                ].join(" ")}
                style={{ left: `${layout.x}%`, top: `${layout.y}%` }}
                onMouseEnter={() => setHoveredTileId(tile.tileId)}
                onMouseLeave={() => setHoveredTileId((current) => (current === tile.tileId ? "" : current))}
                onClick={() => {
                  const nextTileId = isSelectedTile ? "" : tile.tileId;
                  onSelectTile(nextTileId);
                  setSelectedHelpMenuSeatId("");
                  if (interactionEnabled && isLegalMove && onSelectMoveTile) {
                    onSelectMoveTile(nextTileId ? tile.tileId : "");
                  }
                }}
                onDoubleClick={() => {
                  if (canUseDirectMapActions && isLegalMove && onMoveHere) {
                    onMoveHere(tile.tileId);
                    onSelectTile("");
                    setSelectedHelpMenuSeatId("");
                    if (onSelectMoveTile) onSelectMoveTile("");
                  }
                }}
                role="button"
                tabIndex={interactionEnabled ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  const nextTileId = isSelectedTile ? "" : tile.tileId;
                  onSelectTile(nextTileId);
                  setSelectedHelpMenuSeatId("");
                  if (interactionEnabled && isLegalMove && onSelectMoveTile) {
                    onSelectMoveTile(nextTileId ? tile.tileId : "");
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  {TILE_ICONS[tile.kind] ? (
                    <span className="absolute right-3 top-2.5 text-[17px]" aria-hidden="true">{TILE_ICONS[tile.kind]}</span>
                  ) : null}
                  <div className="min-w-0 pr-6">
                    <p className="whitespace-nowrap text-[11px] font-bold leading-4 text-stone-900 lg:text-[12px]">{tile.nameZh}</p>
                  </div>
                  <span
                    title={fullKindLabel(tile.kind)}
                    className="whitespace-nowrap rounded-full bg-black/10 px-2.5 py-1 text-[10px] font-semibold leading-none"
                  >
                    {kindLabel(tile.kind)}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1.5">
                    {occupants.length > 0 ? occupants.map((player) => {
                      const isViewer = player.seatId === viewerSeat;
                      const isActive = player.seatId === activeSeat;
                      const isAdjacentHelpTarget = adjacentHelpTargetSeatIds.has(player.seatId);
                      const isSelectedHelpTarget = selectedHelpMenuSeatId === player.seatId;
                      const tokenClasses = [
                        "inline-flex min-w-[36px] items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm transition",
                        isViewer ? "bg-stone-900 text-white ring-2 ring-amber-300 shadow-md" : "border border-stone-300 bg-white text-stone-900",
                        !isViewer && isActive ? "animate-pulse bg-amber-100 text-amber-900 ring-2 ring-amber-300 shadow-md" : "",
                      ].join(" ");
                      const helpTokenClasses = [
                        tokenClasses,
                        "cursor-pointer border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
                        isSelectedHelpTarget ? "ring-2 ring-emerald-400 shadow-md" : "",
                      ].join(" ");
                      return (
                        isAdjacentHelpTarget && canUseAdjacentHelp && onAdjacentHelp ? (
                          <button
                            key={`${tile.tileId}-${player.seatId}`}
                            type="button"
                            className={helpTokenClasses}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedHelpMenuSeatId((current) => (current === player.seatId ? "" : player.seatId));
                            }}
                            title={`點擊對 ${player.seatId} 開啟相鄰互助`}
                          >
                            {player.seatId}
                          </button>
                        ) : (
                          <span
                          key={`${tile.tileId}-${player.seatId}`}
                          className={tokenClasses}
                        >
                          {player.seatId}
                        </span>
                        )
                      );
                    }) : <span className="whitespace-nowrap rounded-full bg-white/70 px-2.5 py-1 text-[10px] text-stone-500">無玩家</span>}
                  </div>
                  <p className="whitespace-nowrap text-[10.5px] opacity-75">
                    {isViewerHere ? "你在這裡" : isCurrentActorHere ? "目前行動者在這裡" : isLegalMove ? "可點選作為移動目標" : ""}
                  </p>
                  {occupants.some((player) => adjacentHelpTargetSeatIds.has(player.seatId)) ? (
                    <p className="whitespace-nowrap text-[10.5px] font-medium text-emerald-700">此格有可相鄰互助對象，點隊友即可操作</p>
                  ) : null}
                </div>
              </div>
            );
          })}
              {hoveredTile && hoveredTileLayout && hoveredTile.tileId !== focusTile?.tileId ? (
                <div
                  className="pointer-events-none absolute z-20 w-[220px] rounded-3xl border border-stone-200 bg-white/96 p-3 shadow-xl backdrop-blur"
                  style={{ left: hoverTooltipAnchorRight ? undefined : `${hoverTooltipLeftPercent}%`, right: hoverTooltipAnchorRight ? `${hoverTooltipRightPercent}%` : undefined, top: `${hoverTooltipTopPercent}%` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-bold text-stone-950">{hoveredTile.nameZh}</p>
                      <p className="mt-0.5 text-[10px] text-stone-500">{fullKindLabel(hoveredTile.kind)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-stone-600">{kindEffectSummary(hoveredTile)}</p>
                  <div className="mt-2 text-[10px] text-stone-500">{legalMoveTileIds.has(hoveredTile.tileId) ? "點一下操作；雙擊移動。" : "點一下看資訊。"}</div>
                </div>
              ) : null}
              {focusTile && focusTileLayout ? (
                <div
                  className="absolute z-20 w-[210px] rounded-3xl border border-stone-200 bg-white/96 p-3 shadow-2xl backdrop-blur"
                  style={{ left: tileMenuAnchorRight ? undefined : `${tileMenuLeftPercent}%`, right: tileMenuAnchorRight ? `${tileMenuRightPercent}%` : undefined, top: `${tileMenuTopPercent}%` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="whitespace-nowrap text-[11px] font-bold text-stone-950">{focusTile.nameZh}</p>
                      <p className="mt-0.5 text-[10px] text-stone-500">{fullKindLabel(focusTile.kind)}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] text-stone-600"
                      onClick={() => onSelectTile("")}
                    >
                      關閉
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-stone-600">{kindEffectSummary(focusTile)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      title={focusRouteHintZh || "移動到這格"}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!canUseDirectMapActions || !focusTileIsLegalMove || !onMoveHere}
                      onClick={() => onMoveHere?.(focusTile.tileId)}
                    >
                      移動到此
                    </button>
                    <button
                      type="button"
                      title={canUseFocusTile ? "使用目前站立地格的效果" : "你必須站在物資站或庇護所上才能使用地格效果"}
                      className="rounded-full bg-sky-700 px-3 py-1.5 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!canUseDirectMapActions || !canUseFocusTile || !onUseCurrentTile}
                      onClick={() => onUseCurrentTile?.()}
                    >
                      使用地格
                    </button>
                  </div>
                  <div className="mt-2 rounded-2xl bg-stone-100 px-3 py-2 text-[10px] leading-4.5 text-stone-600">
                    {focusTileIsLegalMove
                      ? '這格目前可一步移動到。'
                      : focusTileIsViewerTile
                        ? '這是你目前所在位置。'
                        : focusRouteHintZh || '現在先查看這格資訊。'}
                  </div>
                </div>
              ) : null}
              {selectedHelpMenuTarget && selectedHelpMenuTileLayout ? (
                <div
                  className="absolute z-30 w-[240px] rounded-3xl border border-emerald-200 bg-white/96 p-3 shadow-2xl backdrop-blur"
                  style={{
                    left: helpMenuAnchorRight ? undefined : `${helpMenuLeftPercent}%`,
                    right: helpMenuAnchorRight ? `${helpMenuRightPercent}%` : undefined,
                    top: `${helpMenuTopPercent}%`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-bold text-stone-950">
                        對 {selectedHelpMenuTarget.seatId} 相鄰互助
                      </p>
                      <p className="mt-0.5 text-[10px] text-stone-500">
                        {selectedHelpMenuTarget.displayName}
                        {selectedHelpMenuTarget.isAi ? "（AI）" : ""}｜SR {selectedHelpMenuTarget.currentSr}／SP {selectedHelpMenuTarget.currentSp}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] text-stone-600"
                      onClick={() => setSelectedHelpMenuSeatId("")}
                    >
                      關閉
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-stone-600">
                    這是 0AP 相鄰互助；若技能可用，送出後會再詢問。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!canUseDirectMapActions || !canUseAdjacentHelp || !onAdjacentHelp}
                      onClick={() => {
                        onAdjacentHelp?.(selectedHelpMenuTarget.seatId, "SP");
                        setSelectedHelpMenuSeatId("");
                      }}
                    >
                      轉移 SP
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-amber-700 px-3 py-1.5 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!canUseDirectMapActions || !canUseAdjacentHelp || !onAdjacentHelp}
                      onClick={() => {
                        onAdjacentHelp?.(selectedHelpMenuTarget.seatId, "SR");
                        setSelectedHelpMenuSeatId("");
                      }}
                    >
                      轉移 SR
                    </button>
                  </div>
                  {actionDisabledReasonZh ? (
                    <p className="mt-2 text-[10px] text-stone-500">目前不能操作：{actionDisabledReasonZh}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center">
              <div className="max-w-xl rounded-[24px] border border-dashed border-stone-300 bg-white/80 px-6 py-8 text-sm leading-7 text-stone-700 shadow-sm">
                <p className="text-base font-semibold text-stone-900">地圖尚未正常載入</p>
                <p className="mt-2">目前有 {mapTiles.length} 個地格資料，但沒有對應座標。</p>
                <p className="mt-2">請先確認地圖 seed 與座標。</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[18px] border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium">點地格開操作</span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1">雙擊移動</span>
          </div>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] text-stone-600">{focusTile ? `焦點：${focusTile.nameZh}` : '先選地格'}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-stone-500">
          <span>{focusTile ? kindEffectSummary(focusTile) : '常用操作已整合到地格旁小視窗。'}</span>
          {actionDisabledReasonZh ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">目前受流程限制</span> : null}
        </div>
      </div>

      <details className="rounded-2xl border border-stone-200 bg-white/80">

        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-stone-800">地圖細節</summary>
        <div className="border-t border-stone-200 p-3">
      <div className="grid gap-3 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-stone-950">地格細節</p>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-600">目前焦點：{focusTile?.tileId ?? "—"}</span>
          </div>
          {focusTile ? (
            <>
              <p className="mt-2 font-medium">{focusTile.nameZh}｜{fullKindLabel(focusTile.kind)}</p>
              <p className="mt-1 text-stone-600">{kindEffectSummary(focusTile)}</p>
              <p className="mt-1 text-stone-600">{focusRouteHintZh}</p>
              <p className="mt-1 text-stone-600">同格玩家：{focusTileOccupants.length > 0 ? focusTileOccupants.map((player) => `${player.seatId}｜${player.displayName}`).join("、") : "無"}</p>
              <p className="mt-1 text-stone-600">相鄰互助：{focusTileAdjacentHelpTargets.length > 0 ? "有可支援隊友。" : focusTile && viewerPlayer?.positionTileId === focusTile.tileId ? "同格不算相鄰目標。" : "暫無可支援對象。"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {focusTileAdjacentTiles.map((tile) => (
                  <button
                    key={`focus-neighbor-${tile.tileId}`}
                    type="button"
                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                    onClick={() => onSelectTile(tile.tileId)}
                  >
                    查看 {tile.tileId}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-950">
                  <p className="font-semibold">地圖回饋</p>
                  <p className="mt-1 text-sky-900">{latestActionFeedbackZh ?? "暫無地圖操作。"}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                  <p className="font-semibold">任務／能力提示</p>
                  <p className="mt-1 text-amber-900">{pressureTaskUnlockStatusZh ?? "暫無提示。"}</p>
                  {roleAbilityHintsZh.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
                      {roleAbilityHintsZh.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canUseDirectMapActions || !focusTileIsLegalMove || !onMoveHere}
                  onClick={() => onMoveHere?.(focusTile.tileId)}
                >
                  直接移動到此格
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canUseDirectMapActions || !canUseFocusTile || !onUseCurrentTile}
                  onClick={() => onUseCurrentTile?.()}
                >
                  使用此地格效果
                </button>
              </div>
              {actionDisabledReasonZh ? <p className="mt-2 text-xs text-stone-500">目前不能直接從地圖操作：{actionDisabledReasonZh}</p> : null}
            </>
          ) : (
            <p className="mt-2 text-stone-600">先選地格。</p>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-800">
          <p className="font-semibold text-stone-950">快速圖例</p>
          <ul className="mt-2 space-y-1 text-stone-700">
            <li>• 風險地格為粉紅，物資站為金色，庇護所為藍色。</li>
            <li>• 綠色外圈代表你現在可合法移動到的目標。</li>
            <li>• 黃色外圈代表你已選為本回合的移動目標。</li>
            <li>• 深色 token 是你自己；金色強調的是目前行動中的座位。</li>
            <li>• 點相鄰隊友 token，可直接開啟互助選單。</li>
            <li>• 進階提示會顯示在地圖細節區。</li>
            <li>• 站在物資站或庇護所上時，可直接使用地格效果。</li>
          </ul>
        </div>
      </div>
        </div>
      </details>
    </div>
  );
}
