# Guardian Heart Multiplayer MVP｜10A 最終缺口盤點

這份文件承接：
- `docs/smoke-test-checklist.md`
- `docs/action-log-persistence.md`
- `src/domain/guardian-heart/testing/mvp-gap-registry.ts`

用途只有四個：
1. 重新盤點目前 repo 距離「首版可跑 MVP」還差什麼
2. 區分哪些 P0 已經收掉、哪些還沒收掉
3. 在真正下載、安裝、跑 smoke test 前，先把最後缺口講清楚
4. 為 10B 的本機安裝與端到端總回歸做入口文件

---

## 一、目前可以說已完成的 P0

### 1. play_action_card 正式入口已接線
- 核心 6 張行動卡已有最小 effect resolution
- 已接手牌、AP、棄牌堆、card toggle
- 不再是 seed 有牌但不能用

### 2. 任務 verifier 與 host review 最小正式流程已接線
- `declare_task` 已走 verifier
- 壓力 6 限制已進 verifier
- `approve_task_declaration / reject_task_declaration` 已存在
- review state 已進 snapshot

### 3. server push 型 realtime 最小正式接線已完成
- `state_updated` payload 已定稿
- server 端已有 broadcast
- client 已能訂閱 SSE
- 仍保留 version gating 與 fallback refresh

### 4. action log 持久化第一版已完成
- snapshot 內 `actionLog` 保留
- `room_action_logs` repository / route / service / migration 已存在
- 房間頁已能顯示正式紀錄同步狀態

### 5. 角色能力第一版已正式掛進主要節點
- 巡林探路者：移動進入或離開風險地格時可免 AP
- 白衣見習生：SP 相鄰互助時額外回復 1SP
- 鐘樓觀測員：投入事件時可做 1 點資源類型轉換
- 街巷信使：相鄰互助後可讓自己或隊友立即移動 1 格
- 商會護衛：營火損失處理時可代承相鄰對象 1 點 SR
- 廣場說書人：營火狀態確認時可為合格投入者回復 1SP

---

## 二、目前仍然是 P0 的缺口

### P0-1 尚未完成一次真正的本機安裝、migration 與端到端 smoke test
這是目前最核心、也最誠實的一條。

目前 repo 與批次 zip 已補到接近 MVP，但仍未完成你實際環境中的：
- 安裝依賴
- 執行 migration
- 啟動 dev server
- 真的從 create room 一路跑到回 `crisis` 或進 `gameover`

所以現在還不能說：
- 已完成首版可跑 MVP
- 已可直接開始 AI 模擬比較

這條不補，其他文件再完整，也仍只是「工程上已逼近完成」，不是「已完成可跑驗收」。

### P0-2 smoke test 仍以 checklist 為主，尚未有 runner
目前已有：
- `docs/smoke-test-checklist.md`
- typed smoke test cases
- `npm run smoke:checklist`

但還沒有真正的：
- 半自動 runner
- 自動收斂 pass / partial / fail
- 自動產出阻斷 fail 彙整

這代表最後驗收仍要依賴人工 checklist 與 gap register。

---

## 三、目前的 P1 / P2

### P1-1 observer / newcomer guide / 中文提示仍屬最低版
- 已可用
- 但對桌測、督導觀看與多同工帶領仍可補強

### P1-2 toggle config 尚未 fully 驅動全部功能
- `roomConfig` 已有基礎
- 但 role / simulation /更多牌效 還未完整接進正式流程

### P2-1 room page 與 helper 還可再整理
- 目前可用
- 後續仍可收斂 component 與 selector

---

## 四、現在的判定口徑

### 可以說的
- 多人同步 MVP 的核心資料、主流程、行動卡、任務宣告、營火主鏈、observer / guide 最低版、action log、realtime push 第一版，都已進 repo。
- 現在已經不是只有規格，而是接近可測試的 MVP 工程狀態。

### 還不能說的
- 已完成首版可跑 MVP
- 已可直接開始 AI simulation 比較
- 已通過完整上線前 smoke test

原因只有一個最重要：
**你還沒有在自己的真實環境，把這整包專案下載、安裝、migration、啟動、跑完整一輪。**

---

## 五、10B 要做什麼

10B 不再補新功能。

10B 要做的是：
1. 下載目前最新整包
2. 安裝依賴
3. 執行 migration
4. 啟動 dev server
5. 依 `docs/smoke-test-checklist.md` 跑第一次 A–F 端到端總回歸
6. 用 gap register 記錄第一輪阻斷點

也就是說，10B 的本質不是再寫 code，而是：
**把目前工程狀態從「接近可跑」正式驗證成「到底能不能跑」。**


## 11B 補充說明
- 任務完成獎勵已接成第一版正式流程。
- 目前獎勵內容屬 MVP 第一版實作集，後續若你提供更終版任務獎勵文本，可直接覆蓋 `minimal-tasks.ts` 與 `task-rewards.ts`。
