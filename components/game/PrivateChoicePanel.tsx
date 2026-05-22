"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import { getNoblePointText } from "@/lib/game/scoring";
import type { CardInstanceId, PendingPrivateChoice, Player } from "@/lib/game/types";

type PrivateChoicePanelProps = {
  pendingChoice: PendingPrivateChoice;
  players: Player[];
  onResolveInfighting: (playerId: string, cardIds: CardInstanceId[]) => void;
  onResolveClericalErrorReturn: (playerId: string, nobleId?: CardInstanceId) => void;
  onResolveInnocentVictimDiscard: (playerId: string, cardId?: CardInstanceId) => void;
  onResolveClownGift: (playerId: string, targetPlayerId: string) => void;
};

export function PrivateChoicePanel({
  pendingChoice,
  players,
  onResolveInfighting,
  onResolveClericalErrorReturn,
  onResolveInnocentVictimDiscard,
  onResolveClownGift,
}: PrivateChoicePanelProps) {
  if (pendingChoice.type === "infighting") {
    return (
      <InfightingChoice
        player={players.find((player) => player.id === pendingChoice.targetPlayerId)}
        onConfirm={(cardIds) => onResolveInfighting(pendingChoice.targetPlayerId, cardIds)}
      />
    );
  }

  if (pendingChoice.type === "innocentVictimDiscard") {
    return (
      <InnocentVictimChoice
        player={players.find((player) => player.id === pendingChoice.targetPlayerId)}
        onConfirm={(cardId) => onResolveInnocentVictimDiscard(pendingChoice.targetPlayerId, cardId)}
      />
    );
  }

  if (pendingChoice.type === "clownGift") {
    return (
      <ClownGiftChoice
        players={players}
        receivingPlayerId={pendingChoice.targetPlayerId}
        onConfirm={(targetPlayerId) => onResolveClownGift(pendingChoice.targetPlayerId, targetPlayerId)}
      />
    );
  }

  const originalPlayer = players.find((player) => player.id === pendingChoice.originalPlayerId);
  const targetPlayer = players.find((player) => player.id === pendingChoice.targetPlayerId);
  const eligibleNobles =
    originalPlayer?.collectedNobles.filter((noble) => noble.instanceId !== pendingChoice.excludedNobleInstanceId) ?? [];

  return (
    <section className="fixed inset-0 z-40 min-h-screen overflow-auto bg-stone-100 p-6">
      <div className="mx-auto max-w-3xl">
        <Card>
          <h1 className="text-2xl font-bold">Clerical Error</h1>
          <p className="mt-2 text-sm text-stone-700">
            {targetPlayer?.name ?? "Target player"}, choose a noble from {originalPlayer?.name ?? "the other player"}'s score pile to collect.
          </p>

          {eligibleNobles.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {eligibleNobles.map((noble) => (
                <div className={`rounded-md border p-3 ${getNobleColorStyle(noble.card.colorCategory)}`} key={noble.instanceId}>
                  <h2 className="font-semibold">{noble.card.name}</h2>
                  <p className="mt-1 text-sm text-stone-700">{getNoblePointText(noble)} pts</p>
                  <Button className="mt-3 w-full" onClick={() => onResolveClericalErrorReturn(pendingChoice.targetPlayerId, noble.instanceId)}>
                    Select
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-stone-600">No eligible nobles are available to return.</p>
              <Button className="mt-3" onClick={() => onResolveClericalErrorReturn(pendingChoice.targetPlayerId)}>
                Continue
              </Button>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function ClownGiftChoice({
  players,
  receivingPlayerId,
  onConfirm,
}: {
  players: Player[];
  receivingPlayerId: string;
  onConfirm: (targetPlayerId: string) => void;
}) {
  const receivingPlayer = players.find((player) => player.id === receivingPlayerId);
  const targets = players.filter((player) => player.id !== receivingPlayerId);

  return (
    <section className="fixed inset-0 z-40 min-h-screen overflow-auto bg-stone-100 p-6">
      <div className="mx-auto max-w-3xl">
        <Card>
          <h1 className="text-2xl font-bold">The Clown</h1>
          <p className="mt-2 text-sm text-stone-700">
            {receivingPlayer?.name ?? "Receiving player"}, choose another player to give The Clown to.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {targets.map((player) => (
              <Button key={player.id} onClick={() => onConfirm(player.id)}>
                Give to {player.name}
              </Button>
            ))}
          </div>

          {targets.length === 0 ? <p className="mt-4 text-sm text-stone-600">No other players are available.</p> : null}
        </Card>
      </div>
    </section>
  );
}

function InnocentVictimChoice({
  player,
  onConfirm,
}: {
  player?: Player;
  onConfirm: (cardId?: CardInstanceId) => void;
}) {
  return (
    <section className="fixed inset-0 z-40 min-h-screen overflow-auto bg-stone-100 p-6">
      <div className="mx-auto max-w-3xl">
        <Card>
          <h1 className="text-2xl font-bold">Innocent Victim</h1>
          <p className="mt-2 text-sm text-stone-700">
            {player?.name ?? "Player"}, choose 1 action card to discard.
          </p>

          {player && player.hand.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {player.hand.map((action) => (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3" key={action.instanceId}>
                  <h2 className="font-semibold">{action.card.name}</h2>
                  <p className="mt-1 text-sm text-stone-700">{action.card.description}</p>
                  <Button className="mt-3 w-full" onClick={() => onConfirm(action.instanceId)}>
                    Discard
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-stone-600">No action cards to discard.</p>
              <Button className="mt-3" onClick={() => onConfirm()}>
                Continue
              </Button>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function InfightingChoice({
  player,
  onConfirm,
}: {
  player?: Player;
  onConfirm: (cardIds: CardInstanceId[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<CardInstanceId[]>([]);
  const requiredCount = Math.min(2, player?.hand.length ?? 0);

  function toggleCard(cardId: CardInstanceId) {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(cardId)) {
        return currentIds.filter((id) => id !== cardId);
      }

      if (currentIds.length >= requiredCount) {
        return currentIds;
      }

      return [...currentIds, cardId];
    });
  }

  return (
    <section className="fixed inset-0 z-40 min-h-screen overflow-auto bg-stone-100 p-6">
      <div className="mx-auto max-w-3xl">
        <Card>
          <h1 className="text-2xl font-bold">Infighting</h1>
          <p className="mt-2 text-sm text-stone-700">
            {player?.name ?? "Target player"}, choose {requiredCount} action card{requiredCount === 1 ? "" : "s"} to discard.
          </p>

          {player && player.hand.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {player.hand.map((action) => {
                const isSelected = selectedIds.includes(action.instanceId);

                return (
                  <button
                    className={`rounded-md border p-3 text-left ${
                      isSelected ? "border-amber-600 bg-amber-100" : "border-amber-300 bg-amber-50"
                    }`}
                    key={action.instanceId}
                    onClick={() => toggleCard(action.instanceId)}
                    type="button"
                  >
                    <h2 className="font-semibold">{action.card.name}</h2>
                    <p className="mt-1 text-sm text-stone-700">{action.card.description}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-600">No action cards to discard.</p>
          )}

          <Button className="mt-4" disabled={selectedIds.length !== requiredCount} onClick={() => onConfirm(selectedIds)}>
            Confirm Discard
          </Button>
        </Card>
      </div>
    </section>
  );
}
