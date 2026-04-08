import { EventEmitter } from "node:events";
import type { StateUpdatedPayload } from "@/domain/guardian-heart/types/realtime";

type RoomRealtimeEvents = {
  state_updated: StateUpdatedPayload;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

function getStateUpdatedEventName(roomCode: string) {
  return `room:${roomCode}:state_updated`;
}

export function subscribeStateUpdated(params: {
  roomCode: string;
  onStateUpdated: (payload: StateUpdatedPayload) => void;
}) {
  const eventName = getStateUpdatedEventName(params.roomCode);
  const listener = (payload: RoomRealtimeEvents["state_updated"]) => params.onStateUpdated(payload);
  emitter.on(eventName, listener);
  return () => emitter.off(eventName, listener);
}

export function broadcastStateUpdated(payload: StateUpdatedPayload) {
  emitter.emit(getStateUpdatedEventName(payload.roomCode), payload);
}
