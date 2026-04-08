# UI v52｜桌機第一優先收斂 pass

## 這輪重點
1. 右欄桌機快捷檢驗，改造成更像正式操作的主控面。
2. 主畫面工作區在 xl 改為 2 欄、2xl 才展成 4 欄，降低筆電寬度下的破碎感。
3. 把玩家列 → 地圖 → 指令台的同步資訊，往右欄集中成可讀的焦點承接區。

## 本輪完成
- 新增 `desktopControlSurfaceCards`
  - 事件主控
  - 任務主控
  - 手牌主控
  - 流程主控
- 每張主控卡都有
  - 狀態文字
  - 摘要
  - 兩個直接操作按鈕
- 新增 `desktopFocusSyncCards`
  - 聚焦隊友
  - 聚焦任務
  - 聚焦手牌
- 保留既有 `desktopExpansionCards`
  - 事件池 profile
  - 任務池 profile
  - 行動牌池 profile
- 將桌機工作區格線改為
  - `xl:grid-cols-2`
  - `2xl:grid-cols-4`

## 驗證
- `npx tsc --noEmit`：通過
- `npx eslint src/components/guardian-heart/room-client.tsx src/components/guardian-heart/guardian-heart-map-stage.tsx`：通過
- `npm run build`：通過

## 影響
這輪之後，右欄不再偏向「檢驗說明面板」，而更像真正的桌機控制台；同時保留後續新增事件卡、任務卡、行動卡的承接位。
