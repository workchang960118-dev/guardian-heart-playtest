# Guardian Heart Multiplayer MVP｜Smoke Test Checklist（7A）

這份文件把多人同步 MVP 的最小 smoke test 腳本正式放進 repo，目的只有三個：

1. 從同一份專案內文件直接跑完整測試
2. 固定記錄 pass / partial / fail
3. 讓後續 7B 缺口補單、8 階段最終驗收與 AI 模擬前置檢查有同一份基準

## 執行前準備

至少準備三個視角：
- host
- player
- observer

建議：
- 一個正常瀏覽器視窗（host）
- 一個無痕視窗或第二個瀏覽器（player）
- 第三個視窗或裝置（observer）

## 記錄格式

每一個節點都記：

- 結果：pass / partial / fail
- server：ok / fail
- client：ok / fail
- observer：ok / fail
- 中文 UI / guide / log：ok / fail
- authoritative data：ok / fail
- 備註

## 總腳本

### A. 入口與同步安全
1. create room
2. host bootstrap
3. observer bootstrap
4. observer action block
5. forged seat block

### B. Lobby flow
6. assign_role
7. non-host / observer cannot assign_role
8. start_game
9. missing role cannot start_game

### C. Round start
10. start_round
11. non-host / observer cannot start_round
12. currentEvent rendered
13. per-round reset visible

### D. Action phase
14. move
15. use station / shelter
16. invest event
17. adjacent help
18. end_turn
19. end_turn + over hand limit

### E. Blocking windows
20. discard_cards success
21. non-owner cannot discard
22. pending loss window opens
23. use_companion_token success
24. invalid companion cases
25. finalize_pending_loss success

### F. Campfire flow
26. declare_task
27. resolve_campfire starts
28. resolve_current_event
29. risk loss / pending loss queue
30. pressure / milestone visible
31. back to crisis or gameover

## 第一輪阻斷 fail 彙整格式

- 節點編號：
- 失敗現象：
- 是否阻斷主鏈：yes / no
- 推定斷點檔案：
- 污染範圍：server / client / observer / UI / data
- 優先級：P0 / P1 / P2
- 是否阻斷 AI 模擬基線：yes / no

## 第一輪完成後的判定

### 可以進 7B 缺口補單
- 已跑完整條鏈
- 已列出所有 fail
- 已分出 P0 / P1 / P2

### 可以進 AI 模擬前置驗證
只有當：
- A–F 至少完整通過 1 次
- 沒有 P0 阻斷點
- snapshot / version / log 沒有污染
