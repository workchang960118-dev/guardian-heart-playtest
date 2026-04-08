import type { GameSnapshot, PlayerState, SeatId } from "@/domain/guardian-heart/types/game";

const ALL_AI_CANDIDATE_SEATS: SeatId[] = ["P2", "P3", "P4"];

function buildAiPlayerState(params: { seatId: SeatId }): PlayerState {
  const { seatId } = params;
  return {
    seatId,
    displayName: `AI 補位 ${seatId}`,
    isAi: true,
    roleId: null,
    roleNameZh: null,
    currentSr: 0,
    currentSp: 0,
    remainingAp: 0,
    positionTileId: null,
    companionTokensRemaining: 0,
    handCardIds: [],
    roleAbilityUsesRemaining: 0,
    perRoundFlags: {
      hasInvestedEvent: false,
      hasAdjacentHelped: false,
    },
  };
}

export function syncAiSeatsInLobby(snapshot: GameSnapshot): void {
  const desiredAiSeats = new Set(snapshot.roomConfig.aiSeatIds);
  const humanPlayers = snapshot.players.filter((player) => !player.isAi || !ALL_AI_CANDIDATE_SEATS.includes(player.seatId));
  const aiPlayers = ALL_AI_CANDIDATE_SEATS
    .filter((seatId) => desiredAiSeats.has(seatId))
    .map((seatId) => {
      const existing = snapshot.players.find((player) => player.seatId === seatId);
      if (existing) {
        return {
          ...existing,
          isAi: true,
          displayName: existing.displayName?.trim() ? existing.displayName : `AI 補位 ${seatId}`,
        };
      }
      return buildAiPlayerState({ seatId });
    });

  snapshot.players = [...humanPlayers, ...aiPlayers].sort((a, b) => a.seatId.localeCompare(b.seatId));
}
