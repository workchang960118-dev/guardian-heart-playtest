# UI v40｜單頁指令台、地圖焦點卡、任務焦點卡

## 本輪完成
- 地圖下方新增「單頁指令台」，把移動、使用目前地格、直接使用手牌、宣告任務前推到主畫面
- 新增「地圖焦點卡」，集中顯示當前選地的種類、停留玩家、相鄰地格與閱讀提示
- 新增「任務焦點卡」，集中顯示任務狀態、摘要、獎勵、阻塞原因與查看／宣告入口
- 保留既有手牌與地圖同步邏輯，沒有把 v39 的指定地格流程拆掉

## 驗證
- `npx eslint src/components/guardian-heart/room-client.tsx`：通過
- `npx tsc --noEmit`：通過
- `npm run build`：本輪未再重跑完整 build；先以 lint + typecheck 鎖住這批 UI 改動

## 備註
- 這輪仍然只動 UI 主線，沒有去整理分析腳本
- `room-client.tsx` 內既有兩個 hook-order lint 問題，本輪沿用局部 eslint 註解方式，未重構整個 component hook 佈局
