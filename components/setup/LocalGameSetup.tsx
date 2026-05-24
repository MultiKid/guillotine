"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/game/constants";
import type { GameModeConfig } from "@/lib/game/modes";

type LocalGameSetupProps = {
  modeConfig?: GameModeConfig;
  onBackToHome?: () => void;
  onStartGame: (playerNames: string[]) => void;
};

export function LocalGameSetup({ modeConfig, onBackToHome, onStartGame }: LocalGameSetupProps) {
  const [playerNames, setPlayerNames] = useState(["Player 1", "Player 2"]);
  const cleanedNames = playerNames.map((name) => name.trim()).filter(Boolean);
  const canStart = cleanedNames.length >= MIN_PLAYERS && cleanedNames.length <= MAX_PLAYERS;

  function updatePlayerName(index: number, name: string) {
    setPlayerNames((currentNames) =>
      currentNames.map((currentName, currentIndex) => (currentIndex === index ? name : currentName)),
    );
  }

  function addPlayer() {
    if (playerNames.length >= MAX_PLAYERS) {
      return;
    }

    setPlayerNames((currentNames) => [...currentNames, `Player ${currentNames.length + 1}`]);
  }

  function removePlayer(index: number) {
    if (playerNames.length <= MIN_PLAYERS) {
      return;
    }

    setPlayerNames((currentNames) => currentNames.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{modeConfig?.setupTitle ?? "Local Game Setup"}</h2>
              <p className="text-sm text-stone-600">
                {modeConfig?.setupDescription ?? "Enter 2-5 players for one-computer pass-and-play."}
              </p>
            </div>
            {modeConfig ? (
              <span className="rounded-full bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-950">
                {modeConfig.badge}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playerNames.map((name, index) => (
            <label className="flex flex-col gap-1 text-sm font-medium text-stone-700" key={`player-name-${index}`}>
              Player {index + 1}
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white/45 px-3 py-2 text-stone-950 outline-none backdrop-blur-sm focus:border-stone-500"
                  value={name}
                  onChange={(event) => updatePlayerName(index, event.target.value)}
                />
                <Button
                  aria-label={`Remove player ${index + 1}`}
                  disabled={playerNames.length <= MIN_PLAYERS}
                  onClick={() => removePlayer(index)}
                >
                  Remove
                </Button>
              </div>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {onBackToHome ? <Button onClick={onBackToHome}>Back</Button> : null}
          <Button disabled={playerNames.length >= MAX_PLAYERS} onClick={addPlayer}>
            Add Player
          </Button>
          <Button disabled={!canStart} onClick={() => onStartGame(cleanedNames)}>
            Start Game
          </Button>
        </div>
      </div>
    </Card>
  );
}
