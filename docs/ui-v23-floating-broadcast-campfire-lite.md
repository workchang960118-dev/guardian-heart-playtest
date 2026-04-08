# UI v23｜懸浮廣播、扁平任務列、營火去房主化

## 這刀修正的主方向
1. 動作廣播改成懸浮於主頁面的單行透明廣播，不再切出獨立區塊。
2. 將上方過大的任務區塊收回，主舞台任務列改成扁平 chip rail。
3. 營火流程改成「系統自動跑固定結算，只在任務宣告與損失反應停下」。
4. 避免房主成為正式流程的必要介入者：
   - 開始遊戲／開始本輪／開始營火，不再鎖房主
   - 營火後段不再要求全員 ready + 房主推進
   - 損失反應若無人介入，可由任一玩家確認套用

## 主要改動檔案
- `src/components/guardian-heart/room-client.tsx`
- `src/domain/guardian-heart/helpers/ui/derive-room-ui-state.ts`
- `src/domain/guardian-heart/helpers/ui/derive-newcomer-guide.ts`
- `src/server/rooms/services/apply-room-action-service.ts`

## 本刀仍保留的限制
- 大廳角色指派與房務設定仍沿用開房者權限
- `set_campfire_ready` 型別與 reducer 尚未完全移除，先保留相容性

## 驗證情況
- 這次容器在重置後失去既有依賴，且 npm registry 驗證失敗，無法在此容器內重新完成 `next build` 驗證。
- 已完成源碼層修改與手動結構校對；建議接手後先執行：
  - `npm install` 或 `npm ci`
  - `npm run build`
