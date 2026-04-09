"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type CreateRoomResponse = {
  ok: boolean;
  data?: {
    room: { roomCode: string };
    joinToken: string;
    displayName: string;
  };
  error?: { message: string };
};

type BootstrapResponse = {
  ok: boolean;
  data?: {
    room: { roomCode: string };
    joinToken: string;
    displayName: string;
    viewerRole: "host" | "player" | "observer";
  };
  error?: { message: string };
};

type RecentRoomEntry = {
  roomCode: string;
  status: "lobby" | "in_progress" | "finished";
  phase: "lobby" | "crisis" | "action" | "campfire" | "gameover";
  round: number;
  updatedAt: string;
  participantCount: number;
  connectedParticipantCount: number;
  observerCount: number;
};

type RecentRoomsResponse = {
  ok: boolean;
  data?: RecentRoomEntry[];
  error?: { message: string };
};

function phaseLabelZh(phase: RecentRoomEntry["phase"]) {
  switch (phase) {
    case "lobby":
      return "大廳";
    case "crisis":
      return "危機";
    case "action":
      return "行動";
    case "campfire":
      return "營火";
    case "gameover":
      return "結算";
    default:
      return "進行中";
  }
}

function formatRecentUpdateZh(value: string) {
  const targetTime = new Date(value).getTime();
  const deltaMinutes = Math.max(0, Math.round((Date.now() - targetTime) / 60000));

  if (deltaMinutes <= 1) return "剛剛更新";
  if (deltaMinutes < 60) return `${deltaMinutes} 分鐘前`;
  if (deltaMinutes < 24 * 60) return `${Math.floor(deltaMinutes / 60)} 小時前`;

  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(targetTime);
}

export function HomeClient() {
  const router = useRouter();
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [bootstrapAsObserver, setBootstrapAsObserver] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recentRooms, setRecentRooms] = useState<RecentRoomEntry[]>([]);
  const [loadingRecentRooms, setLoadingRecentRooms] = useState(true);
  const [recentRoomsError, setRecentRoomsError] = useState<string | null>(null);
  const [showRecentRooms, setShowRecentRooms] = useState(false);
  const joinRoomCodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadRecentRooms() {
      try {
        setLoadingRecentRooms(true);
        setRecentRoomsError(null);
        const response = await fetch("/api/rooms/recent");
        const result = (await response.json()) as RecentRoomsResponse;

        if (!alive) return;
        if (!result.ok || !result.data) {
          setRecentRoomsError(result.error?.message ?? "目前無法讀取近期房間。");
          setRecentRooms([]);
          return;
        }

        setRecentRooms(result.data);
      } catch {
        if (!alive) return;
        setRecentRoomsError("目前無法讀取近期房間。");
        setRecentRooms([]);
      } finally {
        if (alive) setLoadingRecentRooms(false);
      }
    }

    void loadRecentRooms();
    return () => {
      alive = false;
    };
  }, []);

  async function bootstrapRoom(params: {
    roomCode: string;
    joinToken?: string | null;
    displayName?: string | null;
    bootstrapAsObserver: boolean;
  }) {
    const response = await fetch("/api/rooms/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomCode: params.roomCode,
        joinToken: params.bootstrapAsObserver ? null : params.joinToken?.trim() || null,
        displayName: params.displayName?.trim() || null,
        bootstrapAsObserver: params.bootstrapAsObserver,
      }),
    });
    return (await response.json()) as BootstrapResponse;
  }

  async function handleCreateRoom(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: createDisplayName }),
      });
      const result = (await response.json()) as CreateRoomResponse;

      if (!result.ok || !result.data) {
        setMessage(result.error?.message ?? "建立房間失敗。")
        return;
      }

      const query = new URLSearchParams({
        joinToken: result.data.joinToken,
        displayName: result.data.displayName,
      });
      router.push(`/rooms/${result.data.room.roomCode}?${query.toString()}`);
    } finally {
      setPending(false);
    }
  }

  async function handleJoinRoom(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const result = await bootstrapRoom({
        roomCode: joinRoomCode.trim().toUpperCase(),
        joinToken,
        displayName: joinDisplayName,
        bootstrapAsObserver,
      });

      if (!result.ok || !result.data) {
        setMessage(result.error?.message ?? "入房失敗。")
        return;
      }

      const query = new URLSearchParams({
        joinToken: result.data.joinToken,
        displayName: result.data.displayName,
      });
      router.push(`/rooms/${result.data.room.roomCode}?${query.toString()}`);
    } finally {
      setPending(false);
    }
  }

  async function handleObserveRecentRoom(roomCode: string) {
    setPending(true);
    setMessage(null);

    try {
      const result = await bootstrapRoom({
        roomCode,
        displayName: joinDisplayName,
        bootstrapAsObserver: true,
      });

      if (!result.ok || !result.data) {
        setMessage(result.error?.message ?? "無法旁觀加入。");
        return;
      }

      const query = new URLSearchParams({
        joinToken: result.data.joinToken,
        displayName: result.data.displayName,
      });
      router.push(`/rooms/${result.data.room.roomCode}?${query.toString()}`);
    } finally {
      setPending(false);
    }
  }

  function handlePrefillRoomCode(roomCode: string) {
    setJoinRoomCode(roomCode);
    setBootstrapAsObserver(false);
    setMessage(`已帶入房間 ${roomCode}，可在右側完成加入。`);
    joinRoomCodeInputRef.current?.focus();
  }

  return (
    <main className="min-h-screen bg-[#F4F3EB] px-6 py-10 text-stone-900">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch">
        <div className="flex flex-col gap-6 lg:h-full">
          <section className="flex-1 rounded-3xl border border-[#D9DEC0] bg-[#FCFCF7] p-6 shadow-[0_16px_38px_rgba(94,107,44,0.08)]">
            <p className="mb-2 text-sm font-semibold text-[#5E6B2C]">守護之心多人同步 MVP</p>
            <h1 className="mb-3 text-[32px] font-bold tracking-[-0.02em] text-stone-950">守護之心｜多人同步電子桌面</h1>
            <p className="max-w-[36rem] text-sm leading-7 text-stone-500">
              你可以開房、重進既有玩家身分，或直接以觀察者加入同一局。
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#D9DEC0] bg-[#F7FAEE] p-4 text-sm leading-7 text-[#4E5A24] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <p className="font-semibold tracking-[-0.01em]">目前已可試玩的內容</p>
                <ul className="mt-2 list-disc pl-5">
                  <li>開房、入房、觀察者進房</li>
                  <li>角色指派、開局、開始本輪</li>
                  <li>事件、任務、地圖、手牌、營火鏈</li>
                  <li>棄牌與損失反應視窗</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#E4E8D4] bg-[#FAFBF6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <p className="text-sm font-semibold text-stone-800">快速入口</p>
                <div className="mt-3 flex flex-col gap-2">
                  <a
                    href="https://guardian-heart-rules-site.vercel.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#C8D1A7] bg-white px-4 py-2.5 text-sm font-semibold text-[#5E6B2C] transition hover:bg-[#F0F4E2]"
                  >
                    查看規則圖卡
                  </a>
                  <a
                    href="/simulation"
                    className="inline-flex items-center justify-center rounded-2xl bg-[#5E6B2C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#526126]"
                  >
                    打開 AI 模擬比較頁
                  </a>
                </div>
                <p className="mt-3 text-xs leading-6 text-stone-400">
                  第一次玩可先看規則圖卡，再回來建立或加入房間。
                </p>
              </div>
            </div>

            {message ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p> : null}
          </section>

          <section className="rounded-3xl border border-[#D9DEC0] bg-[#FDFDFB] p-6 shadow-[0_10px_24px_rgba(94,107,44,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-stone-950">近期房間</h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">可先帶入房號，或直接以觀察者旁觀。</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#F0F4E2] px-3 py-1 text-[11px] font-medium text-[#5E6B2C]">
                  {loadingRecentRooms ? "讀取中" : `${recentRooms.length} 局`}
                </span>
                <button
                  type="button"
                  className="rounded-full border border-[#C8D1A7] bg-white px-3 py-1 text-[11px] font-medium text-[#5E6B2C] transition hover:bg-[#F0F4E2]"
                  onClick={() => setShowRecentRooms((current) => !current)}
                >
                  {showRecentRooms ? "收起" : "展開"}
                </button>
              </div>
            </div>

            {!showRecentRooms ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#D9DEC0] bg-[#FAFBF6] px-4 py-4 text-sm text-stone-500">
                已收起近期房間，點右上角展開查看。
              </div>
            ) : recentRoomsError ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{recentRoomsError}</p>
            ) : loadingRecentRooms ? (
              <div className="mt-4 grid gap-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={`recent-room-skeleton-${index}`} className="animate-pulse rounded-2xl border border-[#E4E8D4] bg-[#FAFBF6] p-4">
                    <div className="h-4 w-32 rounded bg-stone-200" />
                    <div className="mt-3 h-3 w-48 rounded bg-stone-200" />
                    <div className="mt-4 h-9 w-full rounded bg-stone-200" />
                  </div>
                ))}
              </div>
            ) : recentRooms.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#D9DEC0] bg-[#FAFBF6] px-4 py-5 text-sm leading-6 text-stone-600">
                目前還沒有可顯示的進行中房間。你可以先建立一局，再把網址分享給其他人。
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {recentRooms.map((room) => (
                  <div key={`recent-room-${room.roomCode}`} className="rounded-2xl border border-[#E4E8D4] bg-[#FAFBF6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-stone-950">{room.roomCode}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${room.status === "lobby" ? "bg-amber-100 text-amber-700" : "bg-[#EEF4D8] text-[#5E6B2C]"}`}>
                          {room.status === "lobby" ? "大廳中" : "進行中"}
                        </span>
                        <span className="rounded-full border border-[#D9DEC0] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600">
                          {phaseLabelZh(room.phase)}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-500">{formatRecentUpdateZh(room.updatedAt)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-stone-600">
                      <span className="rounded-full bg-white px-2.5 py-1">玩家 {room.participantCount}/4</span>
                      <span className="rounded-full bg-white px-2.5 py-1">在線 {room.connectedParticipantCount}</span>
                      <span className="rounded-full bg-white px-2.5 py-1">觀察者 {room.observerCount}</span>
                      <span className="rounded-full bg-white px-2.5 py-1">{room.phase === "lobby" ? "尚未開局" : `第 ${room.round} 輪`}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-[#C8D1A7] bg-white px-3 py-2 text-sm font-medium text-[#5E6B2C] transition hover:bg-[#F0F4E2]"
                        onClick={() => handlePrefillRoomCode(room.roomCode)}
                      >
                        帶入房號
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-[#5E6B2C] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#526126] disabled:opacity-50"
                        disabled={pending}
                        onClick={() => void handleObserveRecentRoom(room.roomCode)}
                      >
                        直接旁觀
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="flex flex-col gap-4 lg:h-full">
          <form onSubmit={handleCreateRoom} className="rounded-3xl border border-[#D9DEC0] bg-[#FDFDFB] p-6 shadow-[0_8px_22px_rgba(94,107,44,0.04)]">
            <h2 className="mb-4 text-xl font-semibold">建立新房間</h2>
            <label className="mb-2 block text-sm font-medium">你的顯示名稱</label>
            <input
              value={createDisplayName}
              onChange={(event) => setCreateDisplayName(event.target.value)}
              className="mb-4 w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-[#7A8C3A]"
              placeholder="例如：顥倫"
            />
            <button
              disabled={pending}
              className="w-full rounded-2xl bg-[#5E6B2C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#526126] disabled:opacity-50"
              type="submit"
            >
              {pending ? "處理中..." : "建立房間"}
            </button>
          </form>

          <form onSubmit={handleJoinRoom} className="rounded-3xl border border-[#D9DEC0] bg-[#FCFCFA] p-6 shadow-[0_8px_22px_rgba(94,107,44,0.035)]">
            <h2 className="mb-4 text-xl font-semibold">加入既有房間</h2>
            <label className="mb-2 block text-sm font-medium">房間代碼</label>
            <input
              ref={joinRoomCodeInputRef}
              value={joinRoomCode}
              onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
              className="mb-4 w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-[#7A8C3A]"
              placeholder="例如：ABC123"
            />

            <label className="mb-2 block text-sm font-medium">顯示名稱（觀察者模式會用到）</label>
            <input
              value={joinDisplayName}
              onChange={(event) => setJoinDisplayName(event.target.value)}
              className="mb-4 w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-[#7A8C3A]"
              placeholder="例如：督導觀察者"
            />

            <label className="mb-2 block text-sm font-medium">重進識別碼（玩家重進用）</label>
            <input
              value={joinToken}
              onChange={(event) => setJoinToken(event.target.value)}
              className="mb-4 w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-[#7A8C3A]"
              placeholder="若要重進既有玩家身分，請貼上重進識別碼"
              disabled={bootstrapAsObserver}
            />

            <label className="mb-4 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={bootstrapAsObserver}
                onChange={(event) => setBootstrapAsObserver(event.target.checked)}
              />
              以觀察者模式加入
            </label>

            <button
              disabled={pending}
              className="w-full rounded-2xl bg-[#74883A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#667834] disabled:opacity-50"
              type="submit"
            >
              {pending ? "處理中..." : "加入房間"}
            </button>
          </form>

        </section>
      </div>
    </main>
  );
}
