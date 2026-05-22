import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import type { ActionCard, ActionTarget, CardInstanceId, Player, PlayerId } from "@/lib/game/types";
import type { ValidActionTarget } from "@/lib/game/effects";

type PersistentActionCardsProps = {
  players: Player[];
  selectedPlayerId?: PlayerId;
  selectedActionCardId?: CardInstanceId;
  validTargets?: ValidActionTarget[];
  onSelectPlayer: (playerId: PlayerId) => void;
  onPlayAction?: (cardId: CardInstanceId, target?: ActionTarget) => void;
  currentPlayerId?: PlayerId;
  canDiscardCallousGuards?: boolean;
  onDiscardCallousGuards?: (cardId: CardInstanceId) => void;
  onPreviewCard?: (card: ActionCard) => void;
};

export function PersistentActionCards({
  players,
  selectedPlayerId,
  selectedActionCardId,
  validTargets = [],
  onSelectPlayer,
  onPlayAction,
  currentPlayerId,
  canDiscardCallousGuards = false,
  onDiscardCallousGuards,
  onPreviewCard,
}: PersistentActionCardsProps) {
  const [pendingTarget, setPendingTarget] = useState<ValidActionTarget | undefined>();
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? players[0];
  const cardsInFront = selectedPlayer?.inFrontActions ?? [];
  const isTwistOfFateActive = validTargets.some((target) => target.target.type === "in-front-action");

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Cards In Front</h2>
        <select
          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
          disabled={players.length === 0}
          onChange={(event) => onSelectPlayer(event.target.value)}
          value={selectedPlayer?.id ?? ""}
        >
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </div>

      {isTwistOfFateActive ? (
        <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-950">Twist of Fate: choose a card in front of any player.</p>
          {pendingTarget ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-sm text-stone-700">
                Confirm discard {pendingTarget.revealedAction?.card.name} from {pendingTarget.playerName}?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!selectedActionCardId || !onPlayAction}
                  onClick={() => selectedActionCardId && onPlayAction?.(selectedActionCardId, pendingTarget.target)}
                >
                  Confirm
                </Button>
                <Button onClick={() => setPendingTarget(undefined)}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex max-h-44 flex-col gap-2 overflow-auto">
        {cardsInFront.length > 0 ? (
          cardsInFront.map((action) => {
            const twistTarget = validTargets.find(
              (target) =>
                target.target.type === "in-front-action" &&
                target.target.playerId === selectedPlayer?.id &&
                target.target.instanceId === action.instanceId,
            );
            const isSelected = pendingTarget?.target.type === "in-front-action" && pendingTarget.target.instanceId === action.instanceId;

            return (
              <div
                className={`rounded-md border px-3 py-2 ${
                  isSelected ? "border-amber-600 bg-amber-100" : "border-amber-300 bg-amber-50"
                }`}
                key={action.instanceId}
              >
                <div className="flex gap-2">
                  <CardImage
                    alt={action.card.name}
                    className="w-14 shrink-0 cursor-pointer"
                    imageClassName="aspect-[5/7] border border-amber-200"
                    imagePath={action.card.imagePath}
                    onClick={() => onPreviewCard?.(action.card)}
                  >
                    <div className="hidden" />
                  </CardImage>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug">{action.card.name}</h3>
                    <p className="mt-1 text-xs text-stone-700">{action.card.description ?? "Persistent action modifier."}</p>
                  </div>
                </div>
                {action.card.effectKey === "callousGuards" && selectedPlayer?.id === currentPlayerId && canDiscardCallousGuards ? (
                  <Button className="mt-2 w-full" onClick={() => onDiscardCallousGuards?.(action.instanceId)}>
                    Discard Callous Guards
                  </Button>
                ) : null}
                {twistTarget ? (
                  <Button className="mt-2 w-full" onClick={() => setPendingTarget(twistTarget)}>
                    Select
                  </Button>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-stone-600">
            {selectedPlayer ? `${selectedPlayer.name} has no cards in front.` : "No player selected."}
          </p>
        )}
      </div>
    </Card>
  );
}
