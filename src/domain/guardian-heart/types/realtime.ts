import type { GamePhase, SeatId } from "@/domain/guardian-heart/types/game";

export const ROOM_STATE_UPDATED_EVENT = "state_updated" as const;

export function getRoomChannelName(roomCode: string) {
  return `guardian-heart-room-${roomCode}`;
}

export type StateUpdatedPayload = {
  roomId: string;
  roomCode: string;
  version: number;
  roomRevision: number;
  phase: GamePhase;
  round: number;
  activeSeat: SeatId | null;
  blockingWindowKind: "discard" | "loss" | "ability" | null;
  updatedAt: string;
};

export function buildStateUpdatedPayload(params: {
  roomId: string;
  roomCode: string;
  version: number;
  roomRevision: number;
  phase: GamePhase;
  round: number;
  activeSeat: SeatId | null;
  blockingWindowKind: "discard" | "loss" | "ability" | null;
  updatedAt: string;
}): StateUpdatedPayload {
  return {
    roomId: params.roomId,
    roomCode: params.roomCode,
    version: params.version,
    roomRevision: params.roomRevision,
    phase: params.phase,
    round: params.round,
    activeSeat: params.activeSeat,
    blockingWindowKind: params.blockingWindowKind,
    updatedAt: params.updatedAt,
  };
}
