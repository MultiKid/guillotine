"use client";

import { useState } from "react";
import { GameBoard } from "@/components/game/GameBoard";
import { OnlineLobby } from "@/components/online/OnlineLobby";
import { GameModeHome } from "@/components/setup/GameModeHome";
import type { GameMode } from "@/lib/game/modes";

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<GameMode | undefined>();

  return (
    <main className="game-page-background min-h-screen p-6 text-stone-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold">Guillotine</h1>
        </header>
        {selectedMode === "online" ? (
          <OnlineLobby onBackToHome={() => setSelectedMode(undefined)} />
        ) : selectedMode ? (
          <GameBoard mode={selectedMode} onBackToHome={() => setSelectedMode(undefined)} />
        ) : (
          <GameModeHome onSelectMode={setSelectedMode} />
        )}
      </div>
    </main>
  );
}
