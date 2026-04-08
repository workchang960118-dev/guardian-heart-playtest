# UI v50｜桌機工作區＋全文視窗統一包

本輪集中在桌機／筆電版，主軸是把主畫面上方工作區、任務全文、事件全文、手牌全文三條線再收成更一致的 control surface，同時保留未來新增事件卡／任務卡／行動卡的 metadata 通道。

## 本輪完成
- 新增桌機四欄「工作區」卡：事件、任務、手牌、流程
- 每張工作區卡都可直接進入對應全文或主操作
- 任務桌機浮窗補成更完整的宣告／規格面板
- 事件全文補上 card id、pool profile、多人投入狀態
- 手牌全文補上 action deck profile、card id、AP cost metadata
- 修正 map stage 的 kind label 型別錯
- 修正 room-client 中桌機新增區塊的型別與宣告順序問題

## 驗證
- `npx tsc --noEmit`：pass
- `npx eslint src/components/guardian-heart/room-client.tsx src/components/guardian-heart/guardian-heart-map-stage.tsx`：pass
- `npm run build`：pass

## 這輪最有感的桌機變化
1. 主畫面上方多了一排真正可操作的桌機工作區，而不是只看摘要。
2. 任務／事件／手牌三種全文視窗的語言與 metadata 更一致，後續新增卡池時比較不會再拆新 UI。
3. 桌機版從主畫面到全文視窗的切換更像同一套控制台，而不是很多零散 panel。
