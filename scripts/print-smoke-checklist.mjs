const cases = [
  ["A1", "create room"],
  ["A2", "host bootstrap"],
  ["A3", "observer bootstrap"],
  ["A4", "observer action block"],
  ["A5", "forged seat block"],
  ["B1", "assign_role"],
  ["B2", "non-host / observer cannot assign_role"],
  ["B3", "start_game"],
  ["B4", "missing role cannot start_game"],
  ["C1", "start_round"],
  ["C2", "non-host / observer cannot start_round"],
  ["C3", "currentEvent rendered"],
  ["C4", "per-round reset visible"],
  ["D1", "move"],
  ["D2", "use station / shelter"],
  ["D3", "invest event"],
  ["D4", "adjacent help"],
  ["D5", "end_turn"],
  ["D6", "end_turn + over hand limit"],
  ["E1", "discard_cards success"],
  ["E2", "non-owner cannot discard"],
  ["E3", "pending loss window opens"],
  ["E4", "use_companion_token success"],
  ["E5", "invalid companion cases"],
  ["E6", "finalize_pending_loss"],
  ["F1", "declare_task"],
  ["F2", "resolve_campfire starts"],
  ["F3", "resolve_current_event"],
  ["F4", "risk loss / pending loss queue"],
  ["F5", "pressure / milestone visible"],
  ["F6", "back to crisis or gameover"],
];

console.log("Guardian Heart MVP｜Smoke Test Checklist");
console.log("====================================");
for (const [id, title] of cases) {
  console.log(`- ${id} ${title}`);
}
console.log("\n記錄欄位：結果 / server / client / observer / 中文UI-guide-log / authoritative data / 備註");
