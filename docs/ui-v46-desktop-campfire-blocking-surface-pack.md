# ui-v46 desktop campfire + blocking surface pack

本輪聚焦桌機 / 筆電 UI，不再延伸手機線。

## 本輪完成

### 1. 桌機主畫面新增一層 primary surface cards
- 在地圖上方新增 4 張桌機摘要卡：
  - 先解主阻塞
  - 事件焦點
  - 任務焦點
  - 能力窗口
- 目的：讓桌機主畫面一進來先看到「現在最該先處理什麼」。

### 2. 左右兩欄改成桌機 sticky
- 玩家列與右側資訊欄在 `xl` 以上改成 sticky。
- 目的：桌機操作時，滾動主畫面仍能保留隊伍資訊與控制摘要。

### 3. 任務浮窗桌機版補成雙欄宣告面板
- 左欄維持任務規則 / 獎勵 / 狀態。
- 右欄新增宣告面板：
  - 現在可否宣告
  - 當前階段
  - 狀態標籤
  - 前 1–3 條阻塞 / 提示
- 目的：桌機不只看資訊，而是直接判讀能不能宣告。

### 4. 營火 overlay 補步驟總覽
- `營火整理中` overlay 改為雙欄：
  - 左欄：為何停下來
  - 右欄：營火步驟總覽卡
- 目的：讓營火不是一塊大字說明，而是可快速理解目前停在哪一步。

### 5. 重損 loss overlay 補受影響玩家狀態
- 新增：
  - 目前 SR / SP
  - 套用後 SR / SP
- 若目前玩家可介入，直接顯示反應區；否則明確顯示等待他人回應。
- 目的：桌機版能直接看出這筆損失是不是會造成倒地。

### 6. discard blocking 補桌機完整 overlay
- 當 blocking window 為 discard 時：
  - 桌機改用完整 overlay
  - 左欄說明目前為何卡住
  - 右欄直接勾選要棄掉的手牌
- 原本內頁版 discard panel 保留給 `md:hidden`。
- 目的：桌機版 blocking 流程一致，不再只有局部紅框。

### 7. 任務宣告區補成桌機診斷面板
- 標題旁補 phase 狀態。
- 右側新增「宣告前快查」欄。
- 目的：桌機版宣告任務時不必來回看右欄與任務浮窗。

## 驗證
- 使用 TypeScript `transpileModule` 檢查：
  - `src/components/guardian-heart/room-client.tsx`
  - `src/components/guardian-heart/guardian-heart-map-stage.tsx`
- 兩者語法層皆通過。

## 尚未完成
- 未取得 full build pass。
- `npx tsc --noEmit` 仍受整體專案既有缺依賴 / 非本輪 touched files 問題影響，無法作為本輪 UI 改動的單獨否決依據。
