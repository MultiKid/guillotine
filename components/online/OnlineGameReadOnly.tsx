"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import type { PlayerGameView } from "@/lib/game/playerView";
import type { ActionCard, ActionEffectKey, ActionTarget, CardInstance, CardInstanceId } from "@/lib/game/types";

type OnlineGameReadOnlyProps = {
  error?: string;
  isBusy?: boolean;
  onEndTurn: () => void;
  onPlayAction: (cardId: CardInstanceId, target?: ActionTarget) => void;
  onTakeFrontNoble: () => void;
  view: PlayerGameView;
};

type OnlineActionTargetChoice = {
  label: string;
  target: ActionTarget;
};

type OnlineActionConfig =
  | {
      kind: "movement";
      direction: "forward" | "backward";
      exact: boolean;
      maxSpaces: number;
    }
  | {
      kind: "front";
    }
  | {
      kind: "automatic";
    };

const ONLINE_ACTION_CONFIGS: Partial<Record<ActionEffectKey, OnlineActionConfig>> = {
  pushed: { kind: "movement", direction: "forward", exact: true, maxSpaces: 2 },
  stumble: { kind: "movement", direction: "forward", exact: true, maxSpaces: 1 },
  trip: { kind: "movement", direction: "backward", exact: true, maxSpaces: 1 },
  tisFarBetterThing: { kind: "movement", direction: "forward", exact: true, maxSpaces: 3 },
  ignobleNoble: { kind: "movement", direction: "forward", exact: true, maxSpaces: 4 },
  wasThatMyName: { kind: "movement", direction: "forward", exact: false, maxSpaces: 3 },
  lIdiot: { kind: "movement", direction: "forward", exact: false, maxSpaces: 2 },
  friendOfTheQueen: { kind: "movement", direction: "backward", exact: false, maxSpaces: 2 },
  faintingSpell: { kind: "movement", direction: "backward", exact: false, maxSpaces: 3 },
  publicDemand: { kind: "front" },
  bribedGuards: { kind: "automatic" },
  theLongWalk: { kind: "automatic" },
};

export function OnlineGameReadOnly({ error, isBusy = false, onEndTurn, onPlayAction, onTakeFrontNoble, view }: OnlineGameReadOnlyProps) {
  const [selectedActionId, setSelectedActionId] = useState<CardInstanceId | undefined>();
  const currentPlayer = view.players.find((player) => player.id === view.currentPlayerId);
  const canTakeFrontNoble =
    view.phase === "playing" && view.isViewerTurn && view.turnStep !== "turnComplete" && view.nobleLine.length > 0 && !isBusy;
  const canEndTurn = view.phase === "playing" && view.isViewerTurn && view.turnStep === "turnComplete" && !isBusy;
  const canPlayAction = view.phase === "playing" && view.isViewerTurn && view.turnStep === "playActionOptional" && !isBusy;
  const selectedAction = view.viewer?.hand.find((action) => action.instanceId === selectedActionId);
  const selectedActionConfig = selectedAction ? ONLINE_ACTION_CONFIGS[selectedAction.card.effectKey] : undefined;
  const targetChoicesByNobleId = useMemo(
    () => selectedActionConfig ? getTargetChoicesByNobleId(view, selectedActionConfig) : new Map<CardInstanceId, OnlineActionTargetChoice[]>(),
    [selectedActionConfig, view],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Online Read-Only Game</p>
            <h2 className="text-xl font-bold">
              {view.isViewerTurn ? "Your turn" : `${currentPlayer?.name ?? "A player"}'s turn`}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold text-stone-700">
            <span className="rounded-full bg-white/45 px-3 py-1">Day {view.day} / {view.maxDays}</span>
            <span className="rounded-full bg-white/45 px-3 py-1">{view.turnStep}</span>
            <span className="rounded-full bg-amber-100/70 px-3 py-1 text-amber-950">Movement actions online</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border border-stone-300 bg-white/55 px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canTakeFrontNoble && !canEndTurn}
            onClick={canEndTurn ? onEndTurn : onTakeFrontNoble}
            type="button"
          >
            {isBusy ? "Working..." : canEndTurn ? "End Turn" : "Take Front Noble"}
          </button>
          {!view.isViewerTurn ? (
            <p className="text-sm text-stone-700">Waiting for {currentPlayer?.name ?? "the current player"}.</p>
          ) : null}
          {error ? <p className="text-sm font-medium text-red-800">{error}</p> : null}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold">Players</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {view.players.map((player) => (
            <div
              className={`rounded-md border p-2 ${
                player.id === view.viewerPlayerId ? "border-stone-900 bg-stone-100/45" : "border-stone-300 bg-white/35"
              }`}
              key={player.id}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-semibold">{player.name}</h4>
                <span className="text-sm font-semibold">{player.score} pts</span>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                {player.handCount} hand, {player.collectedNobles.length} nobles, {player.inFrontActions.length} in front
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Noble Line</h3>
          <span className="text-sm text-stone-600">Front noble is on the left</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-12">
          {view.nobleLine.map((noble, index) => (
            <div className={`rounded-md border p-2 ${getNobleColorStyle(noble.card.colorCategory)}`} key={noble.instanceId}>
              <p className="mb-1 text-xs font-semibold text-stone-600">{index + 1}</p>
              <CardImage
                alt={noble.card.name}
                imageClassName="aspect-[5/7] border border-stone-200 shadow-sm"
                imagePath={noble.card.imagePath}
              >
                <div className="rounded-md bg-white/60 p-2">
                  <h4 className="text-sm font-semibold leading-tight">{noble.card.name}</h4>
                  <p className="mt-1 text-xs text-stone-700">{noble.card.points} pts</p>
                </div>
              </CardImage>
              {selectedAction && targetChoicesByNobleId.has(noble.instanceId) ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {targetChoicesByNobleId.get(noble.instanceId)?.map((choice) => (
                    <button
                      className="rounded border border-amber-400 bg-amber-100/75 px-2 py-1 text-xs font-semibold text-amber-950"
                      disabled={isBusy}
                      key={`${noble.instanceId}-${choice.label}`}
                      onClick={() => {
                        onPlayAction(selectedAction.instanceId, choice.target);
                        setSelectedActionId(undefined);
                      }}
                      type="button"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{view.viewer?.name ?? "Your"} Hand</h3>
          <p className="text-sm text-stone-600">
            {canPlayAction ? "You may play one action card before taking a noble." : "Only your device receives these cards."}
          </p>
        </div>
        {selectedAction ? (
          <div className="mt-3 rounded-md border border-amber-400 bg-amber-50/60 p-3 text-sm text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                Choose a target for <span className="font-semibold">{selectedAction.card.name}</span>.
              </p>
              <button
                className="rounded border border-stone-300 bg-white/55 px-2 py-1 text-xs font-semibold"
                onClick={() => setSelectedActionId(undefined)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {view.viewer?.hand.map((action) => (
            <div className="rounded-md border border-amber-300 bg-amber-50/45 p-2" key={action.instanceId}>
              <CardImage
                alt={action.card.name}
                imageClassName="aspect-[5/7] border border-amber-200 shadow-sm"
                imagePath={action.card.imagePath}
              >
                <div className="rounded-md bg-white/60 p-2">
                  <h4 className="text-sm font-semibold leading-tight">{action.card.name}</h4>
                  <p className="mt-1 text-xs text-stone-700">{action.card.description}</p>
                </div>
              </CardImage>
              <OnlineActionButton
                action={action}
                canPlayAction={canPlayAction}
                isBusy={isBusy}
                view={view}
                onPlayAction={onPlayAction}
                onSelectAction={setSelectedActionId}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Collected Nobles</h3>
          <p className="text-sm font-semibold text-stone-700">{view.viewer?.score ?? 0} pts</p>
        </div>
        {view.viewer && view.viewer.collectedNobles.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {view.viewer.collectedNobles.map((noble) => (
              <div className={`rounded-md border p-2 ${getNobleColorStyle(noble.card.colorCategory)}`} key={noble.instanceId}>
                <CardImage
                  alt={noble.card.name}
                  imageClassName="aspect-[5/7] border border-stone-200 shadow-sm"
                  imagePath={noble.card.imagePath}
                >
                  <div className="rounded-md bg-white/60 p-2">
                    <h4 className="text-sm font-semibold leading-tight">{noble.card.name}</h4>
                    <p className="mt-1 text-xs text-stone-700">{noble.card.points} pts</p>
                  </div>
                </CardImage>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-600">No nobles collected yet.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold">Public History</h3>
        <div className="mt-3 max-h-40 overflow-auto pr-2 text-sm text-stone-700">
          {view.log.map((entry) => (
            <p className="mb-2" key={entry.id}>{entry.message}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}

function OnlineActionButton({
  action,
  canPlayAction,
  isBusy,
  onPlayAction,
  onSelectAction,
  view,
}: {
  action: CardInstance<ActionCard>;
  canPlayAction: boolean;
  isBusy: boolean;
  onPlayAction: (cardId: CardInstanceId, target?: ActionTarget) => void;
  onSelectAction: (cardId: CardInstanceId | undefined) => void;
  view: PlayerGameView;
}) {
  const config = ONLINE_ACTION_CONFIGS[action.card.effectKey];

  if (!config) {
    return (
      <button
        className="mt-2 w-full rounded-md border border-stone-300 bg-white/35 px-2 py-1.5 text-xs font-semibold text-stone-500"
        disabled
        type="button"
      >
        Not online yet
      </button>
    );
  }

  const hasLegalTargets = config.kind === "automatic" || getTargetChoicesByNobleId(view, config).size > 0;

  return (
    <button
      className="mt-2 w-full rounded-md border border-amber-400 bg-white/55 px-2 py-1.5 text-xs font-semibold text-stone-900 transition hover:bg-white/75 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={!canPlayAction || isBusy || !hasLegalTargets}
      onClick={() => {
        if (config.kind === "automatic") {
          onPlayAction(action.instanceId);
          return;
        }

        onSelectAction(action.instanceId);
      }}
      type="button"
    >
      Play Card
    </button>
  );
}

function getTargetChoicesByNobleId(view: PlayerGameView, config: OnlineActionConfig): Map<CardInstanceId, OnlineActionTargetChoice[]> {
  const choicesByNobleId = new Map<CardInstanceId, OnlineActionTargetChoice[]>();

  if (config.kind === "automatic") {
    return choicesByNobleId;
  }

  view.nobleLine.forEach((noble, index) => {
    if (config.kind === "front") {
      if (index > 0) {
        choicesByNobleId.set(noble.instanceId, [
          {
            label: "Front",
            target: { type: "noble", instanceId: noble.instanceId },
          },
        ]);
      }

      return;
    }

    const legalSpaces = config.exact
      ? [config.maxSpaces]
      : Array.from({ length: config.maxSpaces }, (_, distanceIndex) => distanceIndex + 1);
    const choices = legalSpaces.flatMap((spaces) => {
      const toIndex = config.direction === "forward" ? index - spaces : index + spaces;

      if (toIndex < 0 || toIndex >= view.nobleLine.length) {
        return [];
      }

      return [
        {
          label: config.exact ? "Move" : `${spaces}`,
          target: {
            type: "move-noble" as const,
            instanceId: noble.instanceId,
            spaces,
          },
        },
      ];
    });

    if (choices.length > 0) {
      choicesByNobleId.set(noble.instanceId, choices);
    }
  });

  return choicesByNobleId;
}
