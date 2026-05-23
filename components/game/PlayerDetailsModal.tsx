"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CollectedNobleStacks, InFrontActionStack } from "@/components/game/CollectedNobleStacks";
import type { ActionCard, ActionTarget, BaseCard, CardInstance, CardInstanceId, Player, PlayerId } from "@/lib/game/types";
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

  const visiblePlayer = player;

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
        className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-lg border border-stone-300 bg-white/50 p-4 shadow-2xl backdrop-blur-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-stone-950">{visiblePlayer.name}</h2>
            <p className="text-sm font-semibold text-stone-700">{visiblePlayer.score} pts</p>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>

        {isTwistOfFateActive ? (
          <div className="mt-4 rounded-md border border-amber-400 bg-amber-50/45 p-3 backdrop-blur-sm">
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

        <div className="mt-4">
          <section>
            <h3 className="text-lg font-semibold">Collected Nobles</h3>
            {visiblePlayer.collectedNobles.length > 0 || visiblePlayer.inFrontActions.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-start gap-4">
                <CollectedNobleStacks
                  cardWidth={128}
                  maxCardsPerStack={7}
                  nobles={visiblePlayer.collectedNobles}
                  offset={48}
                  onPreviewCard={onPreviewCard}
                />
                <InFrontActionStack
                  actions={visiblePlayer.inFrontActions}
                  cardWidth={128}
                  maxCardsPerStack={7}
                  offset={48}
                  selectedActionId={pendingTwistTarget?.target.type === "in-front-action" ? pendingTwistTarget.target.instanceId : undefined}
                  onCardClick={(action) => handleInFrontActionClick(action)}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-600">No nobles collected yet.</p>
            )}

            {visiblePlayer.inFrontActions.some((action) => action.card.effectKey === "callousGuards") &&
            visiblePlayer.id === currentPlayerId &&
            canDiscardCallousGuards ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {visiblePlayer.inFrontActions
                  .filter((action) => action.card.effectKey === "callousGuards")
                  .map((action) => (
                    <Button key={action.instanceId} onClick={() => onDiscardCallousGuards(action.instanceId)}>
                      Discard Callous Guards
                    </Button>
                  ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );

  function handleInFrontActionClick(action: CardInstance<ActionCard>) {
    const twistTarget = validTargets.find(
      (target) =>
        target.target.type === "in-front-action" &&
        target.target.playerId === visiblePlayer.id &&
        target.target.instanceId === action.instanceId,
    );

    if (twistTarget) {
      setPendingTwistTarget(twistTarget);
      return;
    }

    onPreviewCard(action.card);
  }
}
