# UI refresh v13｜地圖卡面精修

本輪只做玩家模式的地圖與側欄精修，不改規則、AI 邏輯或事件／任務內容。

## 本輪調整

### 1. 地格名稱不再雙行
- 地圖卡面標題改成單行顯示
- 以 `whitespace-nowrap + truncate` 控制，不再把名稱折成兩行
- 移除主卡面左上角的地格定位碼（C / I / O），降低工程感

### 2. 地格類型 chip 改成單行
- `中央 / 一般 / 風險 / 物資 / 庇護` 改成短型單行 pill
- hover / popover 仍可看到完整效果說明

### 3. 角色 token 更明顯
- 同格玩家 token 加大、加強對比
- 自己的 token 維持深色並加強金色強調
- 目前行動中的座位也會更明顯

### 4. 位置文字改為中文地格名
- `位置：C` 類型改為顯示對玩家更直觀的 `位置：中央大道`
- 主畫面上方的「目前地格」也同步改成地格中文名

### 5. 玩家卡狀態 chip 不再折行
- `你 / 行動中 / AI / 陪伴可用` 這類 chip 改成單行固定高度
- 降低左側玩家欄的凌亂感

## 驗證
- 使用 TypeScript `transpileModule` 檢查：
  - `room-client.tsx` OK
  - `guardian-heart-map-stage.tsx` OK
- 專案整體 `tsc --noEmit` 仍會受既有 Next / React / Supabase 環境缺件影響，本輪不以其作為有效驗證。
