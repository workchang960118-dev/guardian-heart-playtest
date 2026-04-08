# UI v31 Hook Order Hotfix

## 修正內容
- 修正 `RoomClient` 的 Hooks 順序錯誤。
- 問題來源：任務浮窗定位用的 `useEffect` 被放在 `loading / !data / !uiState` 的早退判斷之後，導致首次 render 與後續 render 的 Hooks 數量不同。
- 現在已把該 effect 移回所有 early return 之前，並讓 `openTaskPopoverId` 在 effect 使用前先宣告。

## 驗證
- `npx tsc --noEmit`：通過
- `npm run build`：通過（至少完成 compile 與 TypeScript；build artifacts 已產出）
