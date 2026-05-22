import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import { actionEffectRequiresTarget } from "@/lib/game/effects";
import { getNoblePointText } from "@/lib/game/scoring";
import type { ValidActionTarget } from "@/lib/game/effects";
import type { ActionCard, ActionTarget, CardInstance, CardInstanceId, Player } from "@/lib/game/types";

type ActionHandProps = {
  canPlayActions: boolean;
  player?: Player;
  selectedActionCardId?: CardInstanceId;
  validTargets: ValidActionTarget[];
  canPlayActionCard: (card: CardInstance<ActionCard>) => boolean;
  getActionBlockedReason: (card: CardInstance<ActionCard>) => string | undefined;
  onSelectAction: (cardId: CardInstanceId) => void;
  onClearSelection: () => void;
  onPlayAction: (cardId: CardInstanceId, target?: ActionTarget) => void;
  onReloadTestHand: () => void;
};

export function ActionHand({
  canPlayActions,
  player,
  selectedActionCardId,
  validTargets,
  canPlayActionCard,
  getActionBlockedReason,
  onSelectAction,
  onClearSelection,
  onPlayAction,
  onReloadTestHand,
}: ActionHandProps) {
  const selectedAction = player?.hand.find((action) => action.instanceId === selectedActionCardId);
  const [reorderIds, setReorderIds] = useState<CardInstanceId[]>([]);
  const [selectedPrivateTargetPlayerId, setSelectedPrivateTargetPlayerId] = useState<string | undefined>();
  const isOpinionatedGuards = selectedAction?.card.effectKey === "opinionatedGuards";
  const isLateArrival = selectedAction?.card.effectKey === "lateArrival";
  const isTwistOfFate = selectedAction?.card.effectKey === "twistOfFate";
  const isPrivateHandSelection = selectedAction?.card.effectKey === "lackOfSupport";
  const isCollectedNobleSelection = selectedAction?.card.effectKey === "clericalError";

  useEffect(() => {
    if (!isOpinionatedGuards) {
      setReorderIds([]);
      return;
    }

    setReorderIds(validTargets.flatMap((target) => (target.target.type === "noble" ? [target.target.instanceId] : [])));
  }, [isOpinionatedGuards, selectedActionCardId, validTargets]);

  useEffect(() => {
    if (!isPrivateHandSelection) {
      setSelectedPrivateTargetPlayerId(undefined);
    }
  }, [isPrivateHandSelection, selectedActionCardId]);

  function moveReorderItem(instanceId: CardInstanceId, direction: -1 | 1) {
    setReorderIds((currentIds) => {
      const currentIndex = currentIds.indexOf(instanceId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentIds.length) {
        return currentIds;
      }

      const nextIds = [...currentIds];
      [nextIds[currentIndex], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[currentIndex]];
      return nextIds;
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{player ? `${player.name}'s Hand` : "Action Hand"}</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-stone-600">{canPlayActions ? "May play one action" : "Action already played"}</span>
          <Button disabled={!player} onClick={onReloadTestHand}>
            Reload Test Hand
          </Button>
        </div>
      </div>

      {selectedAction ? (
        <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3">
          <h3 className="font-semibold">Choose target for {selectedAction.card.name}</h3>
          <p className="mt-1 text-sm text-stone-700">Only legal targets are shown.</p>
          {isOpinionatedGuards ? (
            <div className="mt-3 flex flex-col gap-2">
              {reorderIds.map((instanceId, index) => {
                const target = validTargets.find(
                  (candidate) => candidate.target.type === "noble" && candidate.target.instanceId === instanceId,
                );

                return (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-white px-3 py-2" key={instanceId}>
                    <span className="text-sm font-medium">{target?.nobleName ?? `Noble ${index + 1}`}</span>
                    <div className="flex gap-1">
                      <Button disabled={index === 0} onClick={() => moveReorderItem(instanceId, -1)}>
                        Up
                      </Button>
                      <Button disabled={index === reorderIds.length - 1} onClick={() => moveReorderItem(instanceId, 1)}>
                        Down
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={reorderIds.length === 0}
                  onClick={() => onPlayAction(selectedAction.instanceId, { type: "reorder-nobles", instanceIds: reorderIds })}
                >
                  Confirm Order
                </Button>
                <Button onClick={onClearSelection}>Cancel</Button>
              </div>
            </div>
          ) : isLateArrival ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {validTargets.map((target) => {
                const noble = target.target.type === "noble-deck-card"
                  ? target.revealedNoble
                  : undefined;

                if (!noble) {
                  return null;
                }

                return (
                  <div className={`rounded-md border p-2 ${getNobleColorStyle(noble.card.colorCategory)}`} key={noble.instanceId}>
                    <h4 className="text-sm font-semibold leading-tight text-stone-950">{noble.card.name}</h4>
                    <p className="mt-1 text-xs text-stone-700">{getNoblePointText(noble)} pts</p>
                    <Button className="mt-3 w-full" onClick={() => onPlayAction(selectedAction.instanceId, target.target)}>
                      Select
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : isTwistOfFate ? (
            <p className="mt-3 text-sm text-stone-700">Select a card in the Cards In Front panel, then confirm the discard.</p>
          ) : isPrivateHandSelection ? (
            <PrivateHandTargetPicker
              selectedPlayerId={selectedPrivateTargetPlayerId}
              validTargets={validTargets}
              onSelectPlayer={setSelectedPrivateTargetPlayerId}
              onPlay={(target) => onPlayAction(selectedAction.instanceId, target)}
            />
          ) : isCollectedNobleSelection ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {validTargets.map((target) => {
                const noble = target.target.type === "collected-noble" ? target.revealedNoble : undefined;

                if (!noble) {
                  return null;
                }

                return (
                  <div className={`rounded-md border p-2 ${getNobleColorStyle(noble.card.colorCategory)}`} key={`${target.playerId}-${noble.instanceId}`}>
                    <p className="text-xs font-semibold text-stone-600">{target.playerName}</p>
                    <h4 className="mt-1 text-sm font-semibold leading-tight text-stone-950">{noble.card.name}</h4>
                    <p className="mt-1 text-xs text-stone-700">{getNoblePointText(noble)} pts</p>
                    <Button className="mt-3 w-full" onClick={() => onPlayAction(selectedAction.instanceId, target.target)}>
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

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {player?.hand.map((action) => {
          const requiresTarget = actionEffectRequiresTarget(action.card.effectKey);
          const isSelected = action.instanceId === selectedActionCardId;
          const isPlayable = canPlayActions && canPlayActionCard(action);
          const blockedReason = getActionBlockedReason(action);

          return (
            <div
              className={`rounded-md border p-3 ${isSelected ? "border-amber-600 bg-amber-100" : "border-amber-300 bg-amber-50"}`}
              key={action.instanceId}
            >
              <h3 className="font-semibold leading-snug">{action.card.name}</h3>
              <p className="mt-1 text-sm text-stone-600">{action.card.description}</p>
              {blockedReason ? <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-800">{blockedReason}</p> : null}
              <Button
                className="mt-3 w-full"
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
  onSelectPlayer: (playerId: string) => void;
  onPlay: (target: ActionTarget) => void;
};

function PrivateHandTargetPicker({
  selectedPlayerId,
  validTargets,
  onSelectPlayer,
  onPlay,
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
        <p className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
          Inspecting {playerTargets.find((target) => target.playerId === selectedPlayerId)?.playerName ?? "selected player"}'s hand.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {playerTargets.map((target) => (
            <Button key={target.playerId} onClick={() => onSelectPlayer(target.playerId)}>
              {target.playerName}
            </Button>
          ))}
        </div>
      )}

      {selectedPlayerId ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {selectedPlayerTargets.map((target) => {
            const action = target.target.type === "action-hand-card" ? target.revealedAction : undefined;

            if (!action) {
              return null;
            }

            return (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3" key={`${target.playerId}-${action.instanceId}`}>
                <h4 className="font-semibold leading-tight">{action.card.name}</h4>
                <p className="mt-1 text-xs text-stone-700">{action.card.description}</p>
                <Button className="mt-3 w-full" onClick={() => onPlay(target.target)}>
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
