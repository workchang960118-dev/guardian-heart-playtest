# UI v58｜桌機焦點條與全文流程 rail

## 這輪做了什麼

### 1. 清掉重複的任務全文 overlay
- 刪除主畫面上方控制列附近那一份重複的 `showTaskDetailModal` 視窗。
- 保留後面那份正式版任務全文視窗，避免同一個 state 對應兩份桌機任務全文結構。

### 2. 新增桌機焦點條（Focus Strip）
- 在桌機主畫面摘要卡下方新增 3 張焦點條：
  - 隊友焦點
  - 任務焦點
  - 手牌焦點
- 每張都補：
  - 當前值
  - 兩顆 compact pills
  - 一個主動作按鈕
  - 一個清除焦點按鈕
- 用意是讓「玩家列 → 地圖 → 任務／手牌」不只是在右欄同步，也能在中央主畫面直接操作。

### 3. 補桌機全文內的流程 rail
- 在以下全文／blocking overlay 開頭補上 compact `FlowStatusRail`：
  - 事件全文
  - 手牌全文
  - 任務全文
  - 營火整理視窗
  - 棄牌 blocking 視窗
- 既有重損視窗本來就有完整 rail，這輪不重做，只保留。

### 4. 焦點清除行為補齊
- 清除任務焦點時，會一起關閉任務全文。
- 清除手牌焦點時，會一起關閉手牌全文。

## 這輪目的
- 讓桌機版更像真正的「單頁控制台」，而不是只有右欄在同步。
- 把 blocking / campfire / declaration 的流程感帶進全文視窗，減少使用者在不同視窗間失去上下文。
- 清掉重複視窗，避免後面再擴充任務卡 metadata 時一處改了、另一處漏掉。

## 驗證
- `typescript.transpileModule`
  - `src/components/guardian-heart/room-client.tsx`：通過
  - `src/components/guardian-heart/guardian-heart-map-stage.tsx`：通過
- 未完成 full `tsc / eslint / build`，因為這個容器缺少專案依賴（Next / React / types）。
