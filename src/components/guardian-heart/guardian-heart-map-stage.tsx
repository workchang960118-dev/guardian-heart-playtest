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
      return "全員固定起點，也是最穩定的 regroup 節點。";
    case "safe":
      return "一般地格，不會額外給資源，但適合會合、換位與互助。";
    case "risk":
      return "若營火時仍停留在此，會承受風險地格損失；適合短衝，不適合久留。";
    case "station":
      return "物資站：花 1AP 使用，可回復 1SR。通常值得繞路來補生存資源。";
    case "shelter":
      return "庇護所：花 1AP 使用，可回復 1SP。適合壓力累積後回穩心理資源。";
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
  const [selectedFollowMoveBySeat, setSelectedFollowMoveBySeat] = useState<Record<string, string>>({});

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
        ? "此格與你目前位置相鄰，可直接移動。"
        : "此格不是你本回合可一步移動到的相鄰格，需先換位或留待之後回合。";

  return (
    <div className={hideMetaBar ? "space-y-0" : "space-y-2"}>
      {!hideMetaBar ? <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-stone-600">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">位置：{viewerTile?.nameZh ?? viewerPlayer?.positionTileId ?? "—"}</span>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">輪到：{activeSeat ?? "—"}</span>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">可移動 {legalMoveTileIds.size} 格</span>
        </div>
        <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1">地圖版型 v1</span>
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
              <button
                key={tile.tileId}
                type="button"
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
                  if (interactionEnabled && isLegalMove && onSelectMoveTile) {
                    onSelectMoveTile(nextTileId ? tile.tileId : "");
                  }
                }}
                onDoubleClick={() => {
                  if (canUseDirectMapActions && isLegalMove && onMoveHere) {
                    onMoveHere(tile.tileId);
                    onSelectTile("");
                    if (onSelectMoveTile) onSelectMoveTile("");
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
                      return (
                        <span
                          key={`${tile.tileId}-${player.seatId}`}
                          className={[
                            "inline-flex min-w-[36px] items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm",
                            isViewer ? "bg-stone-900 text-white ring-2 ring-amber-300 shadow-md" : "border border-stone-300 bg-white text-stone-900",
                            !isViewer && isActive ? "animate-pulse bg-amber-100 text-amber-900 ring-2 ring-amber-300 shadow-md" : "",
                          ].join(" ")}
                        >
                          {player.seatId}
                        </span>
                      );
                    }) : <span className="whitespace-nowrap rounded-full bg-white/70 px-2.5 py-1 text-[10px] text-stone-500">無玩家</span>}
                  </div>
                  <p className="whitespace-nowrap text-[10.5px] opacity-75">
                    {isViewerHere ? "你在這裡" : isCurrentActorHere ? "目前行動者在這裡" : isLegalMove ? "可點選作為移動目標" : ""}
                  </p>
                  {occupants.some((player) => adjacentHelpTargetSeatIds.has(player.seatId)) ? (
                    <p className="whitespace-nowrap text-[10.5px] font-medium text-emerald-700">此格有可相鄰互助對象</p>
                  ) : null}
                </div>
              </button>
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
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">滑過看資訊</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-stone-600">{kindEffectSummary(hoveredTile)}</p>
                  <div className="mt-2 text-[10px] text-stone-500">{legalMoveTileIds.has(hoveredTile.tileId) ? "點一下可打開操作選單，雙擊可快速移動。" : "點一下可查看互動選單；若不是相鄰格，現在只能先查看資訊。"}</div>
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
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center">
              <div className="max-w-xl rounded-[24px] border border-dashed border-stone-300 bg-white/80 px-6 py-8 text-sm leading-7 text-stone-700 shadow-sm">
                <p className="text-base font-semibold text-stone-900">地圖尚未正常載入</p>
                <p className="mt-2">目前有 {mapTiles.length} 個地格資料，但沒有對應到可顯示的位置。這通常是版面迭代時的顯示回歸，不是房間裡真的沒有地圖。</p>
                <p className="mt-2">請先檢查地圖 seed 與版面座標是否一致；在修正前，下方仍會保留地格細節與快速操作區。</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[18px] border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium">地圖操作：點地格開啟操作</span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1">雙擊合法目標可快速移動</span>
          </div>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] text-stone-600">{focusTile ? `焦點：${focusTile.nameZh}` : '請先點選地格'}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-stone-500">
          <span>{focusTile ? kindEffectSummary(focusTile) : '常用操作已整合到地格旁小視窗。'}</span>
          {actionDisabledReasonZh ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">目前受流程限制</span> : null}
        </div>
      </div>

      <details className="rounded-2xl border border-stone-200 bg-white/80">

        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-stone-800">展開地圖細節與快捷操作</summary>
        <div className="border-t border-stone-200 p-3">
      <div className="grid gap-3 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-stone-950">地格細節與快速操作</p>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-600">目前焦點：{focusTile?.tileId ?? "—"}</span>
          </div>
          {focusTile ? (
            <>
              <p className="mt-2 font-medium">{focusTile.nameZh}｜{fullKindLabel(focusTile.kind)}</p>
              <p className="mt-1 text-stone-600">{kindEffectSummary(focusTile)}</p>
              <p className="mt-1 text-stone-600">{focusRouteHintZh}</p>
              <p className="mt-1 text-stone-600">相鄰地格：{focusTileAdjacentTiles.map((tile) => `${tile.tileId} ${tile.nameZh}`).join("、") || "無"}</p>
              <p className="mt-1 text-stone-600">同格玩家：{focusTileOccupants.length > 0 ? focusTileOccupants.map((player) => `${player.seatId}｜${player.displayName}`).join("、") : "目前無玩家"}</p>
              <p className="mt-1 text-stone-600">相鄰互助：{focusTileAdjacentHelpTargets.length > 0 ? `若你要支援這格玩家，可直接從下方按鈕對其轉移 SR / SP。` : focusTile && viewerPlayer?.positionTileId === focusTile.tileId ? "你站在這格，但這格上的其他玩家不屬於相鄰互助對象；相鄰互助需要支援相鄰地格的隊友。" : "目前這格沒有你可直接相鄰互助的對象。"}</p>
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
                  <p className="font-semibold">最新地圖操作回饋</p>
                  <p className="mt-1 text-sky-900">{latestActionFeedbackZh ?? "尚未從地圖送出新的移動、互助或地格使用。"}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                  <p className="font-semibold">任務解鎖／角色能力提示</p>
                  <p className="mt-1 text-amber-900">{pressureTaskUnlockStatusZh ?? "目前沒有額外的互助門檻提示。"}</p>
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
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
                <p className="font-semibold">相鄰互助快捷列</p>
                <p className="mt-1 text-xs text-emerald-800">
                  僅列出目前與你相鄰、可直接接受 0AP 相鄰互助的隊友。{canUseMessengerAbility ? " 若你想連動〈牽起連結〉的免費移動，仍可改用下方完整表單。" : ""}{canUseMedicBonusHint ? " 若你以 SP 互助，白衣見習生的〈安定陪伴〉可望再讓對方額外回 1SP。" : ""}
                </p>
                {focusTileAdjacentHelpTargets.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {focusTileAdjacentHelpTargets.map((target) => (
                      <div key={`help-${target.seatId}`} className="rounded-2xl border border-emerald-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{target.seatId}｜{target.displayName}{target.isAi ? "（AI）" : ""}</p>
                            <p className="text-xs text-stone-600">所在位置：{target.positionTileId ?? "—"}｜SR {target.currentSr}／SP {target.currentSp}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={!canUseDirectMapActions || !canUseAdjacentHelp || !onAdjacentHelp}
                              onClick={() => onAdjacentHelp?.(target.seatId, "SP")}
                            >
                              對 {target.seatId} 轉移 SP{canUseMedicBonusHint ? "（含安定陪伴提示）" : ""}
                            </button>
                            <button
                              type="button"
                              className="rounded-xl bg-amber-700 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={!canUseDirectMapActions || !canUseAdjacentHelp || !onAdjacentHelp}
                              onClick={() => onAdjacentHelp?.(target.seatId, "SR")}
                            >
                              對 {target.seatId} 轉移 SR
                            </button>
                            {canUseMessengerAbility && target.followMoveChoices && target.followMoveChoices.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-2 py-2">
                                <select
                                  className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] text-stone-900"
                                  value={selectedFollowMoveBySeat[target.seatId] ?? ""}
                                  onChange={(event) => setSelectedFollowMoveBySeat((current) => ({ ...current, [target.seatId]: event.target.value }))}
                                >
                                  <option value="">牽起連結：選擇免費移動</option>
                                  {target.followMoveChoices.map((choice) => (
                                    <option key={`${target.seatId}-${choice.moveSeat}-${choice.moveToTileId}`} value={`${choice.moveSeat}::${choice.moveToTileId}`}>
                                      {choice.labelZh}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="rounded-lg bg-violet-700 px-2 py-1 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={
                                    !canUseDirectMapActions
                                    || !canUseAdjacentHelp
                                    || !onAdjacentHelp
                                    || !(selectedFollowMoveBySeat[target.seatId] ?? "").includes("::")
                                  }
                                  onClick={() => {
                                    const selected = selectedFollowMoveBySeat[target.seatId] ?? "";
                                    const [moveSeat, moveToTileId] = selected.split("::");
                                    if (!moveSeat || !moveToTileId) return;
                                    onAdjacentHelp?.(target.seatId, "SP", { moveSeat: moveSeat as SeatId, moveToTileId });
                                  }}
                                >
                                  SP＋免費移動
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg bg-violet-900 px-2 py-1 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={
                                    !canUseDirectMapActions
                                    || !canUseAdjacentHelp
                                    || !onAdjacentHelp
                                    || !(selectedFollowMoveBySeat[target.seatId] ?? "").includes("::")
                                  }
                                  onClick={() => {
                                    const selected = selectedFollowMoveBySeat[target.seatId] ?? "";
                                    const [moveSeat, moveToTileId] = selected.split("::");
                                    if (!moveSeat || !moveToTileId) return;
                                    onAdjacentHelp?.(target.seatId, "SR", { moveSeat: moveSeat as SeatId, moveToTileId });
                                  }}
                                >
                                  SR＋免費移動
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {canUseMedicBonusHint || canUseMessengerAbility ? (
                          <div className="mt-2 space-y-1 text-[11px] text-stone-600">
                            {canUseMedicBonusHint ? <p>• 你目前若以 SP 互助，系統應一併檢查〈安定陪伴〉的額外 1SP。</p> : null}
                            {canUseMessengerAbility ? <p>• 你現在也可直接在此選擇〈牽起連結〉的免費移動目標；若想精細指定，仍可改用下方完整互助表單。</p> : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-emerald-900">目前焦點地格沒有可直接支援的相鄰隊友。你可改點其他相鄰地格查看，或用下方完整互助表單指定目標。</p>
                )}
              </div>
              {actionDisabledReasonZh ? <p className="mt-2 text-xs text-stone-500">目前不能直接從地圖操作：{actionDisabledReasonZh}</p> : null}
            </>
          ) : (
            <p className="mt-2 text-stone-600">請先點選地格。</p>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-800">
          <p className="font-semibold text-stone-950">地圖閱讀提示</p>
          <ul className="mt-2 space-y-1 text-stone-700">
            <li>• 風險地格為粉紅，物資站為金色，庇護所為藍色。</li>
            <li>• 綠色外圈代表你現在可合法移動到的目標。</li>
            <li>• 黃色外圈代表你已選為本回合的移動目標。</li>
            <li>• 深色 token 是你自己；金色強調的是目前行動中的座位。</li>
            <li>• 把滑鼠移到地格上可暫時聚焦鄰接線，點一下可鎖定細節面板。</li>
            <li>• 若相鄰地格上有隊友，右側會顯示互助快捷列，可直接送出 0AP 相鄰互助。</li>
            <li>• 若你是街巷信使且本輪能力仍可用，互助快捷列也可直接帶入〈牽起連結〉的免費移動。</li>
            <li>• 互助後的最新結果回饋、壓力 6 任務解鎖狀態，以及白衣見習生／街巷信使提示，現在都會顯示在地圖細節區。</li>
            <li>• 若你已站在物資站或庇護所上，可直接從地圖右側按鈕使用該地格效果。</li>
          </ul>
        </div>
      </div>
        </div>
      </details>
    </div>
  );
}
