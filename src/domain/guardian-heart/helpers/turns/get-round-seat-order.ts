import type { GameSnapshot, SeatId } from "@/domain/guardian-heart/types/game";

const SEAT_ORDER: SeatId[] = ["P1", "P2", "P3", "P4"];

export function getRoundSeatOrder(snapshot: GameSnapshot): SeatId[] {
  const joinedSeats = new Set(snapshot.players.map((player) => player.seatId));
  return SEAT_ORDER.filter((seatId) => joinedSeats.has(seatId));
}
