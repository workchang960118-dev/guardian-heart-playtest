# UI v43｜Control cockpit big pass

## 本輪定位
這輪不是單點補丁，而是把主畫面再往「單頁操作台」推一段，集中收以下幾塊：
- 營火 / blocking window 可讀性
- 角色能力狀態可見性
- 單頁指令台的阻塞原因呈現
- 手機版底部快捷帶
- 玩家卡能力狀態
- 地圖主舞台的前置提示

---

## 本輪完成

### 1. 單頁指令台補上「目前卡住原因」
- 在 command deck 主卡內新增阻塞原因區塊
- 會優先顯示：
  - actionDisabledReasonZh
  - pending loss 阻塞
  - discard 視窗阻塞
  - 營火尚不可續推時的 queue 摘要
- 目標是讓玩家不只看到 disabled，而是知道為什麼現在不能做

### 2. 右側資訊欄新增「角色能力焦點」
- 顯示目前角色、能力名、能力狀態
- 顯示：
  - 本輪／本局是否還有可用次數
  - 能力是否被 toggle 關閉
  - 目前最值得留意的觸發窗口
- 讓角色能力不再只藏在規則文字或 tooltip

### 3. 右側資訊欄新增「營火駕駛艙」
- 直接把 campfireStepCards 拉進單頁主畫面
- 補 compact 版本的 queued loss 顯示
- 若可續推營火，提供直接按鈕
- 若有焦點任務，也可直接查看

### 4. 玩家卡補上能力狀態
- 玩家卡現在除了角色名與能力摘要，也會顯示：
  - 能力名
  - 能力狀態 badge
  - 能力剩餘次數 / 已用 / 關閉
- 這讓看隊伍列時就能直接判讀誰還有技能節點可用

### 5. 手機版新增底部快捷帶
- 固定在底部、只在 md 以下顯示
- 顯示：
  - phase
  - 目前主動作提示
  - 角色能力狀態
- 也補了 4 個快捷按鈕：
  - 回到本人地格
  - 查看事件
  - 直接使用手牌
  - 繼續營火
- 目的就是避免手機一直上下捲找關鍵入口

### 6. 地圖主舞台補上前置提示卡
- 在主地圖上方新增兩塊 compact 提示：
  - 地圖主提示（目前格 / 焦點格 / 指定地格模式）
  - 規則與能力提醒（壓力互助門檻 / 角色能力提示 / 最新地圖操作回饋）
- 讓玩家進地圖區時，先知道現在看哪裡、能做什麼

---

## touched files
- `src/components/guardian-heart/room-client.tsx`
- `src/components/guardian-heart/guardian-heart-map-stage.tsx`
- `docs/ui-v43-control-cockpit-big-pass.md`

---

## 驗證
### 已完成
- 使用 TypeScript `transpileModule` 對以下檔案做語法層驗證：
  - `src/components/guardian-heart/room-client.tsx`
  - `src/components/guardian-heart/guardian-heart-map-stage.tsx`
- 兩者皆通過

### 尚未完成
- 這個容器本輪無法成功安裝 Next / React 依賴，因此沒有完成：
  - `npm run build`
  - `npx tsc --noEmit`
  - `eslint`

因此本輪可誠實定義為：
**UI 改動已落地、關鍵檔語法層已驗證，但尚未取得完整 full build pass。**

---

## 下一輪最值得接的方向
- 損失反應視窗（critical / floating）再做一次 UI 分層
- 任務宣告窗口與營火 task window 再收一輪
- 手機版把焦點卡與底部快捷帶再整成更一致的節奏
