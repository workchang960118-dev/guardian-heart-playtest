# Guardian Heart MVP｜Regression Checkpoints

這份文件用來補足 smoke test 之外的「規則可信度回歸檢查」。

## 每次修規則後至少回看

1. **事件立即效果**
   - start_round 後是否正確建立 loss queue
   - 陪伴標記是否仍可介入

2. **巡林探路者免費移動**
   - 進入 / 離開風險地格時是否不扣 AP
   - 一輪僅 1 次是否仍成立

3. **商會護衛轉移**
   - 原目標 SR 損失是否只少 1 點，不是整筆消失
   - 護衛是否承受那 1 點

4. **事件牌庫**
   - 每局是否先 shuffle 再抽
   - 牌庫空時是否洗回 discard

5. **營火流程**
   - resolve_event → resolve_losses → apply_pressure → state_check
   - observer / newcomer guide 是否能看懂目前子步驟

6. **simulation compare**
   - 固定 preset、runCount、seed 後結果是否可重現
   - 與外部 benchmark 共同欄位是否仍可對齊

## 建議固定比較組

- preset: `cap_mode_baseline`
- runCount: `500`
- seed: 固定單一值（例如 `20260326`）

## 回歸檢查最小輸出

- 是否通過：pass / partial / fail
- 污染範圍：rules / ui / observer / logs / simulation
- 是否阻斷 compare：yes / no
