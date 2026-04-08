# ui-v59-desktop-final-rhythm-pass

本輪定位：桌機／筆電版最後一輪節奏收口。

## 本輪完成
- 將桌機主畫面上方兩塊摘要區改成共用的 section header + rail 呈現
  - 阻塞與續推
  - 主流程導引
- 新增共用桌機 UI helper：
  - `SurfaceSectionHeader`
  - `SurfacePillRow`
  - `SurfaceActionGrid`
- 桌機工作區四張卡改成統一的：
  - pills 排列
  - 兩欄 action grid
  - 強調主／次操作層級
- 右欄「桌機主控面」改成一致的 header / pills / action rail 語言
- 右欄四張主控卡改用一致的 pills + action grid 呈現
- overlay footer bar 按鈕區改成更穩的雙欄結構

## 本輪目的
- 壓平桌機版不同區塊之間的視覺語言
- 讓主畫面、右欄、全文視窗的操作層級更一致
- 讓桌機版更接近真正的控制台，而不是多塊樣式接近但仍略散的資訊面板

## 驗證
- `room-client.tsx`：TypeScript `transpileModule` 語法檢查通過
- `guardian-heart-map-stage.tsx`：TypeScript `transpileModule` 語法檢查通過
- 本輪未取得 full `tsc / eslint / build` pass，原因是容器在 `npm ci` 階段被 SIGTERM 中斷，無法裝起完整 Next / React 依賴
