# UI v51｜桌機全文視窗 footer／任務全文統一包

本輪重點：
1. 新增任務全文 overlay，讓桌機任務不再只有主畫面小卡與固定焦點。
2. 為桌機全文視窗補齊一致的 header meta pills 與 footer action bar。
3. 將事件、任務、手牌、營火、重損、棄牌 blocking 的桌機操作語言再統一一輪。
4. 持續保留未來新增事件卡／任務卡／行動卡的 metadata 通道。

## 這輪完成
- `RoomOverlayDialog` 新增 `headerMeta`
- 新增 `OverlayMetaPills`
- 新增 `OverlayFooterBar`
- 新增桌機 `showTaskDetailModal` 任務全文 overlay
- 事件全文 overlay 改為更大版型，並補 header meta + footer action
- 手牌完整操作 overlay 改為更大版型，並補 header meta + footer action
- 營火 overlay 補 header meta + footer action
- 重損 loss overlay 補 header meta + footer action
- discard blocking overlay 補 header meta + footer action
- 主畫面任務焦點區新增「查看全文」入口

## 驗證
- `npx tsc --noEmit`：通過
- `npx eslint src/components/guardian-heart/room-client.tsx src/components/guardian-heart/guardian-heart-map-stage.tsx`：通過
- `npm run build`：通過（log 中有 `EPIPE` 訊息，但 exit code 為 0，且 build 已完成 `Compiled successfully`、`Finished TypeScript`）

## 備註
- 本輪仍以桌機／筆電版為主，不主動處理手機線。
- metadata pill / footer bar 已可承接未來更多事件卡、任務卡、行動卡的 pool profile 與 card id。
