# UI v21｜營火改為半自動確認流

## 這一包做了什麼
- 取消房主端自動 `start_round` / 自動 `resolve_campfire`。
- 營火改為半自動：
  1. 事件摘要
  2. 任務宣告窗口
  3. 損失逐筆處理
  4. 狀態確認
  5. 全員 ready 後，由房主推進到下一輪
- 任務仍維持在營火主動宣告，沒有前移到玩家回合即時完成。
- 損失視窗仍保留即時反應，但結束後不再直接快轉回危機，而是進狀態確認窗口。

## 主要技術變更
- `PendingCampfireResolution` 新增：
  - `readySeatIds`
  - `nextPhaseAfterConfirm`
  - `nextStatusAfterConfirm`
- 新增 action：
  - `set_campfire_ready`
  - `advance_campfire`
- `resolve_campfire` 不再一鍵跑完整個營火，而是只建立事件摘要與待處理損失隊列。

## 目前互動口徑
- 玩家各自按「我已確認」。
- 房主只有在所有真人玩家都 ready 後，才能按下推進。
- 若有 pending loss，仍會先逐筆完成損失視窗。
- 狀態確認結束後，不會自動翻下一輪；會停在 ready check，等房主開始下一輪。
