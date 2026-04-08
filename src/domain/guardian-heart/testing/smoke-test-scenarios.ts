export type SmokeTestLevel = "server" | "client" | "observer" | "ui" | "data";
export type SmokeTestResult = "pass" | "partial" | "fail";

export type SmokeTestCase = {
  id: string;
  phase: "A" | "B" | "C" | "D" | "E" | "F";
  titleZh: string;
  expectedChecks: SmokeTestLevel[];
};

export const SMOKE_TEST_CASES: SmokeTestCase[] = [
  { id: "A1", phase: "A", titleZh: "create room", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "A2", phase: "A", titleZh: "host bootstrap", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "A3", phase: "A", titleZh: "observer bootstrap", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "A4", phase: "A", titleZh: "observer action block", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "A5", phase: "A", titleZh: "forged seat block", expectedChecks: ["server", "client", "observer", "ui", "data"] },

  { id: "B1", phase: "B", titleZh: "assign_role", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "B2", phase: "B", titleZh: "non-host / observer cannot assign_role", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "B3", phase: "B", titleZh: "start_game", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "B4", phase: "B", titleZh: "missing role cannot start_game", expectedChecks: ["server", "client", "observer", "ui", "data"] },

  { id: "C1", phase: "C", titleZh: "start_round", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "C2", phase: "C", titleZh: "non-host / observer cannot start_round", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "C3", phase: "C", titleZh: "currentEvent rendered", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "C4", phase: "C", titleZh: "per-round reset visible", expectedChecks: ["server", "client", "observer", "ui", "data"] },

  { id: "D1", phase: "D", titleZh: "move", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "D2", phase: "D", titleZh: "use station / shelter", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "D3", phase: "D", titleZh: "invest event", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "D4", phase: "D", titleZh: "adjacent help", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "D5", phase: "D", titleZh: "end_turn", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "D6", phase: "D", titleZh: "end_turn + over hand limit", expectedChecks: ["server", "client", "observer", "ui", "data"] },

  { id: "E1", phase: "E", titleZh: "discard_cards success", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "E2", phase: "E", titleZh: "non-owner cannot discard", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "E3", phase: "E", titleZh: "pending loss window opens", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "E4", phase: "E", titleZh: "use_companion_token success", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "E5", phase: "E", titleZh: "invalid companion cases", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "E6", phase: "E", titleZh: "finalize_pending_loss", expectedChecks: ["server", "client", "observer", "ui", "data"] },

  { id: "F1", phase: "F", titleZh: "declare_task", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "F2", phase: "F", titleZh: "resolve_campfire starts", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "F3", phase: "F", titleZh: "resolve_current_event", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "F4", phase: "F", titleZh: "risk loss / pending loss queue", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "F5", phase: "F", titleZh: "pressure / milestone visible", expectedChecks: ["server", "client", "observer", "ui", "data"] },
  { id: "F6", phase: "F", titleZh: "back to crisis or gameover", expectedChecks: ["server", "client", "observer", "ui", "data"] },
];
