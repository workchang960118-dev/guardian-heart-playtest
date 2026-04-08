# Action Log 持久化（9B）

這一批把正式 action log 從僅存在 snapshot，往前推到：
- 可寫入 `room_action_logs` 資料表
- 可依 room / revision 拉出
- 可供後續 replay / AI simulation 使用

## 上線前要做
1. 執行 `supabase/migrations/0002_room_action_logs.sql`
2. 確認 `room_action_logs` 已建立
3. 再跑 MVP smoke test
