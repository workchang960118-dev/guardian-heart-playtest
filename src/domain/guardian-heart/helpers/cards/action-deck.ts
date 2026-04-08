import { ACTION_DECK_PROFILE_MAP } from "@/domain/guardian-heart/seeds/cards/action-deck-profiles";
import { ACTION_CARD_DEFINITION_MAP } from "@/domain/guardian-heart/seeds/cards/minimal-action-cards";
import type { GameSnapshot, PlayerState, RoomConfig } from "@/domain/guardian-heart/types/game";

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function isCardEnabledByConfig(roomConfig: RoomConfig, cardId: string): boolean {
  if (roomConfig.cardToggles[cardId] === false) return false;
  if (cardId === "card_respond_together" && !roomConfig.experimentalRuleToggles.respondTogetherEnabled) return false;
  return true;
}

export function buildActionDeck(roomConfig: RoomConfig): string[] {
  const profile = ACTION_DECK_PROFILE_MAP[roomConfig.actionDeckProfileId] ?? ACTION_DECK_PROFILE_MAP.core_baseline;
  const deck: string[] = [];

  for (const [cardId, count] of Object.entries(profile.cardCounts)) {
    if (!ACTION_CARD_DEFINITION_MAP[cardId]) continue;
    if (!isCardEnabledByConfig(roomConfig, cardId)) continue;
    for (let i = 0; i < count; i += 1) deck.push(cardId);
  }

  return shuffle(deck);
}

function isCardEnabled(snapshot: GameSnapshot, cardId: string): boolean {
  return isCardEnabledByConfig(snapshot.roomConfig, cardId);
}

export function normalizeCardPoolsAgainstToggles(snapshot: GameSnapshot) {
  snapshot.actionDeck = snapshot.actionDeck.filter((cardId) => isCardEnabled(snapshot, cardId));
  snapshot.discardPile = snapshot.discardPile.filter((cardId) => isCardEnabled(snapshot, cardId));
}

export function reshuffleDiscardIntoActionDeck(snapshot: GameSnapshot): boolean {
  normalizeCardPoolsAgainstToggles(snapshot);
  if (snapshot.actionDeck.length > 0 || snapshot.discardPile.length === 0) return false;
  snapshot.actionDeck = shuffle(snapshot.discardPile);
  snapshot.discardPile = [];
  return true;
}

export function drawActionCard(snapshot: GameSnapshot, player: PlayerState): string | null {
  normalizeCardPoolsAgainstToggles(snapshot);
  if (player.handCardIds.length >= 3) return null;
  reshuffleDiscardIntoActionDeck(snapshot);
  const drawn = snapshot.actionDeck.shift() ?? null;
  if (drawn) player.handCardIds.push(drawn);
  return drawn;
}
