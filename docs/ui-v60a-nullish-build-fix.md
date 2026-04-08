# UI v60a｜Nullish coalescing build fix

## 修正內容
- 修正 `room-client.tsx` 中 `??` 與 `&&` 混用造成的 Turbopack parsing error。
- 新增 `activePlayerActionReasonZh` alias，統一承接 `uiState?.activePlayerActionReasonZh ?? ""`。
- `canMoveToSelectedMapTile` 與 `canUseCurrentTileQuick` 改用 alias 判斷，避免再出現 `!foo ?? ""` 這種需要額外括號的寫法。

## 驗證
- `typescript.transpileModule`（`room-client.tsx`）通過。
