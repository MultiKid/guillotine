"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle, selectedNobleColorStyle } from "@/lib/cards/nobleColors";
import { getNoblePointText } from "@/lib/game/scoring";
import type { ValidActionTarget } from "@/lib/game/effects";
import type { ActionEffectKey, ActionTarget, CardInstance, CardInstanceId, NobleCard } from "@/lib/game/types";
import type { PointerEvent } from "react";

type NobleLineProps = {
  hiddenNobleCardIds?: CardInstanceId[];
  isShuffling?: boolean;
  nobles: CardInstance<NobleCard>[];
  validTargets?: ValidActionTarget[];
  selectedNobleTargetId?: CardInstanceId;
  selectedActionEffectKey?: ActionEffectKey;
  reorderDraftIds?: CardInstanceId[];
  onPlayTarget?: (target: ActionTarget) => void;
  onPreviewCard?: (card: NobleCard) => void;
  onReorderDraftChange?: (instanceIds: CardInstanceId[]) => void;
  onSelectNobleTarget?: (instanceId: CardInstanceId) => void;
};

export function NobleLine({
  hiddenNobleCardIds = [],
  isShuffling = false,
  nobles,
  validTargets = [],
  selectedNobleTargetId,
  selectedActionEffectKey,
  reorderDraftIds,
  onPlayTarget,
  onPreviewCard,
  onReorderDraftChange,
  onSelectNobleTarget,
}: NobleLineProps) {
  const cardRefs = useRef(new Map<CardInstanceId, HTMLDivElement>());
  const previousRectsRef = useRef(new Map<CardInstanceId, DOMRect>());
  const [dragState, setDragState] = useState<{
    currentX: number;
    instanceId: CardInstanceId;
    slotWidth: number;
    startX: number;
  }>();
  const isReorderMode = selectedActionEffectKey === "opinionatedGuards";
  const movementTargets = validTargets.filter(isLineMovementTarget);
  const movementTargetIds = new Set(movementTargets.map((target) => getTargetNobleId(target)).filter(Boolean));
  const legalReorderIds = isReorderMode
    ? validTargets
        .filter((target) => target.target.type === "noble" && typeof target.fromPosition === "number" && typeof target.toPosition !== "number")
        .sort((first, second) => (first.fromPosition ?? 0) - (second.fromPosition ?? 0))
        .flatMap((target) => (target.target.type === "noble" ? [target.target.instanceId] : []))
    : [];
  const reorderIds = reorderDraftIds && reorderDraftIds.length > 0 ? reorderDraftIds : legalReorderIds;
  const reorderTargetIds = new Set(reorderIds);
  const hiddenNobleIds = new Set(hiddenNobleCardIds);
  const simpleNobleTargetById = new Map(
    validTargets.flatMap((target) =>
      !isReorderMode &&
      target.target.type === "noble" &&
      typeof target.toPosition !== "number" &&
      !isLineMovementTarget(target)
        ? [[target.target.instanceId, target]]
        : [],
    ),
  );
  const selectedLandingTargets = selectedNobleTargetId
    ? movementTargets.filter((target) => getTargetNobleId(target) === selectedNobleTargetId)
    : [];
  const landingByPosition = new Map(selectedLandingTargets.map((target) => [target.toPosition, target]));
  const highlightedNobleIds = new Set(
    validTargets
      .filter((target) => !isLineMovementTarget(target))
      .map((target) => ("instanceId" in target.target ? target.target.instanceId : "")),
  );

  useLayoutEffect(() => {
    const nextRects = new Map<CardInstanceId, DOMRect>();

    cardRefs.current.forEach((element, instanceId) => {
      const nextRect = element.getBoundingClientRect();
      const previousRect = previousRectsRef.current.get(instanceId);
      nextRects.set(instanceId, nextRect);

      if (!previousRect || dragState?.instanceId === instanceId) {
        return;
      }

      const x = previousRect.left - nextRect.left;
      // Only animate horizontal line movement. Vertical differences can come from
      // nearby UI panels opening/closing and make the whole line appear to jump.
      const y = 0;

      if (Math.abs(x) > 1) {
        element.getAnimations().forEach((animation) => animation.cancel());
        element.style.transition = "none";
        element.style.transform = `translate(${x}px, ${y}px)`;
        void element.offsetWidth;
        window.requestAnimationFrame(() => {
          element.style.transition = "transform 260ms cubic-bezier(0.2, 0, 0.2, 1)";
          element.style.transform = "translate(0, 0)";
          window.setTimeout(() => {
            element.style.transition = "";
            element.style.transform = "";
          }, 280);
        });
      }
    });

    previousRectsRef.current = nextRects;
  }, [nobles, dragState?.instanceId]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Noble Line</h2>
        <span className="text-sm text-stone-600">Front noble is on the left</span>
      </div>
      <div className={`mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-12 ${isShuffling ? "animate-[lineShuffle_700ms_ease-in-out]" : ""}`}>
        {nobles.map((noble, index) => {
          const position = index + 1;
          const isMovementTarget = movementTargetIds.has(noble.instanceId);
          const isReorderTarget = reorderTargetIds.has(noble.instanceId);
          const simpleNobleTarget = simpleNobleTargetById.get(noble.instanceId);
          const landingTarget = landingByPosition.get(position);
          const isSelectedMovementTarget = selectedNobleTargetId === noble.instanceId;
          const isDragged = dragState?.instanceId === noble.instanceId;
          const isHiddenForFlight = hiddenNobleIds.has(noble.instanceId);
          const currentDragIndex = dragState ? reorderIds.indexOf(dragState.instanceId) : -1;
          const dragDelta = dragState ? dragState.currentX - dragState.startX : 0;
          const swapThreshold = dragState ? dragState.slotWidth * 0.75 : 0;
          const clampedDragDelta =
            dragState && isDragged
              ? clamp(
                  dragDelta,
                  currentDragIndex <= 0 ? 0 : -swapThreshold,
                  currentDragIndex >= reorderIds.length - 1 ? 0 : swapThreshold,
                )
              : 0;
          const isValidTarget = highlightedNobleIds.has(noble.instanceId) || isMovementTarget || Boolean(landingTarget) || isReorderTarget || Boolean(simpleNobleTarget);
          const colorStyle = isValidTarget ? selectedNobleColorStyle : getNobleColorStyle(noble.card.colorCategory);
          const transform = isDragged && clampedDragDelta ? `translateX(${clampedDragDelta}px)` : undefined;
          const hasActiveSelectionMode = validTargets.length > 0 || Boolean(selectedActionEffectKey);
          const canPreviewDirectly = !hasActiveSelectionMode && !isHiddenForFlight;

          return (
            <div
              className={`min-h-28 rounded-md border p-2 ${
                isReorderMode
                  ? "transition-[background-color,border-color,box-shadow] duration-200"
                  : "transition-[background-color,border-color,box-shadow,transform] duration-200 hover:scale-125 hover:z-30"
              } ${
                isReorderTarget ? "cursor-grab touch-none select-none active:cursor-grabbing" : ""
              } ${isHiddenForFlight ? "pointer-events-none opacity-0" : ""} ${colorStyle}`}
              data-noble-card-id={noble.instanceId}
              data-noble-line-card="true"
              key={noble.instanceId}
              ref={(element) => {
                if (element) {
                  cardRefs.current.set(noble.instanceId, element);
                } else {
                  cardRefs.current.delete(noble.instanceId);
                }
              }}
              onPointerCancel={() => setDragState(undefined)}
              onPointerDown={(event) => {
                if (!isReorderTarget) {
                  return;
                }

                const bounds = event.currentTarget.getBoundingClientRect();
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragState({
                  currentX: event.clientX,
                  instanceId: noble.instanceId,
                  slotWidth: bounds.width + 8,
                  startX: event.clientX,
                });
              }}
              onPointerMove={(event) => {
                if (dragState?.instanceId !== noble.instanceId) {
                  return;
                }

                event.preventDefault();
                setDragState((current) => {
                  if (!current) {
                    return current;
                  }

                  const currentIndex = reorderIds.indexOf(current.instanceId);

                  if (currentIndex < 0) {
                    return { ...current, currentX: event.clientX };
                  }

                  const delta = event.clientX - current.startX;
                  const threshold = current.slotWidth * 0.75;
                  const shouldMoveLeft = delta <= -threshold && currentIndex > 0;
                  const shouldMoveRight = delta >= threshold && currentIndex < reorderIds.length - 1;

                  if (!shouldMoveLeft && !shouldMoveRight) {
                    return { ...current, currentX: event.clientX };
                  }

                  const targetIndex = currentIndex + (shouldMoveLeft ? -1 : 1);
                  const nextOrder = [...reorderIds];
                  const [draggedId] = nextOrder.splice(currentIndex, 1);
                  nextOrder.splice(targetIndex, 0, draggedId);
                  onReorderDraftChange?.(nextOrder);

                  return {
                    ...current,
                    currentX: event.clientX,
                    startX: current.startX + (shouldMoveLeft ? -current.slotWidth : current.slotWidth),
                  };
                });
              }}
              onPointerUp={(event) => {
                if (dragState?.instanceId !== noble.instanceId) {
                  return;
                }

                event.preventDefault();
                setDragState(undefined);
                }}
              style={{
                transform,
                zIndex: isDragged ? 20 : undefined,
              }}
            >
              <div className="text-[10px] font-semibold uppercase text-stone-500">{position}</div>
              <button
                className={`mt-1 block w-full rounded-md text-left transition ${
                  isMovementTarget || landingTarget || simpleNobleTarget || isReorderTarget || canPreviewDirectly
                    ? isReorderTarget
                      ? "cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-amber-500"
                      : "cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
                    : "cursor-default"
                }`}
                disabled={!isMovementTarget && !landingTarget && !simpleNobleTarget && !isReorderTarget && !canPreviewDirectly}
                onClick={() => {
                  if (isReorderTarget) {
                    return;
                  }

                  if (landingTarget) {
                    onPlayTarget?.(landingTarget.target);
                    return;
                  }

                  if (simpleNobleTarget) {
                    onPlayTarget?.(simpleNobleTarget.target);
                    return;
                  }

                  if (isMovementTarget) {
                    onSelectNobleTarget?.(noble.instanceId);
                    return;
                  }

                  if (canPreviewDirectly) {
                    onPreviewCard?.(noble.card);
                  }
                }}
                type="button"
              >
                <CardImage
                  alt={noble.card.name}
                  imageClassName={`aspect-[5/7] border shadow-sm ${
                    isSelectedMovementTarget ? "border-amber-700 ring-2 ring-amber-500" : "border-stone-200"
                  }`}
                  imagePath={noble.card.imagePath}
                >
                  <div className="min-h-20 rounded-md bg-white/60 p-2">
                    <h3 className="break-words text-sm font-semibold leading-tight text-stone-950">{noble.card.name}</h3>
                    <p className="mt-1 text-xs text-stone-700">{getNoblePointText(noble)} pts</p>
                  </div>
                </CardImage>
              </button>
              {isMovementTarget && !selectedNobleTargetId ? <p className="mt-2 text-xs font-semibold text-amber-800">Choose noble</p> : null}
              {simpleNobleTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Choose noble</p> : null}
              {isReorderTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Drag horizontally</p> : null}
              {isSelectedMovementTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Selected</p> : null}
              {landingTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Move here</p> : null}
            </div>
          );
        })}
        {nobles.length === 0 ? <p className="text-sm text-stone-600">No nobles remain.</p> : null}
      </div>
    </Card>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isLineMovementTarget(target: ValidActionTarget): boolean {
  return (
    (target.target.type === "move-noble" || target.target.type === "noble") &&
    typeof target.fromPosition === "number" &&
    typeof target.toPosition === "number"
  );
}

function getTargetNobleId(target: ValidActionTarget): CardInstanceId | undefined {
  if (target.target.type === "move-noble" || target.target.type === "noble") {
    return target.target.instanceId;
  }

  return undefined;
}
