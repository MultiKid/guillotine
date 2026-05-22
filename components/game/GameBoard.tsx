"use client";

import { useReducer, useState } from "react";
import { ActionHand } from "@/components/game/ActionHand";
import { CollectedNobles } from "@/components/game/CollectedNobles";
import { DayTracker } from "@/components/game/DayTracker";
import { GameHistory } from "@/components/game/GameHistory";
import { NobleLine } from "@/components/game/NobleLine";
import { PassTurnScreen } from "@/components/game/PassTurnScreen";
import { PlayerDetailsModal } from "@/components/game/PlayerDetailsModal";
import { PlayerPanel } from "@/components/game/PlayerPanel";
import { PrivateChoicePanel } from "@/components/game/PrivateChoicePanel";
import { LocalGameSetup } from "@/components/setup/LocalGameSetup";
import { Button } from "@/components/ui/Button";
import { CardPreviewModal } from "@/components/ui/CardPreviewModal";
import { createInitialGameState } from "@/lib/game/createGame";
import {
  actionEffectRequiresTarget,
  canApplyActionEffect,
  getActionPlayRestriction,
  getValidActionTargets,
  hasUnpopularJudgeAtFront,
} from "@/lib/game/effects";
import { gameReducer } from "@/lib/game/gameReducer";
import { selectCurrentPlayer } from "@/lib/game/selectors";
import type { ActionCard, ActionTarget, BaseCard, CardInstance, CardInstanceId } from "@/lib/game/types";

export function GameBoard() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const [selectedActionCardId, setSelectedActionCardId] = useState<CardInstanceId | undefined>();
  const [selectedNobleTargetId, setSelectedNobleTargetId] = useState<CardInstanceId | undefined>();
  const [selectedDetailsPlayerId, setSelectedDetailsPlayerId] = useState<string | undefined>();
  const [previewCard, setPreviewCard] = useState<BaseCard | undefined>();
  const currentPlayer = selectCurrentPlayer(state);
  const detailsPlayer = state.players.find((player) => player.id === selectedDetailsPlayerId);
  const canPlayActions =
    state.phase === "playing" &&
    state.turnStep === "playActionOptional" &&
    Boolean(currentPlayer) &&
    !currentPlayer?.skipActionThisTurn;
  const selectedAction = currentPlayer?.hand.find((action) => action.instanceId === selectedActionCardId);
  const validTargets =
    currentPlayer && selectedAction
      ? getValidActionTargets(state, selectedAction.card.effectKey, { playerId: currentPlayer.id })
      : [];

  function playAction(cardId: CardInstanceId, target?: ActionTarget) {
    if (!currentPlayer) {
      return;
    }

    dispatch({ type: "PLAY_ACTION_CARD", playerId: currentPlayer.id, cardId, target });
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
  }

  function canPlayActionCard(action: CardInstance<ActionCard>) {
    if (!currentPlayer) {
      return false;
    }

    if (getActionPlayRestriction(state, action.card.effectKey)) {
      return false;
    }

    if (actionEffectRequiresTarget(action.card.effectKey)) {
      return getValidActionTargets(state, action.card.effectKey, { playerId: currentPlayer.id }).length > 0;
    }

    return canApplyActionEffect(state, action.card.effectKey, { playerId: currentPlayer.id });
  }

  function getActionBlockedReason(action: CardInstance<ActionCard>) {
    return getActionPlayRestriction(state, action.card.effectKey);
  }

  function takeNoble(playerId: string) {
    dispatch({ type: "TAKE_FRONT_NOBLE", playerId });
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
  }

  function discardCallousGuards(cardId: CardInstanceId) {
    if (!currentPlayer) {
      return;
    }

    dispatch({ type: "DISCARD_CALLOUS_GUARDS", playerId: currentPlayer.id, cardId });
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
  }

  function undo() {
    dispatch({ type: "UNDO_LAST_ACTION" });
    setSelectedActionCardId(undefined);
    setSelectedNobleTargetId(undefined);
  }

  function resolveInfighting(playerId: string, cardIds: CardInstanceId[]) {
    dispatch({ type: "RESOLVE_INFIGHTING", playerId, cardIds });
  }

  function resolveClericalErrorReturn(playerId: string, nobleId?: CardInstanceId) {
    dispatch({ type: "RESOLVE_CLERICAL_ERROR_RETURN", playerId, nobleId });
  }

  function resolveInnocentVictimDiscard(playerId: string, cardId?: CardInstanceId) {
    dispatch({ type: "RESOLVE_INNOCENT_VICTIM_DISCARD", playerId, cardId });
  }

  function resolveClownGift(playerId: string, targetPlayerId: string) {
    dispatch({ type: "RESOLVE_CLOWN_GIFT", playerId, targetPlayerId });
  }

  if (state.phase === "setup") {
    return <LocalGameSetup onStartGame={(playerNames) => dispatch({ type: "START_GAME", playerNames })} />;
  }

  if (state.passScreen.visible && state.phase === "playing") {
    const pendingTargetPlayerId = state.pendingChoice?.targetPlayerId;
    const nextPlayer = pendingTargetPlayerId
      ? state.players.find((player) => player.id === pendingTargetPlayerId)
      : currentPlayer;

    return (
      <PassTurnScreen
        nextPlayer={nextPlayer}
        onReady={() => dispatch({ type: "READY_FOR_TURN" })}
      />
    );
  }

  if (state.pendingChoice && state.phase === "playing") {
    return (
      <PrivateChoicePanel
        pendingChoice={state.pendingChoice}
        players={state.players}
        onResolveInfighting={resolveInfighting}
        onResolveClericalErrorReturn={resolveClericalErrorReturn}
        onResolveInnocentVictimDiscard={resolveInnocentVictimDiscard}
        onResolveClownGift={resolveClownGift}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {state.notice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
          <div className="max-w-md rounded-lg border border-stone-300 bg-white p-5 text-center shadow-xl">
            <h2 className="text-lg font-bold text-stone-950">Notice</h2>
            <p className="mt-2 text-sm text-stone-700">{state.notice}</p>
            <Button className="mt-4" onClick={() => dispatch({ type: "DISMISS_NOTICE" })}>
              OK
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
        <div className="grid h-full grid-rows-2 gap-2">
          <DayTracker day={state.day} maxDays={state.maxDays} />
          <div className="rounded-lg border border-stone-300 bg-white p-2 shadow-sm">
            <p className="text-xs text-stone-600">Current Turn</p>
            <h2 className="truncate text-base font-bold">{currentPlayer?.name ?? "No player"}</h2>
            {currentPlayer?.skipActionThisTurn ? (
              <p className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                Rush Job: no action card.
              </p>
            ) : null}
            {hasUnpopularJudgeAtFront(state) ? (
              <p className="mt-2 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-900">
                Unpopular Judge blocks actions.
              </p>
            ) : null}
            {state.turnEffects.endDayAfterTurn ? (
              <p className="mt-2 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-900">
                Day ends after this turn.
              </p>
            ) : null}
            {selectedAction ? (
              <p className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900">
                Targeting {selectedAction.card.name}.
              </p>
            ) : null}
          </div>
        </div>
        <PlayerPanel
          players={state.players}
          currentPlayerId={currentPlayer?.id}
          playerTargets={validTargets.filter((target) => target.target.type === "player")}
          onSelectPlayer={setSelectedDetailsPlayerId}
          onSelectPlayerTarget={(target) => selectedAction && playAction(selectedAction.instanceId, target)}
        />
      </div>

      <NobleLine
        nobles={state.nobleLine.cards}
        selectedNobleTargetId={selectedNobleTargetId}
        validTargets={validTargets}
        onPlayTarget={(target) => selectedAction && playAction(selectedAction.instanceId, target)}
        onPreviewCard={setPreviewCard}
        onSelectNobleTarget={setSelectedNobleTargetId}
      />

      <ActionHand
        canPlayActions={canPlayActions}
        player={currentPlayer}
        selectedActionCardId={selectedActionCardId}
        validTargets={validTargets}
        canPlayActionCard={canPlayActionCard}
        getActionBlockedReason={getActionBlockedReason}
        onSelectAction={(cardId) => {
          setSelectedActionCardId(cardId);
          setSelectedNobleTargetId(undefined);
        }}
        onClearSelection={() => {
          setSelectedActionCardId(undefined);
          setSelectedNobleTargetId(undefined);
        }}
        onPlayAction={playAction}
        onPreviewCard={setPreviewCard}
        canTakeNoble={state.phase === "playing" && Boolean(currentPlayer) && state.nobleLine.cards.length > 0}
        currentPlayerId={currentPlayer?.id}
        onTakeNoble={takeNoble}
      />

      <div className="grid gap-4 lg:grid-cols-[5fr_3fr]">
        <CollectedNobles player={currentPlayer} onPreviewCard={setPreviewCard} />
        <GameHistory log={state.log} />
      </div>
      <PlayerDetailsModal
        canDiscardCallousGuards={
          state.phase === "playing" &&
          state.turnStep === "playActionOptional" &&
          Boolean(currentPlayer) &&
          !currentPlayer?.skipActionThisTurn
        }
        currentPlayerId={currentPlayer?.id}
        onClose={() => setSelectedDetailsPlayerId(undefined)}
        onDiscardCallousGuards={discardCallousGuards}
        onPlayAction={playAction}
        onPreviewCard={setPreviewCard}
        player={detailsPlayer}
        selectedActionCardId={selectedActionCardId}
        validTargets={validTargets}
      />
      <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(undefined)} />
    </section>
  );
}

