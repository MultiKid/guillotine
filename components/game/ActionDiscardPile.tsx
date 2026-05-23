import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import type { ActionCard, BaseCard, CardInstance } from "@/lib/game/types";

type ActionDiscardPileProps = {
  cards: CardInstance<ActionCard>[];
  onPreviewCard?: (card: BaseCard) => void;
};

export function ActionDiscardPile({ cards, onPreviewCard }: ActionDiscardPileProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  const cardWidth = 120;
  const cardOverlap = cardWidth / 2;
  const cardStep = cardWidth - cardOverlap;
  const spreadOffset = cardOverlap + 8;
  const stackWidth = cards.length > 0 ? cardWidth + (cards.length - 1) * cardStep : 0;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Action Discard Pile</h2>
        <span className="text-sm text-stone-600">{cards.length} cards</span>
      </div>
      <div className="mt-3 min-h-48 overflow-x-auto pb-3">
        <div
          className="relative min-h-44"
          onMouseLeave={() => setHoveredIndex(undefined)}
          style={{
            width: Math.max(stackWidth + spreadOffset, cardWidth),
          }}
        >
          {cards.map((action, index) => {
            const shiftForHover =
              hoveredIndex !== undefined && index < hoveredIndex
                ? -spreadOffset
                : 0;

            return (
              <div
                className="absolute top-0"
                key={action.instanceId}
                onMouseEnter={() => setHoveredIndex(index)}
                style={{
                  height: 180,
                  left: index * cardStep,
                  width: cardStep,
                  zIndex: cards.length - index,
                }}
              >
                <div
                  className="transition-transform duration-200 ease-out"
                  style={{
                    transform: `translateX(${shiftForHover}px)`,
                    width: cardWidth,
                  }}
                >
                  <button
                    className="block w-full rounded-md border border-amber-300 bg-amber-50/45 p-1 shadow-sm transition hover:border-amber-600 hover:bg-amber-100/60 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    onClick={() => onPreviewCard?.(action.card)}
                    type="button"
                  >
                    <CardImage
                      alt={action.card.name}
                      imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
                      imagePath={action.card.imagePath}
                    >
                      <div className="min-h-20 rounded-md bg-white/60 p-1">
                        <h3 className="text-xs font-semibold leading-tight">{action.card.name}</h3>
                      </div>
                    </CardImage>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {cards.length === 0 ? <p className="text-sm text-stone-600">No action cards have been discarded yet.</p> : null}
      </div>
    </Card>
  );
}
