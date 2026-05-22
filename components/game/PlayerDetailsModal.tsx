"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import { getNoblePointText } from "@/lib/game/scoring";
import type { ActionTarget, BaseCard, CardInstanceId, Player, PlayerId } from "@/lib/game/types";
import type { ValidActionTarget } from "@/lib/game/effects";

type PlayerDetailsModalProps = {
  player?: Player;
  currentPlayerId?: PlayerId;
  selectedActionCardId?: CardInstanceId;
  validTargets: ValidActionTarget[];
  canDiscardCallousGuards: boolean;
  onClose: () => void;
  onDiscardCallousGuards: (cardId: CardInstanceId) => void;
  onPlayAction: (cardId: CardInstanceId, target?: ActionTarget) => void;
  onPreviewCard: (card: BaseCard) => void;
};

export function PlayerDetailsModal({
  player,
  currentPlayerId,
  selectedActionCardId,
  validTargets,
  canDiscardCallousGuards,
  onClose,
  onDiscardCallousGuards,
  onPlayAction,
  onPreviewCard,
}: PlayerDetailsModalProps) {
  const [pendingTwistTarget, setPendingTwistTarget] = useState<ValidActionTarget | undefined>();
  const isTwistOfFateActive = validTargets.some((target) => target.target.type === "in-front-action");

  if (!player) {
    return null;
  }

  function confirmTwistOfFate() {
    if (!selectedActionCardId || !pendingTwistTarget) {
      return;
    }

    onPlayAction(selectedActionCardId, pendingTwistTarget.target);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-lg border border-stone-300 bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-stone-950">{player.name}</h2>
            <p className="text-sm font-semibold text-stone-700">{player.score} pts</p>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>

        {isTwistOfFateActive ? (
          <div className="mt-4 rounded-md border border-amber-400 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-950">Twist of Fate: choose a card in front of a player.</p>
            {pendingTwistTarget ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-sm text-stone-700">
                  Confirm discard {pendingTwistTarget.revealedAction?.card.name} from {pendingTwistTarget.playerName}?
                </p>
                <Button disabled={!selectedActionCardId} onClick={confirmTwistOfFate}>
                  Confirm
                </Button>
                <Button onClick={() => setPendingTwistTarget(undefined)}>Cancel</Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <section>
            <h3 className="text-lg font-semibold">Collected Nobles</h3>
            {player.collectedNobles.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {player.collectedNobles.map((noble) => (
                  <div
                    className={`rounded-md border p-1 text-xs text-stone-800 ${getNobleColorStyle(noble.card.colorCategory)}`}
                    key={noble.instanceId}
                  >
                    <CardImage
                      alt={noble.card.name}
                      className="cursor-pointer"
                      imageClassName="aspect-[5/7] border border-stone-200"
                      imagePath={noble.card.imagePath}
                      onClick={() => onPreviewCard(noble.card)}
                    >
                      <div className="min-h-16 rounded bg-white/60 p-1">
                        <span className="font-semibold">{noble.card.name}</span>
                      </div>
                    </CardImage>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="truncate font-semibold">{noble.card.name}</span>
                      <span className="shrink-0">{getNoblePointText(noble, player)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-600">No nobles collected yet.</p>
            )}
          </section>

          <section>
            <h3 className="text-lg font-semibold">Cards In Front</h3>
            {player.inFrontActions.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {player.inFrontActions.map((action) => {
                  const twistTarget = validTargets.find(
                    (target) =>
                      target.target.type === "in-front-action" &&
                      target.target.playerId === player.id &&
                      target.target.instanceId === action.instanceId,
                  );
                  const isSelected =
                    pendingTwistTarget?.target.type === "in-front-action" &&
                    pendingTwistTarget.target.instanceId === action.instanceId;

                  return (
                    <div
                      className={`rounded-md border p-2 ${
                        isSelected ? "border-amber-600 bg-amber-100" : "border-amber-300 bg-amber-50"
                      }`}
                      key={action.instanceId}
                    >
                      <CardImage
                        alt={action.card.name}
                        className="mx-auto w-24 cursor-pointer"
                        imageClassName="aspect-[5/7] border border-amber-200"
                        imagePath={action.card.imagePath}
                        onClick={() => onPreviewCard(action.card)}
                      >
                        <div className="min-h-24 rounded bg-white/60 p-2 text-sm font-semibold">{action.card.name}</div>
                      </CardImage>
                      {action.card.effectKey === "callousGuards" && player.id === currentPlayerId && canDiscardCallousGuards ? (
                        <Button className="mt-2 w-full" onClick={() => onDiscardCallousGuards(action.instanceId)}>
                          Discard Callous Guards
                        </Button>
                      ) : null}
                      {twistTarget ? (
                        <Button className="mt-2 w-full" onClick={() => setPendingTwistTarget(twistTarget)}>
                          Select
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-600">{player.name} has no cards in front.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
