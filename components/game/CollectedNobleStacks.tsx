"use client";

import { useState } from "react";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import type { ActionCard, CardInstance, NobleCard, NobleColorCategory } from "@/lib/game/types";
import type { MouseEvent } from "react";

type CollectedNobleStacksProps = {
  nobles: CardInstance<NobleCard>[];
  cardWidth?: number;
  maxCardsPerStack?: number;
  offset?: number;
  onPreviewCard?: (card: NobleCard) => void;
};

type InFrontActionStackProps = {
  actions: CardInstance<ActionCard>[];
  cardWidth?: number;
  maxCardsPerStack?: number;
  offset?: number;
  selectedActionId?: string;
  onCardClick?: (action: CardInstance<ActionCard>) => void;
};

const nobleColorOrder: NobleColorCategory[] = ["blue", "red", "green", "purple", "gray"];

const nobleColorLabels: Record<NobleColorCategory, string> = {
  blue: "Blue",
  red: "Red",
  green: "Green",
  purple: "Purple",
  gray: "Gray",
};

export function CollectedNobleStacks({
  nobles,
  cardWidth = 112,
  maxCardsPerStack,
  offset = 43,
  onPreviewCard,
}: CollectedNobleStacksProps) {
  const groupedNobles = nobleColorOrder
    .map((colorCategory) => ({
      colorCategory,
      nobles: nobles.filter((noble) => noble.card.colorCategory === colorCategory),
    }))
    .filter((group) => group.nobles.length > 0);

  if (groupedNobles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      {groupedNobles.map((group) => (
        <section className="min-w-28" key={group.colorCategory}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {nobleColorLabels[group.colorCategory]}
          </p>
          <div className="flex items-start gap-3">
            {chunkCards(group.nobles, maxCardsPerStack ?? Math.max(group.nobles.length, 1)).map((stack, stackIndex) => (
              <CardStack
                cardWidth={cardWidth}
                cards={stack}
                key={`${group.colorCategory}-${stackIndex}`}
                maxCardsForHeight={maxCardsPerStack ?? stack.length}
                offset={offset}
                renderCard={(noble) => (
                  <div
                    className={`rounded-md border p-1 text-left shadow-sm ${getNobleColorStyle(noble.card.colorCategory)}`}
                  >
                    <CardImage
                      alt={noble.card.name}
                      imageClassName="aspect-[5/7] border border-stone-200"
                      imagePath={noble.card.imagePath}
                    >
                      <div className="min-h-12 rounded bg-white/60 p-1 text-xs">
                        <span className="font-semibold">{noble.card.name}</span>
                      </div>
                    </CardImage>
                  </div>
                )}
                onCardClick={(noble) => onPreviewCard?.(noble.card)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function InFrontActionStack({
  actions,
  cardWidth = 112,
  maxCardsPerStack,
  offset = 43,
  selectedActionId,
  onCardClick,
}: InFrontActionStackProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="min-w-28">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Actions</p>
      <div className="flex items-start gap-3">
        {chunkCards(actions, maxCardsPerStack ?? Math.max(actions.length, 1)).map((stack, stackIndex) => (
          <CardStack
            cardWidth={cardWidth}
            cards={stack}
            key={`actions-${stackIndex}`}
            maxCardsForHeight={maxCardsPerStack ?? stack.length}
            offset={offset}
            renderCard={(action) => {
              const isSelected = selectedActionId === action.instanceId;

              return (
                <div
                  className={`rounded-md border p-1 text-left shadow-sm ${
                    isSelected ? "border-amber-600 bg-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.18)]" : "border-amber-300 bg-amber-50"
                  }`}
                >
                  <CardImage
                    alt={action.card.name}
                    imageClassName="aspect-[5/7] border border-amber-200"
                    imagePath={action.card.imagePath}
                  >
                    <div className="min-h-12 rounded bg-white/60 p-1 text-xs">
                      <span className="font-semibold">{action.card.name}</span>
                    </div>
                  </CardImage>
                </div>
              );
            }}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </section>
  );
}

type CardStackProps<TCard> = {
  cards: TCard[];
  cardWidth: number;
  maxCardsForHeight: number;
  offset: number;
  renderCard: (card: TCard) => React.ReactNode;
  onCardClick?: (card: TCard) => void;
};

function CardStack<TCard>({
  cards,
  cardWidth,
  maxCardsForHeight,
  offset,
  renderCard,
  onCardClick,
}: CardStackProps<TCard>) {
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  const cardHeight = cardWidth * 1.4;
  const revealShift = Math.max(cardHeight - offset + 12, 0);
  const stackHeight = cardHeight + offset * (Math.max(maxCardsForHeight, 1) - 1) + revealShift;

  function updateHoveredCard(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - bounds.top;
    const nextIndex = Math.min(Math.max(Math.floor(y / offset), 0), cards.length - 1);

    setHoveredIndex(nextIndex);
  }

  function clickHoveredCard() {
    if (hoveredIndex === undefined) {
      return;
    }

    onCardClick?.(cards[hoveredIndex]);
  }

  return (
    <div
      className="relative cursor-pointer"
      onClick={clickHoveredCard}
      onMouseLeave={() => setHoveredIndex(undefined)}
      onMouseMove={updateHoveredCard}
      style={{
        height: `${stackHeight}px`,
        width: `${cardWidth}px`,
      }}
    >
      {cards.map((card, index) => {
        const isHovered = hoveredIndex === index;
        const shouldFade = hoveredIndex !== undefined && !isHovered;
        const shouldShiftDown = hoveredIndex !== undefined && index > hoveredIndex;

        return (
          <div
            className="pointer-events-none absolute left-0 transition-[opacity,transform] duration-150"
            key={getStackCardKey(card, index)}
            style={{
              opacity: shouldFade ? 0.16 : 1,
              top: `${index * offset}px`,
              transform: `translateY(${shouldShiftDown ? revealShift : 0}px)`,
              width: `${cardWidth}px`,
              zIndex: isHovered ? cards.length + 2 : index + 1,
            }}
          >
            {renderCard(card)}
          </div>
        );
      })}
    </div>
  );
}

function chunkCards<TCard>(cards: TCard[], chunkSize: number): TCard[][] {
  const chunks: TCard[][] = [];

  for (let index = 0; index < cards.length; index += chunkSize) {
    chunks.push(cards.slice(index, index + chunkSize));
  }

  return chunks;
}

function getStackCardKey<TCard>(card: TCard, fallbackIndex: number): string {
  if (typeof card === "object" && card !== null && "instanceId" in card && typeof card.instanceId === "string") {
    return card.instanceId;
  }

  return String(fallbackIndex);
}
