# UI v54｜桌機操作語言與擴充通道再收一輪

## 這輪做了什麼

### 1. 桌機全文入口再統一
- 新增「全文入口與擴充通道」區塊
- 把事件、任務、手牌三條線都收成同一種語言：
  - 打開全文
  - 帶入焦點／直接操作
- 每條線都會直接顯示目前對應的 profile，方便檢查後續加卡是否仍能被 UI 承接

### 2. 右欄主控卡按鈕語言再對齊
- 查看事件全文 → 打開事件全文
- 查看事件焦點 → 帶入事件焦點
- 宣告任務 → 直接宣告
- 直接使用 → 直接使用這張牌
- 繼續營火 → 直接續推營火

### 3. 工作區按鈕語言同步
- 主畫面工作區也同步採用相同用語
- 讓右欄主控卡、工作區卡、全文入口不再各講各的

### 4. 擴充承接位再扎實
- 事件池 profile 詳細說明加入 tags／立即效果／未解懲罰承接提醒
- 任務池 profile 詳細說明加入條件／獎勵／宣告狀態承接提醒
- 行動牌池 profile 詳細說明加入類型／AP／requirement badges 承接提醒

## 驗證
- `npx tsc --noEmit`：通過
- `npx eslint src/components/guardian-heart/room-client.tsx src/components/guardian-heart/guardian-heart-map-stage.tsx`：通過
- `npm run build`：通過
