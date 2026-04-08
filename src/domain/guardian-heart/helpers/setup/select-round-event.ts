import type { EventState, GameSnapshot, RoomConfig } from "@/domain/guardian-heart/types/game";
import { MINIMAL_EVENTS } from "@/domain/guardian-heart/seeds/events/minimal-events";
import { EVENT_POOL_PROFILE_MAP } from "@/domain/guardian-heart/seeds/events/event-pool-profiles";

const EVENT_MAP = Object.fromEntries(MINIMAL_EVENTS.map((event) => [event.cardId, event]));

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function buildEventDeck(roomConfig: RoomConfig): string[] {
  const profile = EVENT_POOL_PROFILE_MAP[roomConfig.eventPoolProfileId ?? "first_round_full_8"] ?? EVENT_POOL_PROFILE_MAP.first_round_full_8;
  const eventIds = profile.cardIds.filter((cardId) => EVENT_MAP[cardId]);
  return shuffle(eventIds);
}

function materializeEvent(cardId: string, round: number): EventState {
  const base = EVENT_MAP[cardId];
  return {
    ...structuredClone(base),
    contributions: [],
    revealedAtRound: round,
  };
}

export function drawRoundEvent(snapshot: GameSnapshot): EventState | null {
  if (snapshot.eventDeck.length === 0) {
    if (snapshot.eventDiscardPile.length === 0) return null;
    snapshot.eventDeck = shuffle(snapshot.eventDiscardPile);
    snapshot.eventDiscardPile = [];
  }

  const cardId = snapshot.eventDeck.shift() ?? null;
  if (!cardId) return null;
  return materializeEvent(cardId, snapshot.round);
}
