# UI v30｜任務浮窗 portal hotfix

這刀只修一件事：

- 任務浮窗改成掛到 `document.body` 的 fixed portal layer
- 不再留在任務列區塊內，避免被後方地圖與下方主畫面 stack / overflow 擋住
- 位置改用 viewport 座標計算，並在 resize / scroll 時重新定位

## 預期結果
- 任務浮窗應該會穩定浮在主畫面上層
- 不再被中央地圖蓋住
- hover 可預覽，click 可固定
