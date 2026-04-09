"use client";

import type { ApiResponse } from "@/domain/guardian-heart/types/api";
import type { ActionLogEntry, GamePhase } from "@/domain/guardian-heart/types/game";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LogsResponse = {
  ok: boolean;
  data?: {
    roomCode: string;
    logs: ActionLogEntry[];
  };
  error?: {
    message: string;
  };
};

const PHASE_OPTIONS: Array<{ value: "ALL" | GamePhase; labelZh: string }> = [
  { value: "ALL", labelZh: "全部階段" },
  { value: "lobby", labelZh: "大廳" },
  { value: "crisis", labelZh: "危機" },
  { value: "action", labelZh: "行動" },
  { value: "campfire", labelZh: "營火" },
  { value: "gameover", labelZh: "結算" },
];

const BLOCKING_OPTIONS = [
  { value: "ALL", labelZh: "全部阻塞視窗狀態" },
  { value: "none", labelZh: "沒有阻塞視窗" },
  { value: "loss", labelZh: "損失處理視窗" },
  { value: "discard", labelZh: "棄牌處理視窗" },
  { value: "ability", labelZh: "角色技能視窗" },
] as const;

const PHASE_LABEL_ZH: Record<GamePhase, string> = {
  lobby: "大廳",
  crisis: "危機",
  action: "行動",
  campfire: "營火",
  gameover: "結算",
};

const BLOCKING_LABEL_ZH: Record<"none" | "loss" | "discard" | "ability", string> = {
  none: "沒有阻塞視窗",
  loss: "損失處理視窗",
  discard: "棄牌處理視窗",
  ability: "角色技能視窗",
};

const ACTION_TYPE_LABEL_ZH: Record<string, string> = {
  assign_role: "指派角色",
  start_game: "開始遊戲",
  start_round: "開始本輪",
  move: "移動",
  use_station_or_shelter: "使用地格效果",
  invest_event: "投入事件",
  adjacent_help: "相鄰互助",
  play_action_card: "使用行動卡",
  end_turn: "結束回合",
  discard_cards: "棄牌",
  use_companion_token: "使用陪伴標記",
  finalize_pending_loss: "完成損失處理",
  declare_task: "宣告任務",
  resolve_campfire: "處理營火",
  resolve_role_ability: "回應角色技能",
  update_room_config: "更新房間設定",
  run_ai_turn: "執行 AI 回合",
};

function phaseLabelZh(value: GamePhase | "ALL") {
  return value === "ALL" ? "全部階段" : PHASE_LABEL_ZH[value] ?? value;
}

function blockingLabelZh(value: "ALL" | "none" | "loss" | "discard" | "ability" | null | undefined) {
  if (!value) return "—";
  if (value === "ALL") return "全部阻塞視窗狀態";
  return BLOCKING_LABEL_ZH[value] ?? value;
}

function actionTypeLabelZh(value: string) {
  return ACTION_TYPE_LABEL_ZH[value] ?? value.replaceAll("_", " ");
}

function actionTypeDebugTitleZh(value: string) {
  const zh = actionTypeLabelZh(value);
  return zh === value ? zh : `${zh}（${value}）`;
}

function formatTimestampZh(value: string, options?: { withYear?: boolean; withSeconds?: boolean }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    year: options?.withYear ? "numeric" : undefined,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: options?.withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(date);
}

function describePlayerDiff(entry: ActionLogEntry) {
  const before = new Map(entry.statusBefore.players.map((player) => [player.seatId, player]));
  const after = new Map(entry.statusAfter.players.map((player) => [player.seatId, player]));
  const seatIds = Array.from(new Set([...before.keys(), ...after.keys()]));
  return seatIds.flatMap((seatId) => {
    const prev = before.get(seatId);
    const next = after.get(seatId);
    if (!prev || !next) return [];
    const changes: string[] = [];
    if (prev.sr !== next.sr) changes.push(`SR ${prev.sr}→${next.sr}`);
    if (prev.sp !== next.sp) changes.push(`SP ${prev.sp}→${next.sp}`);
    if (prev.ap !== next.ap) changes.push(`AP ${prev.ap}→${next.ap}`);
    if (prev.tileId !== next.tileId) changes.push(`位置 ${prev.tileId ?? "—"}→${next.tileId ?? "—"}`);
    if (changes.length === 0) return [];
    return [{ seatId, changesZh: changes.join("｜") }];
  });
}

export function RoomLogsClient(params: {
  roomCode: string;
  initialJoinToken: string;
  initialDisplayName: string;
}) {
  const { roomCode, initialJoinToken, initialDisplayName } = params;
  const [joinToken] = useState(initialJoinToken);
  const [displayName] = useState(initialDisplayName);
  const [loading, setLoading] = useState(true);
  const [errorZh, setErrorZh] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<"ALL" | GamePhase>("ALL");
  const [selectedActor, setSelectedActor] = useState<string>("ALL");
  const [selectedRound, setSelectedRound] = useState<string>("ALL");
  const [selectedActionType, setSelectedActionType] = useState<string>("ALL");
  const [selectedBlocking, setSelectedBlocking] = useState<(typeof BLOCKING_OPTIONS)[number]["value"]>("ALL");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadLogs() {
      setLoading(true);
      setErrorZh(null);
      try {
        const res = await fetch("/api/rooms/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode, joinToken, limit: 500 }),
        });
        const result = (await res.json()) as ApiResponse<{ roomCode: string; logs: ActionLogEntry[] }>;
        if (cancelled) return;
        if (!result.ok) {
          setErrorZh(result.error.message);
          setLogs([]);
          return;
        }
        setLogs(result.data.logs);
      } catch {
        if (!cancelled) {
          setErrorZh("讀取完整紀錄頁失敗。請稍後再試。");
          setLogs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!joinToken) {
      setLoading(false);
      setErrorZh("缺少房間身分資訊，無法讀取完整紀錄頁。");
      return;
    }
    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [joinToken, roomCode]);

  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of logs) {
      if (!seen.has(entry.actorLabelZh)) {
        seen.set(entry.actorLabelZh, entry.actorLabelZh);
      }
    }
    return ["ALL", ...seen.keys()];
  }, [logs]);

  const roundOptions = useMemo(() => {
    const rounds = [...new Set(logs.map((entry) => entry.round))].sort((a, b) => a - b);
    return ["ALL", ...rounds.map((round) => String(round))];
  }, [logs]);

  const actionTypeOptions = useMemo(() => {
    const types = [...new Set(logs.map((entry) => entry.actionType))].sort((a, b) => a.localeCompare(b));
    return ["ALL", ...types];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return logs.filter((entry) => {
      if (selectedPhase !== "ALL" && entry.phase !== selectedPhase) return false;
      if (selectedActor !== "ALL" && entry.actorLabelZh !== selectedActor) return false;
      if (selectedRound !== "ALL" && String(entry.round) !== selectedRound) return false;
      if (selectedActionType !== "ALL" && entry.actionType !== selectedActionType) return false;
      if (selectedBlocking !== "ALL") {
        const blockingValue = entry.statusAfter.blockingWindowKind ?? "none";
        if (blockingValue !== selectedBlocking) return false;
      }
      if (!normalizedKeyword) return true;
      const haystack = [
        entry.actorLabelZh,
        entry.actionType,
        entry.payloadSummaryZh,
        entry.resultSummaryZh,
        entry.timestamp,
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedKeyword);
    });
  }, [keyword, logs, selectedActionType, selectedActor, selectedBlocking, selectedPhase, selectedRound]);

  const summary = useMemo(() => {
    const actorCount = new Set(filteredLogs.map((entry) => entry.actorLabelZh)).size;
    const phaseCount = new Set(filteredLogs.map((entry) => entry.phase)).size;
    const latest = filteredLogs[0]?.timestamp ?? logs[0]?.timestamp ?? "目前沒有正式操作紀錄";
    return { actorCount, phaseCount, latest: latest === "目前沒有正式操作紀錄" ? latest : formatTimestampZh(latest, { withYear: true, withSeconds: true }) };
  }, [filteredLogs, logs]);

  const aggregate = useMemo(() => {
    const failedCount = filteredLogs.filter((entry) => {
      const haystack = `${entry.resultSummaryZh} ${entry.payloadSummaryZh}`.toLowerCase();
      return haystack.includes("失敗") || haystack.includes("不可") || haystack.includes("無法");
    }).length;
    const blockingChanges = filteredLogs.filter((entry) => entry.statusBefore.blockingWindowKind !== entry.statusAfter.blockingWindowKind).length;
    const actionTypeCounts = [...filteredLogs.reduce((map, entry) => {
      map.set(entry.actionType, (map.get(entry.actionType) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const phaseCounts = [...filteredLogs.reduce((map, entry) => {
      map.set(entry.phase, (map.get(entry.phase) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
    const uniqueRounds = new Set(filteredLogs.map((entry) => entry.round)).size;
    const failureRate = filteredLogs.length > 0 ? Math.round((failedCount / filteredLogs.length) * 100) : 0;
    const blockingRate = filteredLogs.length > 0 ? Math.round((blockingChanges / filteredLogs.length) * 100) : 0;
    return { failedCount, blockingChanges, actionTypeCounts, phaseCounts, uniqueRounds, failureRate, blockingRate };
  }, [filteredLogs]);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-rose-700">房間紀錄</p>
              <h1 className="mt-1 text-3xl font-bold">{roomCode}｜完整紀錄</h1>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                挑出想看的回合與操作者，快速回看這局發生了什麼。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/rooms/${roomCode}?joinToken=${encodeURIComponent(joinToken)}&displayName=${encodeURIComponent(displayName)}`} className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">回房間</Link>
              <Link href={`/simulation`} className="rounded-xl bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800">模擬比較</Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm lg:col-span-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">顯示筆數</p>
                <p className="mt-1 text-2xl font-bold text-stone-900">{filteredLogs.length}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">涵蓋回合</p>
                <p className="mt-1 text-2xl font-bold text-stone-900">{aggregate.uniqueRounds}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">失敗訊號</p>
                <p className="mt-1 text-2xl font-bold text-stone-900">{aggregate.failedCount}</p>
                <p className="mt-1 text-[11px] text-stone-500">約 {aggregate.failureRate}%</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">阻塞切換</p>
                <p className="mt-1 text-2xl font-bold text-stone-900">{aggregate.blockingChanges}</p>
                <p className="mt-1 text-[11px] text-stone-500">約 {aggregate.blockingRate}%</p>
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">階段分布</p>
                <span className="text-[11px] text-stone-500">快速看這次篩選落在哪些流程</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-700">
                {aggregate.phaseCounts.length > 0 ? aggregate.phaseCounts.map(([phase, count]) => (
                  <span key={phase} className="rounded-full bg-white px-2 py-1 font-medium text-stone-700">{phaseLabelZh(phase as GamePhase)} {count}</span>
                )) : <span className="text-stone-500">目前沒有可統計資料</span>}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">快速篩選</p>
                  <p className="mt-1 text-[11px] text-stone-500">先縮小範圍，再展開需要的紀錄。</p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-stone-700">階段</span>
                  <select className="w-full rounded-xl border border-stone-300 px-3 py-2" value={selectedPhase} onChange={(event) => setSelectedPhase(event.target.value as "ALL" | GamePhase)}>
                    {PHASE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.labelZh}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-stone-700">操作者</span>
                  <select className="w-full rounded-xl border border-stone-300 px-3 py-2" value={selectedActor} onChange={(event) => setSelectedActor(event.target.value)}>
                    {actorOptions.map((option) => <option key={option} value={option}>{option === "ALL" ? "全部操作者" : option}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-stone-700">回合</span>
                  <select className="w-full rounded-xl border border-stone-300 px-3 py-2" value={selectedRound} onChange={(event) => setSelectedRound(event.target.value)}>
                    {roundOptions.map((option) => <option key={option} value={option}>{option === "ALL" ? "全部回合" : `第 ${option} 輪`}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-stone-700">操作</span>
                  <select className="w-full rounded-xl border border-stone-300 px-3 py-2" value={selectedActionType} onChange={(event) => setSelectedActionType(event.target.value)}>
                    {actionTypeOptions.map((option) => <option key={option} value={option}>{option === "ALL" ? "全部操作" : actionTypeLabelZh(option)}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-stone-700">阻塞</span>
                  <select className="w-full rounded-xl border border-stone-300 px-3 py-2" value={selectedBlocking} onChange={(event) => setSelectedBlocking(event.target.value as (typeof BLOCKING_OPTIONS)[number]["value"])}>
                    {BLOCKING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.labelZh}</option>)}
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium text-stone-700">關鍵字</span>
                <input className="w-full rounded-xl border border-stone-300 px-3 py-2" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="事件、互助、任務、棄牌…" />
              </label>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-stone-900">這次篩選</p>
            <div className="mt-3 space-y-2 text-sm text-stone-700">
              <div className="rounded-2xl bg-stone-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-stone-500">顯示範圍</p>
                <p className="mt-1 leading-6">{filteredLogs.length} 筆紀錄，涵蓋 {summary.actorCount} 位操作者、{summary.phaseCount} 個階段。</p>
              </div>
              <div className="rounded-2xl bg-stone-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-stone-500">最新時間</p>
                <p className="mt-1 leading-6">{summary.latest}</p>
              </div>
            </div>
            {aggregate.actionTypeCounts.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">常見操作</p>
                <ul className="mt-2 space-y-1 text-xs leading-6 text-stone-700">
                  {aggregate.actionTypeCounts.map(([actionType, count]) => (
                    <li key={actionType} className="flex items-center justify-between gap-3">
                      <span title={actionTypeDebugTitleZh(actionType)}>{actionTypeLabelZh(actionType)}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700">{count} 次</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          {loading ? <p className="text-sm text-stone-600">正在讀取紀錄…</p> : null}
          {errorZh ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorZh}</p> : null}
          {!loading && !errorZh && filteredLogs.length === 0 ? <p className="text-sm text-stone-500">暫無符合篩選條件的正式紀錄。</p> : null}
          {!loading && !errorZh && filteredLogs.length > 0 ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
                先看摘要，再展開需要的紀錄。每筆紀錄會顯示前後狀態與玩家變化。
              </div>
              {filteredLogs.map((entry, index) => {
                const playerDiffs = describePlayerDiff(entry);
                return (
                <details key={`${entry.timestamp}-${actionTypeDebugTitleZh(entry.actionType)}-${entry.actorSeat}-${entry.roomRevision}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4" open={index === 0}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-stone-900">{entry.resultSummaryZh}</p>
                        <p className="mt-1 text-xs text-stone-500">{formatTimestampZh(entry.timestamp, { withYear: true })}｜第 {entry.round} 輪｜{phaseLabelZh(entry.phase)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full bg-white px-2 py-1 font-medium text-stone-700">{entry.actorLabelZh}</span>
                        <span className="rounded-full bg-white px-2 py-1 font-medium text-stone-700" title={actionTypeDebugTitleZh(entry.actionType)}>{actionTypeLabelZh(entry.actionType)}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-stone-700">{entry.payloadSummaryZh}</p>
                  </summary>
                  <div className="mt-3 grid gap-3 border-t border-stone-200 pt-3 text-xs leading-6 text-stone-700 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-white px-3 py-2.5">
                      <p className="font-semibold text-stone-900">前置狀態</p>
                      <p>階段：{phaseLabelZh(entry.statusBefore.phase)}</p>
                      <p>回合：{entry.statusBefore.round}</p>
                      <p>壓力：{entry.statusBefore.pressure}</p>
                      <p>目前輪到：{entry.statusBefore.activeSeat ?? "—"}</p>
                      <p>阻塞視窗：{blockingLabelZh(entry.statusBefore.blockingWindowKind as "none" | "loss" | "discard" | "ability" | null | undefined)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2.5">
                      <p className="font-semibold text-stone-900">後置狀態</p>
                      <p>階段：{phaseLabelZh(entry.statusAfter.phase)}</p>
                      <p>回合：{entry.statusAfter.round}</p>
                      <p>壓力：{entry.statusAfter.pressure}</p>
                      <p>目前輪到：{entry.statusAfter.activeSeat ?? "—"}</p>
                      <p>阻塞視窗：{blockingLabelZh(entry.statusAfter.blockingWindowKind as "none" | "loss" | "discard" | "ability" | null | undefined)}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2.5 md:col-span-2">
                      <p className="font-semibold text-stone-900">玩家變化</p>
                      {playerDiffs.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {playerDiffs.map((diff) => {
                            const isLoss = /SR \d+→\d+|SP \d+→\d+/.test(diff.changesZh) && diff.changesZh.includes('→');
                            const hasRecovery = /(SR|SP) \d+→\d+/.test(diff.changesZh) && (' ' + diff.changesZh).match(/(?:SR|SP) (\d+)→(\d+)/g)?.some((part) => {
                              const m = part.match(/(?:SR|SP) (\d+)→(\d+)/);
                              return m ? Number(m[2]) > Number(m[1]) : false;
                            });
                            const hasMove = diff.changesZh.includes('位置 ');
                            const tone = hasRecovery
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : hasMove
                                ? 'border-sky-200 bg-sky-50 text-sky-800'
                                : isLoss
                                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                                  : 'border-stone-200 bg-white text-stone-700';
                            return (
                              <span key={`${entry.roomRevision}-${diff.seatId}`} className={`rounded-full border px-3 py-1 text-[11px] font-medium ${tone}`}>
                                {diff.seatId}｜{diff.changesZh}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-1 text-stone-500">這筆操作沒有直接改變玩家的 SR / SP / AP / 位置。</p>
                      )}
                    </div>
                  </div>
                </details>
              );})}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
