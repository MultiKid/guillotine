"use client";

import { useState } from "react";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import type { ActionCard, CardInstance, CardInstanceId, NobleCard, NobleColorCategory } from "@/lib/game/types";
import type { MouseEvent } from "react";

type CollectedNobleStacksProps = {
  nobles: CardInstance<NobleCard>[];
  cardWidth?: number;
  hiddenNobleIds?: CardInstanceId[];
  maxCardsPerStack?: number;
  offset?: number;
  ownerPlayerId?: string;
  onPreviewCard?: (card: NobleCard) => void;
};

type InFrontActionStackProps = {
  actions: CardInstance<ActionCard>[];
  cardWidth?: number;
  maxCardsPerStack?: number;
  offset?: number;
  selectedActionId?: string;
  canDiscardCallousGuards?: boolean;
  onCardClick?: (action: CardInstance<ActionCard>) => void;
  onDiscardCallousGuards?: (cardId: CardInstanceId) => void;
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
  hiddenNobleIds = [],
  maxCardsPerStack,
  offset = 43,
  ownerPlayerId,
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
        <section className="min-w-28" data-collected-noble-color={ownerPlayerId ? `${ownerPlayerId}-${group.colorCategory}` : undefined} key={group.colorCategory}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {nobleColorLabels[group.colorCategory]}
          </p>
          <div className="flex items-start gap-3">
            {chunkCards(group.nobles, maxCardsPerStack ?? Math.max(group.nobles.length, 1)).map((stack, stackIndex) => (
              <CardStack
                cardWidth={cardWidth}
                cards={stack}
                dataStackId={ownerPlayerId ? `${ownerPlayerId}-${group.colorCategory}-${stackIndex}` : undefined}
                key={`${group.colorCategory}-${stackIndex}`}
                maxCardsForHeight={maxCardsPerStack ?? stack.length}
                offset={offset}
                renderCard={(noble) => (
                  <div
                    className={`rounded-md border p-1 text-left shadow-sm ${
                      hiddenNobleIds.includes(noble.instanceId) ? "pointer-events-none opacity-0" : ""
                    } ${getNobleColorStyle(noble.card.colorCategory)}`}
                    data-collected-noble-id={noble.instanceId}
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
  canDiscardCallousGuards = false,
  onCardClick,
  onDiscardCallousGuards,
}: InFrontActionStackProps) {
  if (actions.length === 0) {
    return null;
  }

  const sortedActions = [...actions].sort((first, second) => {
    if (first.card.effectKey === "callousGuards" && second.card.effectKey !== "callousGuards") {
      return 1;
    }

    if (first.card.effectKey !== "callousGuards" && second.card.effectKey === "callousGuards") {
      return -1;
    }

    return 0;
  });

  return (
    <section className="min-w-28">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Actions</p>
      <div className="flex items-start gap-3">
        {chunkCards(sortedActions, maxCardsPerStack ?? Math.max(sortedActions.length, 1)).map((stack, stackIndex) => (
          <CardStack
            cardWidth={cardWidth}
            cards={stack}
            getCardZIndex={(action, index, baseZIndex) =>
              action.card.effectKey === "callousGuards" ? sortedActions.length + 4 : baseZIndex
            }
            key={`actions-${stackIndex}`}
            maxCardsForHeight={maxCardsPerStack ?? stack.length}
            offset={offset}
            renderCard={(action) => {
              const isSelected = selectedActionId === action.instanceId;

              return (
                <div className="relative">
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
                  {canDiscardCallousGuards && action.card.effectKey === "callousGuards" ? (
                    <button
                      aria-label="Discard Callous Guards"
                      className="pointer-events-auto absolute left-1/2 top-full flex h-7 w-10 -translate-x-1/2 items-center justify-center rounded-b-md border border-red-700 bg-red-600 text-white shadow-md transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDiscardCallousGuards?.(action.instanceId);
                      }}
                      type="button"
                    >
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="m6 6 1 15h10l1-15" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  ) : null}
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
  dataStackId?: string;
  maxCardsForHeight: number;
  offset: number;
  renderCard: (card: TCard) => React.ReactNode;
  getCardZIndex?: (card: TCard, index: number, baseZIndex: number) => number;
  onCardClick?: (card: TCard) => void;
};

function CardStack<TCard>({
  cards,
  cardWidth,
  dataStackId,
  maxCardsForHeight,
  offset,
  renderCard,
  getCardZIndex,
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
      data-collected-card-stack={dataStackId}
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
        const baseZIndex = isHovered ? cards.length + 2 : index + 1;

        return (
          <div
            className="absolute left-0 transition-[opacity,transform] duration-150"
            key={getStackCardKey(card, index)}
            style={{
              opacity: shouldFade ? 0.16 : 1,
              top: `${index * offset}px`,
              transform: `translateY(${shouldShiftDown ? revealShift : 0}px)`,
              width: `${cardWidth}px`,
              zIndex: getCardZIndex?.(card, index, baseZIndex) ?? baseZIndex,
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
