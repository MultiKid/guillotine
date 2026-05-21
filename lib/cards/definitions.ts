import type { BaseCard } from "@/lib/game/types";

export type CardDefinition<TCard extends BaseCard> = TCard & {
  quantity: number;
};

export function getDefinitionCount<TCard extends BaseCard>(definitions: CardDefinition<TCard>[]): number {
  return definitions.reduce((total, card) => total + card.quantity, 0);
}
