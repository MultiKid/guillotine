import type { CardDefinition } from "@/lib/cards/definitions";
import type { BaseCard, CardInstance, DeckState } from "@/lib/game/types";

export function createEmptyDeck<TCard extends BaseCard>(): DeckState<TCard> {
  return {
    drawPile: [],
    discardPile: [],
  };
}

export function shuffleDeck<TCard extends BaseCard>(
  cards: CardInstance<TCard>[],
): CardInstance<TCard>[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function drawCard<TCard extends BaseCard>(
  deck: DeckState<TCard>,
): { deck: DeckState<TCard>; card?: CardInstance<TCard> } {
  const [card, ...remaining] = deck.drawPile;

  return {
    deck: {
      ...deck,
      drawPile: remaining,
    },
    card,
  };
}

export function createCardInstances<TCard extends BaseCard>(
  cards: TCard[],
  copies: number,
): CardInstance<TCard>[] {
  return Array.from({ length: copies }).flatMap((_, copyIndex) =>
    cards.map((card) => ({
      instanceId: `${card.id}-${copyIndex + 1}`,
      cardId: card.id,
      card,
    })),
  );
}

export function createCardInstancesFromDefinitions<TCard extends BaseCard>(
  definitions: CardDefinition<TCard>[],
): CardInstance<TCard>[] {
  return definitions.flatMap(({ quantity, ...card }) =>
    Array.from({ length: quantity }, (_, copyIndex) => ({
      instanceId: `${card.id}-${copyIndex + 1}`,
      cardId: card.id,
      card: card as unknown as TCard,
    })),
  );
}

