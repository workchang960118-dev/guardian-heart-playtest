# UI v14｜大廳遮罩介面＋模擬報表 key 修正

## 這輪處理
1. 修正 AI 模擬比較報表頁的 duplicate key 問題
   - 原本多個版本列與摘要列只用 variantId 或摘要文字當 React key，當資料重複時會噴出 `Encountered two children with the same key`
   - 現在改成 `variantId + index` / `metricId + index` / `line + index` 類型的穩定 key

2. 大廳階段改成主介面遮罩式準備畫面
   - 大廳時會直接出現遮罩層
   - 房主可在遮罩層完成：
     - 真人玩家角色指派
     - P2 / P3 / P4 AI 補位切換
     - 開始遊戲
   - 其他玩家可直接看見目前準備狀態，不必自己去找右側小區塊

## 設計意圖
- 把「大廳準備」從零碎側欄提升成主流程
- 降低第一次進房時的資訊搜尋成本
- 讓所有玩家一進來就知道：現在是在準備開局，而不是已經進入正式遊戲桌面
