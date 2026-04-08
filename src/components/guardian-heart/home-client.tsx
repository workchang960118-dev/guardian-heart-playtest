"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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

export function HomeClient() {
  const router = useRouter();
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [bootstrapAsObserver, setBootstrapAsObserver] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      const response = await fetch("/api/rooms/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: joinRoomCode.trim().toUpperCase(),
          joinToken: bootstrapAsObserver ? null : joinToken.trim() || null,
          displayName: joinDisplayName.trim() || null,
          bootstrapAsObserver,
        }),
      });
      const result = (await response.json()) as BootstrapResponse;

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

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-stone-900">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-amber-700">守護之心多人同步 MVP</p>
          <h1 className="mb-4 text-3xl font-bold">守護之心｜多人同步電子桌面</h1>
          <p className="mb-6 text-sm leading-7 text-stone-600">
            這是目前最小可跑的房間入口。你可以建立房間、以玩家身分重進，或用觀察者模式加入同一局。
          </p>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
            <p className="font-semibold">目前這版已納入：</p>
            <ul className="mt-2 list-disc pl-5">
              <li>開房／入房／觀察者進房</li>
              <li>角色指派、開局、開始本輪</li>
              <li>最小事件、任務、地圖、手牌、營火鏈</li>
              <li>棄牌與損失反應視窗</li>
              <li>AI 模擬比較 API 與前端報表頁</li>
            </ul>
            <a href="/simulation" className="mt-4 inline-flex rounded-2xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white">
              打開 AI 模擬比較頁
            </a>
          </div>
          {message ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p> : null}
        </section>

        <section className="grid gap-6">
          <form onSubmit={handleCreateRoom} className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">建立新房間</h2>
            <label className="mb-2 block text-sm font-medium">你的顯示名稱</label>
            <input
              value={createDisplayName}
              onChange={(event) => setCreateDisplayName(event.target.value)}
              className="mb-4 w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-500"
              placeholder="例如：顥倫"
            />
            <button
              disabled={pending}
              className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              type="submit"
            >
              {pending ? "處理中..." : "建立房間"}
            </button>
          </form>

          <form onSubmit={handleJoinRoom} className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">加入既有房間</h2>
            <label className="mb-2 block text-sm font-medium">房間代碼</label>
            <input
              value={joinRoomCode}
              onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
              className="mb-4 w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-500"
              placeholder="例如：ABC123"
            />

            <label className="mb-2 block text-sm font-medium">顯示名稱（觀察者模式會用到）</label>
            <input
              value={joinDisplayName}
              onChange={(event) => setJoinDisplayName(event.target.value)}
              className="mb-4 w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-500"
              placeholder="例如：督導觀察者"
            />

            <label className="mb-2 block text-sm font-medium">重進識別碼（玩家重進用）</label>
            <input
              value={joinToken}
              onChange={(event) => setJoinToken(event.target.value)}
              className="mb-4 w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-amber-500"
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
              className="w-full rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
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
