"use client";

import { useReducer } from "react";
import { ActionHand } from "@/components/game/ActionHand";
import { DayTracker } from "@/components/game/DayTracker";
import { GameHistory } from "@/components/game/GameHistory";
import { NobleLine } from "@/components/game/NobleLine";
import { PlayerPanel } from "@/components/game/PlayerPanel";
import { ScorePanel } from "@/components/game/ScorePanel";
import { TurnControls } from "@/components/game/TurnControls";
import { LocalGameSetup } from "@/components/setup/LocalGameSetup";
import { createInitialGameState } from "@/lib/game/createGame";
import { gameReducer } from "@/lib/game/gameReducer";
import { selectCurrentPlayer } from "@/lib/game/selectors";

export function GameBoard() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const currentPlayer = selectCurrentPlayer(state);

  if (state.phase === "setup") {
    return <LocalGameSetup onStartGame={(playerNames) => dispatch({ type: "START_GAME", playerNames })} />;
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
        </div>
        <NobleLine nobles={state.nobleLine.cards} />
        <ActionHand player={currentPlayer} />
        <TurnControls
          canTakeNoble={state.phase === "playing" && Boolean(currentPlayer) && state.nobleLine.cards.length > 0}
          canUndo={state.gameHistory.length > 0}
          currentPlayerId={currentPlayer?.id}
          onTakeNoble={(playerId) => dispatch({ type: "TAKE_FRONT_NOBLE", playerId })}
          onUndo={() => dispatch({ type: "UNDO_LAST_ACTION" })}
        />
      </div>
      <PlayerPanel players={state.players} currentPlayerId={currentPlayer?.id} />
    </section>
  );
}
