# Claude 地圖整合 v1

這輪已把使用者提供的 Claude 地圖產物接進目前 web 專案，目標不是單純放一張參考圖，而是把它變成實際可用的工程資料來源。

## 本輪採用的來源
- `map-layout-v1.ts`：作為單一權威地圖資料來源
- `GuardianHeartMap.tsx`：作為視覺風格與 SVG 呈現參考
- `GuardianHeartMapPreview.jsx`：作為互動預覽與圖例呈現參考

## 已接入的實際改動
1. 新增 `src/domain/guardian-heart/seeds/map/canonical-map-layout-v1.ts`
   - 保留 axial 座標與鄰接資料
   - 將中央地格 id 從 Claude 版本的 `C0` 轉成目前專案相容的 `C`
   - 類型直接對齊目前專案的 `center / safe / risk / station / shelter`

2. `src/domain/guardian-heart/seeds/map/minimal-map.ts`
   - 改為直接匯出 `CANONICAL_MAP_V1`
   - 讓大廳 preview 與正式局面共用同一套 canonical 地圖 seed

3. `src/components/guardian-heart/guardian-heart-map-stage.tsx`
   - 不再使用硬編碼的 19 格百分比位置
   - 改由 `canonical-map-layout-v1.ts` 的 axial 座標自動換算位置
   - 類型中文、圖示與視覺重點改參照 Claude 版本
   - 地圖 badge 增加 `Claude 地圖 v1` 標記，方便辨識目前套用的版型

## 這輪沒有做的事
- 沒有改動遊戲規則
- 沒有改動相鄰／移動／事件／任務邏輯
- 沒有直接把 Claude 的 TSX 原樣塞進主畫面，因為目前主地圖仍需要疊合玩家站位、合法移動、互助快捷操作

## 後續可做
- 若要再往下精修，可以把 Claude 的 SVG 呈現進一步吸收到正式地圖元件
- 也可以把 `GuardianHeartMap.tsx` 留作純靜態預覽或設計校對元件
