# UI v60｜RoomClient hook order hotfix

## 修正內容
- 修正 `RoomClient` 的 hook 順序錯誤：`loading || !data || !uiState` 的 early return 原本位在 3 個桌機焦點／快捷同步 `useEffect` 之前，造成初次 render 與後續 render 的 hook 數量不同。
- 將 loading guard 移到上述 `useEffect` 之後，確保每次 render 都先走過同一批 hooks。
- 新增 `EMPTY_SNAPSHOT_FOR_HOOKS`，讓 loading 階段在 hooks 計算依賴時仍有穩定 fallback，不會因 `data` 尚未載入而存取到 `undefined`。
- 將前段衍生計算統一改走 `snapshot / viewerSeat / viewerRole` fallback alias，避免 hook 前的依賴讀值受載入狀態影響。

## 對應錯誤
- `Rendered more hooks than during the previous render`
- `React has detected a change in the order of Hooks called by RoomClient`

## 預期效果
- 初次載入房間時，不會因 loading render 少跑 hooks、資料到位後又多跑 hooks 而炸掉。
- 保留 v59 桌機 UI 收尾內容，不回退桌機版收斂成果。
