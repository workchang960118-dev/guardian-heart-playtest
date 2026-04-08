# UI v36｜overlay close consistency ＆ room-client hooks pass

## 這輪處理範圍
主戰場仍是 `src/components/guardian-heart/room-client.tsx`，目標是把 v35 後仍殘留的互動毛邊與 hooks 警告往下收斂，避免後續再疊功能時越修越散。

## 本輪完成

### 1. 關閉邏輯收斂
- `RoomOverlayDialog` 補上共通關閉行為：
  - 點背景可關閉（可被 `dismissible=false` 關掉）
  - 按 `Esc` 可關閉
  - 內層 panel 會阻止事件冒泡，避免誤關閉
- 任務浮窗補齊共通收起行為：
  - 點浮窗外可收起
  - 按 `Esc` 可收起
  - 若 trigger 消失，會主動收掉而不是殘留在舊位置
- 右上工具選單補齊一致的關閉方式：
  - 點選單外可關閉
  - 按 `Esc` 可關閉

### 2. room-client hooks / callback 收斂
- `bootstrap` 改成 `useCallback`，移除原本對 `exhaustive-deps` 的手動忽略
- `runAction` 改成穩定 callback，並往前調整宣告順序，讓自動推進 effect 不再出現「先使用後宣告」的型別問題
- `dismissNightTransition`、`closeOpeningBriefModal`、`updateTaskPopoverPosition` 都改成穩定 callback
- 原先 `room-client.tsx` 內多筆 hooks dependency warning 已清空

### 3. 沒用到的 UI 狀態收斂
- 先前已計算但未落到畫面的 broadcast tone / detail 等資訊，現在已實際接到中央懸浮廣播
- 輪到玩家時的 turn toast 狀態，現在會反映到廣播外觀，不再只是孤立 state
- 任務區選中任務的 summary / reasons 改優先顯示 task UI meta，減少重複計算卻未使用的變數
- 大廳開局提示補上「至少完成 2 張任務」的明示口徑

## 驗證
- `npx eslint src/components/guardian-heart/room-client.tsx`：通過
- `npx tsc --noEmit`：通過

## 目前仍存在但非本輪處理
整個專案跑 `npm run lint` 仍有舊問題，主要不在 `room-client.tsx`：
- 根目錄分析腳本含 `any`
- `scripts/print-mvp-readiness.mjs` 有字串未終止 parsing error
- 少數 server / helper 檔案有既有 unused warnings

## 下一刀建議
1. 清 `scripts/print-mvp-readiness.mjs` 與根目錄分析腳本 lint error，讓整包更接近可交付狀態
2. 把 `room-logs-client.tsx` 與 server 端 unused imports / helpers 清一輪
3. 若要繼續 UI 收斂，下一個最合理點是：
   - 行動卡 modal / utility menu / event reveal 的視覺節奏統一
   - 單頁主畫面剩餘密度與空白再壓一輪
