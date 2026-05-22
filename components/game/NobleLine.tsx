"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle, selectedNobleColorStyle } from "@/lib/cards/nobleColors";
import { getNoblePointText } from "@/lib/game/scoring";
import type { ValidActionTarget } from "@/lib/game/effects";
import type { ActionEffectKey, ActionTarget, CardInstance, CardInstanceId, NobleCard } from "@/lib/game/types";
import type { PointerEvent } from "react";

type NobleLineProps = {
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
  const [dragState, setDragState] = useState<{
    currentX: number;
    instanceId: CardInstanceId;
    originIndex: number;
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

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Noble Line</h2>
        <span className="text-sm text-stone-600">Front noble is on the left</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-12">
        {nobles.map((noble, index) => {
          const position = index + 1;
          const isMovementTarget = movementTargetIds.has(noble.instanceId);
          const isReorderTarget = reorderTargetIds.has(noble.instanceId);
          const simpleNobleTarget = simpleNobleTargetById.get(noble.instanceId);
          const landingTarget = landingByPosition.get(position);
          const isSelectedMovementTarget = selectedNobleTargetId === noble.instanceId;
          const isDragged = dragState?.instanceId === noble.instanceId;
          const dragDelta = dragState ? dragState.currentX - dragState.startX : 0;
          const clampedDragDelta =
            dragState && isDragged
              ? clamp(
                  dragDelta,
                  -dragState.originIndex * dragState.slotWidth,
                  (reorderIds.length - 1 - dragState.originIndex) * dragState.slotWidth,
                )
              : 0;
          const isValidTarget = highlightedNobleIds.has(noble.instanceId) || isMovementTarget || Boolean(landingTarget) || isReorderTarget || Boolean(simpleNobleTarget);
          const colorStyle = isValidTarget ? selectedNobleColorStyle : getNobleColorStyle(noble.card.colorCategory);

          return (
            <div
              className={`min-h-28 rounded-md border p-2 transition-colors ${
                isReorderTarget ? "cursor-grab touch-none select-none active:cursor-grabbing" : ""
              } ${colorStyle}`}
              key={noble.instanceId}
              onPointerCancel={() => setDragState(undefined)}
              onPointerDown={(event) => {
                if (!isReorderTarget) {
                  return;
                }

                const originIndex = reorderIds.indexOf(noble.instanceId);
                const bounds = event.currentTarget.getBoundingClientRect();
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragState({
                  currentX: event.clientX,
                  instanceId: noble.instanceId,
                  originIndex,
                  slotWidth: bounds.width + 8,
                  startX: event.clientX,
                });
              }}
              onPointerMove={(event) => {
                if (dragState?.instanceId !== noble.instanceId) {
                  return;
                }

                event.preventDefault();
                setDragState((current) => current ? { ...current, currentX: event.clientX } : current);
              }}
              onPointerUp={(event) => {
                if (dragState?.instanceId !== noble.instanceId) {
                  return;
                }

                event.preventDefault();
                const delta = clamp(
                  event.clientX - dragState.startX,
                  -dragState.originIndex * dragState.slotWidth,
                  (reorderIds.length - 1 - dragState.originIndex) * dragState.slotWidth,
                );
                const targetIndex = clamp(
                  dragState.originIndex + Math.round(delta / dragState.slotWidth),
                  0,
                  reorderIds.length - 1,
                );
                  const nextOrder = [...reorderIds];
                  const [draggedId] = nextOrder.splice(dragState.originIndex, 1);
                  nextOrder.splice(targetIndex, 0, draggedId);

                  setDragState(undefined);

                  if (targetIndex !== dragState.originIndex) {
                    onReorderDraftChange?.(nextOrder);
                  }
                }}
              style={{
                transform: isDragged ? `translateX(${clampedDragDelta}px)` : undefined,
                zIndex: isDragged ? 20 : undefined,
              }}
            >
              <div className="text-[10px] font-semibold uppercase text-stone-500">Pos {position}</div>
              <button
                className={`mt-1 block w-full rounded-md text-left transition ${
                  isMovementTarget || landingTarget || simpleNobleTarget || isReorderTarget
                    ? isReorderTarget
                      ? "cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-amber-500"
                      : "cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
                    : "cursor-default"
                }`}
                disabled={!isMovementTarget && !landingTarget && !simpleNobleTarget && !isReorderTarget}
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
              {landingTarget ? (
                <button
                  className="mt-2 w-full rounded-md border border-amber-500 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-200"
                  onClick={() => onPlayTarget?.(landingTarget.target)}
                  type="button"
                >
                  Move here
                </button>
              ) : null}
              {!isMovementTarget && !landingTarget && !simpleNobleTarget && !isReorderTarget ? (
                <button
                  className="mt-2 text-xs font-semibold text-stone-500 hover:text-stone-900"
                  onClick={() => onPreviewCard?.(noble.card)}
                  type="button"
                >
                  Preview
                </button>
              ) : null}
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
