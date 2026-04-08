# UI v57｜桌機收尾包

本輪集中收桌機／筆電版最後一輪可讀性與流程感，重點不是再開新功能，而是把主畫面、blocking、營火與宣告面板更像同一套 control surface。

## 這輪完成

### 1. 主畫面新增「阻塞與續推」rail
- 在桌機主畫面補上一列固定 rail
- 統一顯示四個關鍵節點：
  - 損失反應
  - 棄牌阻塞
  - 任務宣告
  - 營火續推
- 以 active / complete / idle 三種視覺狀態呈現
- 目的：讓玩家先知道目前卡在流程哪一段，而不是只看單一卡片訊息

### 2. 工作區卡動作區改成更穩定的 2 欄按鈕格
- 事件工作區
- 任務工作區
- 手牌工作區
- 流程工作區

原本是 flex pill 式按鈕，這輪改成 2 欄按鈕格，桌機版更整齊，也更接近正式操作台。

### 3. 營火 overlay 補進同一條流程 rail
- 「營火整理中」不只顯示步驟總覽
- 也會同步顯示目前整體 blocking / resolve 順序
- 讓玩家知道自己停在營火內的哪一步，以及和其他 blocking 狀態的關係

### 4. 重損 loss overlay 補進流程 rail
- 在完整重損視窗上方加入相同的 flow rail
- 現在可以一眼看出：
  - 目前是損失反應 active
  - 棄牌／任務宣告／營火續推各自狀態
- 強化桌機裁定感

### 5. discard blocking overlay 補進流程 rail
- 棄牌視窗不再只是等待目標玩家勾牌
- 現在會顯示整條 blocking rail
- 讓桌機使用者知道這個 blocking 在整體流程中的位置

### 6. 任務宣告區補進 compact rail
- 在「營火任務宣告」桌機區塊加入 compact 版 flow rail
- 宣告前除了看單張任務與快查，也能同步知道損失／棄牌／續推順序

## 這輪的收尾方向
- 不新增手機 UI
- 不重開規則討論
- 主要把桌機主畫面、營火、blocking、宣告這幾塊做成更一致的流程語言

## 驗證
- 使用 TypeScript `transpileModule` 檢查：
  - `src/components/guardian-heart/room-client.tsx`
  - `src/components/guardian-heart/guardian-heart-map-stage.tsx`
- 兩者語法層皆通過

## 備註
- 這個容器目前沒有完整安裝 Next / React / ESLint 專案依賴
- 因此本輪沒有取得 full `tsc --noEmit` / `npm run build` / `eslint` pass
- 但本輪 touched files 的 JSX / TS 語法層已確認可過
