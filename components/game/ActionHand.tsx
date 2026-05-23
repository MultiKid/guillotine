import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import { actionEffectRequiresTarget } from "@/lib/game/effects";
import { getNoblePointText } from "@/lib/game/scoring";
import type { ValidActionTarget } from "@/lib/game/effects";
import type { ActionCard, ActionTarget, BaseCard, CardInstance, CardInstanceId, Player, PlayerId } from "@/lib/game/types";

type ActionHandProps = {
  canPlayActions: boolean;
  player?: Player;
  selectedActionCardId?: CardInstanceId;
  selectedPrivateTargetPlayerId?: PlayerId;
  reorderDraftIds?: CardInstanceId[];
  validTargets: ValidActionTarget[];
  canPlayActionCard: (card: CardInstance<ActionCard>) => boolean;
  getActionBlockedReason: (card: CardInstance<ActionCard>) => string | undefined;
  onSelectAction: (cardId: CardInstanceId) => void;
  onClearSelection: () => void;
  onPlayAction: (cardId: CardInstanceId, target?: ActionTarget) => void | Promise<void>;
  onReloadTestHand: () => void;
  onPreviewCard?: (card: BaseCard) => void;
  canEndTurn: boolean;
  canTakeNoble: boolean;
  currentPlayerId?: PlayerId;
  onEndTurn: (playerId: PlayerId) => void;
  onTakeNoble: (playerId: PlayerId) => void;
};

export function ActionHand({
  canPlayActions,
  player,
  selectedActionCardId,
  selectedPrivateTargetPlayerId,
  reorderDraftIds = [],
  validTargets,
  canPlayActionCard,
  getActionBlockedReason,
  onSelectAction,
  onClearSelection,
  onPlayAction,
  onReloadTestHand,
  onPreviewCard,
  canEndTurn,
  canTakeNoble,
  currentPlayerId,
  onEndTurn,
  onTakeNoble,
}: ActionHandProps) {
  const selectedAction = player?.hand.find((action) => action.instanceId === selectedActionCardId);
  const isOpinionatedGuards = selectedAction?.card.effectKey === "opinionatedGuards";
  const isLateArrival = selectedAction?.card.effectKey === "lateArrival";
  const isRatBreak = selectedAction?.card.effectKey === "ratBreak";
  const isTwistOfFate = selectedAction?.card.effectKey === "twistOfFate";
  const isPrivateHandSelection = selectedAction?.card.effectKey === "lackOfSupport";
  const isCollectedNobleSelection = selectedAction?.card.effectKey === "clericalError";
  const isLineMovementSelection = validTargets.some(isLineMovementTarget);
  const isSimpleLineNobleSelection = validTargets.some(
    (target) => target.target.type === "noble" && !isLineMovementTarget(target) && !isOpinionatedGuards,
  );
  const isPlayerSelection = validTargets.some((target) => target.target.type === "player");

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{player ? `${player.name}'s Hand` : "Action Hand"}</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-stone-600">{canPlayActions ? "May play one action" : "Action already played"}</span>
          <Button disabled={!player} onClick={onReloadTestHand}>
            Reload Test Hand
          </Button>
          <Button
            disabled={(!canTakeNoble && !canEndTurn) || !currentPlayerId}
            onClick={() => {
              if (!currentPlayerId) {
                return;
              }

              if (canEndTurn) {
                onEndTurn(currentPlayerId);
                return;
              }

              onTakeNoble(currentPlayerId);
            }}
          >
            {canEndTurn ? "End Turn" : "Take Front Noble"}
          </Button>
        </div>
      </div>

      {selectedAction ? (
        <div className="mt-3 rounded-md border border-amber-400 bg-amber-50/45 p-3 backdrop-blur-sm">
          <h3 className="font-semibold">Choose target for {selectedAction.card.name}</h3>
          <p className="mt-1 text-sm text-stone-700">Only legal targets are shown.</p>
          {isOpinionatedGuards ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-stone-700">
                Drag highlighted nobles horizontally in the noble line. Confirm when the order looks right.
              </p>
              <Button
                disabled={reorderDraftIds.length === 0}
                onClick={() => onPlayAction(selectedAction.instanceId, { type: "reorder-nobles", instanceIds: reorderDraftIds })}
              >
                Confirm Reorder
              </Button>
              <Button onClick={onClearSelection}>Cancel</Button>
            </div>
          ) : isLateArrival ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {validTargets.map((target) => {
                const noble = target.target.type === "noble-deck-card"
                  ? target.revealedNoble
                  : undefined;

                if (!noble) {
                  return null;
                }

                return (
                  <div className={`max-w-28 rounded-md border p-1.5 ${getNobleColorStyle(noble.card.colorCategory)}`} key={noble.instanceId}>
                    <CardImage
                      alt={noble.card.name}
                      className="cursor-pointer"
                      imageClassName="aspect-[5/7] border border-stone-200"
                      imagePath={noble.card.imagePath}
                      onClick={() => onPreviewCard?.(noble.card)}
                    >
                      <div className="min-h-12 rounded-md bg-white/60 p-1">
                        <h4 className="text-xs font-semibold leading-tight text-stone-950">{noble.card.name}</h4>
                        <p className="mt-1 text-xs text-stone-700">{getNoblePointText(noble)} pts</p>
                      </div>
                    </CardImage>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-semibold">{noble.card.name}</span>
                      <span className="shrink-0">{getNoblePointText(noble)} pts</span>
                    </div>
                    <Button className="mt-2 w-full px-2 py-1 text-xs" onClick={() => onPlayAction(selectedAction.instanceId, target.target)}>
                      Select
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : isTwistOfFate ? (
            <p className="mt-3 text-sm text-stone-700">Select a card in the Cards In Front panel, then confirm the discard.</p>
          ) : isRatBreak ? (
            <RatBreakDiscardPicker
              validTargets={validTargets}
              onPlay={(target) => onPlayAction(selectedAction.instanceId, target)}
              onPreviewCard={onPreviewCard}
            />
          ) : isLineMovementSelection ? (
            <p className="mt-3 text-sm text-stone-700">
              Choose a highlighted noble in the noble line, then choose one of the highlighted landing spots.
            </p>
          ) : isSimpleLineNobleSelection ? (
            <p className="mt-3 text-sm text-stone-700">Choose a highlighted noble in the noble line.</p>
          ) : isPlayerSelection ? (
            <p className="mt-3 text-sm text-stone-700">Choose a highlighted player in the Players panel.</p>
          ) : isPrivateHandSelection ? (
            <PrivateHandTargetPicker
              selectedPlayerId={selectedPrivateTargetPlayerId}
              validTargets={validTargets}
              onPlay={(target) => onPlayAction(selectedAction.instanceId, target)}
              onPreviewCard={onPreviewCard}
            />
          ) : isCollectedNobleSelection ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {validTargets.map((target) => {
                const noble = target.target.type === "collected-noble" ? target.revealedNoble : undefined;

                if (!noble) {
                  return null;
                }

                return (
                  <div className={`w-24 rounded-md border p-1.5 ${getNobleColorStyle(noble.card.colorCategory)}`} key={`${target.playerId}-${noble.instanceId}`}>
                    <p className="text-xs font-semibold text-stone-600">{target.playerName}</p>
                    <CardImage
                      alt={noble.card.name}
                      className="mt-1 cursor-pointer"
                      imageClassName="aspect-[5/7] border border-stone-200 shadow-sm"
                      imagePath={noble.card.imagePath}
                      onClick={() => onPreviewCard?.(noble.card)}
                    >
                      <div className="min-h-20 rounded-md bg-white/60 p-2">
                        <h4 className="text-sm font-semibold leading-tight text-stone-950">{noble.card.name}</h4>
                        <p className="mt-1 text-xs text-stone-700">{getNoblePointText(noble)} pts</p>
                      </div>
                    </CardImage>
                    <Button className="mt-2 w-full px-2 py-1 text-xs" onClick={() => onPlayAction(selectedAction.instanceId, target.target)}>
                      Select
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {validTargets.map((target) => (
                <Button key={`${target.target.type}-${"instanceId" in target.target ? target.target.instanceId : target.label}-${target.toPosition}`} onClick={() => onPlayAction(selectedAction.instanceId, target.target)}>
                  {target.label}
                </Button>
              ))}
            </div>
          )}
          {validTargets.length === 0 ? <p className="mt-2 text-sm text-stone-600">No legal targets for this card right now.</p> : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {player?.hand.map((action) => {
          const requiresTarget = actionEffectRequiresTarget(action.card.effectKey);
          const isSelected = action.instanceId === selectedActionCardId;
          const isPlayable = canPlayActions && canPlayActionCard(action);
          const blockedReason = getActionBlockedReason(action);

          return (
            <div
              className={`rounded-md border p-2 transition-transform duration-200 hover:z-20 hover:scale-[1.125] ${isSelected ? "border-amber-600 bg-amber-100/50" : "border-amber-300 bg-amber-50/45"}`}
              key={action.instanceId}
            >
              <CardImage
                alt={action.card.name}
                className="cursor-pointer"
                imageClassName="mx-auto max-h-60 aspect-[5/7] border border-amber-200 shadow-sm"
                imagePath={action.card.imagePath}
                onClick={() => onPreviewCard?.(action.card)}
              >
                <div>
                  <h3 className="text-sm font-semibold leading-snug">{action.card.name}</h3>
                  <p className="mt-1 text-xs text-stone-600">{action.card.description}</p>
                </div>
              </CardImage>
              {blockedReason ? <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-800">{blockedReason}</p> : null}
              <Button
                className="mt-2 w-full px-2 py-1.5 text-xs"
                disabled={!isPlayable}
                onClick={() => (requiresTarget ? onSelectAction(action.instanceId) : onPlayAction(action.instanceId))}
              >
                {blockedReason ? "Blocked" : isPlayable ? (requiresTarget ? "Choose Target" : "Play Card") : "No Legal Play"}
              </Button>
            </div>
          );
        })}
        {player && player.hand.length === 0 ? <p className="text-sm text-stone-600">No action cards in hand.</p> : null}
      </div>
    </Card>
  );
}

type PrivateHandTargetPickerProps = {
  selectedPlayerId?: string;
  validTargets: ValidActionTarget[];
  onPlay: (target: ActionTarget) => void;
  onPreviewCard?: (card: BaseCard) => void;
};

type RatBreakDiscardPickerProps = {
  validTargets: ValidActionTarget[];
  onPlay: (target: ActionTarget) => void;
  onPreviewCard?: (card: BaseCard) => void;
};

function RatBreakDiscardPicker({ validTargets, onPlay, onPreviewCard }: RatBreakDiscardPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  const [selectedTarget, setSelectedTarget] = useState<ValidActionTarget | undefined>();
  const actionTargets = validTargets.filter((target) => target.target.type === "action-discard-card" && target.revealedAction);
  const cardWidth = 96;
  const cardOverlap = cardWidth / 2;
  const cardStep = cardWidth - cardOverlap;
  const spreadOffset = cardOverlap + 8;
  const stackWidth = actionTargets.length > 0 ? cardWidth + (actionTargets.length - 1) * cardStep : 0;

  if (actionTargets.length === 0) {
    return <p className="mt-3 text-sm text-stone-600">No action cards are in the discard pile.</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto pb-3">
      <div
        className="relative min-h-40"
        onMouseLeave={() => setHoveredIndex(undefined)}
        style={{
          width: Math.max(stackWidth + spreadOffset, cardWidth),
        }}
      >
        {actionTargets.map((target, index) => {
          const action = target.revealedAction;

          if (!action) {
            return null;
          }

          const shiftForHover =
            hoveredIndex !== undefined && index < hoveredIndex
              ? -spreadOffset
              : 0;
          const isSelected = selectedTarget?.target.type === "action-discard-card" && selectedTarget.target.instanceId === action.instanceId;

          return (
            <div
              className="absolute top-0"
              key={action.instanceId}
              onMouseEnter={() => setHoveredIndex(index)}
              style={{
                height: 144,
                left: index * cardStep,
                width: cardStep,
                zIndex: actionTargets.length - index,
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
                  className={`block w-full rounded-md border bg-amber-50/50 p-1 text-left shadow-md transition hover:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isSelected ? "border-amber-700 ring-2 ring-amber-500" : "border-amber-300"
                  }`}
                  onClick={() => setSelectedTarget(target)}
                  type="button"
                >
                  <CardImage
                    alt={action.card.name}
                    className="cursor-pointer"
                    imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
                    imagePath={action.card.imagePath}
                  >
                    <div className="min-h-28 rounded-md bg-white/60 p-2">
                      <h4 className="text-sm font-semibold leading-tight">{action.card.name}</h4>
                      <p className="mt-1 text-xs text-stone-700">{action.card.description}</p>
                    </div>
                  </CardImage>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={!selectedTarget} onClick={() => selectedTarget && onPlay(selectedTarget.target)}>
          {selectedTarget?.revealedAction ? `Confirm ${selectedTarget.revealedAction.card.name}` : "Confirm Selection"}
        </Button>
        {selectedTarget?.revealedAction ? (
          <Button onClick={() => onPreviewCard?.(selectedTarget.revealedAction?.card as BaseCard)}>
            Preview
          </Button>
        ) : null}
        <p className="text-xs text-stone-600">Click a discard-pile card to select it, then confirm. Hover to spread the stack.</p>
      </div>
    </div>
  );
}

function PrivateHandTargetPicker({
  selectedPlayerId,
  validTargets,
  onPlay,
  onPreviewCard,
}: PrivateHandTargetPickerProps) {
  const playerTargets = getPrivateHandPlayerTargets(validTargets);
  const selectedPlayerTargets = selectedPlayerId
    ? validTargets.filter((target) => target.target.type === "action-hand-card" && target.playerId === selectedPlayerId)
    : [];

  if (playerTargets.length === 0) {
    return <p className="mt-3 text-sm text-stone-600">No opponents have action cards to discard.</p>;
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {selectedPlayerId ? (
        <p className="rounded-md border border-amber-300 bg-white/40 px-3 py-2 text-sm font-medium text-stone-800 backdrop-blur-sm">
          Inspecting {playerTargets.find((target) => target.playerId === selectedPlayerId)?.playerName ?? "selected player"}'s hand.
        </p>
      ) : (
        <p className="rounded-md border border-amber-300 bg-white/40 px-3 py-2 text-sm font-medium text-stone-800 backdrop-blur-sm">
          Choose an opponent from the Players panel to inspect their hand.
        </p>
      )}

      {selectedPlayerId ? (
        <div className="flex flex-wrap gap-1">
          {selectedPlayerTargets.map((target) => {
            const action = target.target.type === "action-hand-card" ? target.revealedAction : undefined;

            if (!action) {
              return null;
            }

            return (
              <div className="w-24 rounded-md border border-amber-300 bg-amber-50/45 p-1.5 backdrop-blur-sm" key={`${target.playerId}-${action.instanceId}`}>
                <CardImage
                  alt={action.card.name}
                  className="cursor-pointer"
                  imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
                  imagePath={action.card.imagePath}
                  onClick={() => onPreviewCard?.(action.card)}
                >
                  <div>
                    <h4 className="font-semibold leading-tight">{action.card.name}</h4>
                    <p className="mt-1 text-xs text-stone-700">{action.card.description}</p>
                  </div>
                </CardImage>
                <Button className="mt-2 w-full px-2 py-1 text-xs" onClick={() => onPlay(target.target)}>
                  Discard
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-stone-600">Choose an opponent to inspect their hand.</p>
      )}
    </div>
  );
}

function getPrivateHandPlayerTargets(validTargets: ValidActionTarget[]) {
  const players = new Map<string, string>();

  validTargets.forEach((target) => {
    if (target.target.type === "action-hand-card" && target.playerId && target.playerName) {
      players.set(target.playerId, target.playerName);
    }
  });

  return Array.from(players, ([playerId, playerName]) => ({ playerId, playerName }));
}

function isLineMovementTarget(target: ValidActionTarget): boolean {
  return (
    (target.target.type === "move-noble" || target.target.type === "noble") &&
    typeof target.fromPosition === "number" &&
    typeof target.toPosition === "number"
  );
}
