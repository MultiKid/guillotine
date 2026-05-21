"use client";

import { useReducer, useState } from "react";
import { ActionHand } from "@/components/game/ActionHand";
import { DayTracker } from "@/components/game/DayTracker";
import { GameHistory } from "@/components/game/GameHistory";
import { NobleLine } from "@/components/game/NobleLine";
import { PassTurnScreen } from "@/components/game/PassTurnScreen";
import { PlayerPanel } from "@/components/game/PlayerPanel";
import { ScorePanel } from "@/components/game/ScorePanel";
import { TurnControls } from "@/components/game/TurnControls";
import { LocalGameSetup } from "@/components/setup/LocalGameSetup";
import { createInitialGameState } from "@/lib/game/createGame";
import { actionEffectRequiresTarget, canApplyActionEffect, getValidActionTargets } from "@/lib/game/effects";
import { gameReducer } from "@/lib/game/gameReducer";
import { selectCurrentPlayer } from "@/lib/game/selectors";
import type { ActionCard, ActionTarget, CardInstance, CardInstanceId } from "@/lib/game/types";

export function GameBoard() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const [selectedActionCardId, setSelectedActionCardId] = useState<CardInstanceId | undefined>();
  const currentPlayer = selectCurrentPlayer(state);
  const canPlayActions = state.phase === "playing" && state.turnStep === "playActionOptional" && Boolean(currentPlayer);
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
  }

  function canPlayActionCard(action: CardInstance<ActionCard>) {
    if (!currentPlayer) {
      return false;
    }

    if (actionEffectRequiresTarget(action.card.effectKey)) {
      return getValidActionTargets(state, action.card.effectKey, { playerId: currentPlayer.id }).length > 0;
    }

    return canApplyActionEffect(state, action.card.effectKey, { playerId: currentPlayer.id });
  }

  function takeNoble(playerId: string) {
    dispatch({ type: "TAKE_FRONT_NOBLE", playerId });
    setSelectedActionCardId(undefined);
  }

  function reloadTestHand() {
    if (!currentPlayer) {
      return;
    }

    dispatch({ type: "RELOAD_TEST_HAND", playerId: currentPlayer.id });
    setSelectedActionCardId(undefined);
  }

  function undo() {
    dispatch({ type: "UNDO_LAST_ACTION" });
    setSelectedActionCardId(undefined);
  }

  if (state.phase === "setup") {
    return <LocalGameSetup onStartGame={(playerNames) => dispatch({ type: "START_GAME", playerNames })} />;
  }

  if (state.passScreen.visible && state.phase === "playing") {
    return (
      <PassTurnScreen
        nextPlayer={currentPlayer}
        canUndo={state.gameHistory.length > 0}
        onReady={() => dispatch({ type: "READY_FOR_TURN" })}
        onUndo={undo}
      />
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_1fr_280px]">
      <div className="flex flex-col gap-4">
        <DayTracker day={state.day} maxDays={state.maxDays} />
        <ScorePanel players={state.players} winnerIds={state.winnerIds} />
        <GameHistory log={state.log} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-stone-300 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-600">Current Turn</p>
          <h2 className="text-2xl font-bold">{currentPlayer?.name ?? "No player"}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {state.turnStep === "playActionOptional" ? "May play one action, then take a noble." : "Must take the front noble."}
          </p>
          {state.turnEffects.endDayAfterTurn ? (
            <p className="mt-2 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-900">
              Scarlet Pimpernel is active: this day will end after this turn.
            </p>
          ) : null}
          {selectedAction ? (
            <p className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
              Selecting a target for {selectedAction.card.name}.
            </p>
          ) : null}
        </div>
        <NobleLine nobles={state.nobleLine.cards} validTargets={validTargets} />
        <ActionHand
          canPlayActions={canPlayActions}
          player={currentPlayer}
          selectedActionCardId={selectedActionCardId}
          validTargets={validTargets}
          canPlayActionCard={canPlayActionCard}
          onSelectAction={setSelectedActionCardId}
          onPlayAction={playAction}
          onReloadTestHand={reloadTestHand}
        />
        <TurnControls
          canTakeNoble={state.phase === "playing" && Boolean(currentPlayer) && state.nobleLine.cards.length > 0}
          canUndo={state.gameHistory.length > 0}
          currentPlayerId={currentPlayer?.id}
          turnStep={state.turnStep}
          onTakeNoble={takeNoble}
          onUndo={undo}
        />
      </div>
      <PlayerPanel players={state.players} currentPlayerId={currentPlayer?.id} />
    </section>
  );
}

