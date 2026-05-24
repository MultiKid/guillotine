"use client";

import { Card } from "@/components/ui/Card";
import { GAME_MODE_CONFIGS } from "@/lib/game/modes";
import type { GameMode } from "@/lib/game/modes";

type GameModeHomeProps = {
  onSelectMode: (mode: GameMode) => void;
};

export function GameModeHome({ onSelectMode }: GameModeHomeProps) {
  return (
    <Card className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold">Choose Game Mode</h2>
          <p className="mt-1 text-sm text-stone-700">
            Play on one computer or start an online room for separate devices.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {GAME_MODE_CONFIGS.map((mode) => (
            <button
              className="flex min-h-44 flex-col justify-between rounded-lg border border-stone-300 bg-white/35 p-4 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/55 focus:outline-none focus:ring-2 focus:ring-amber-500"
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              type="button"
            >
              <span>
                <span className="text-lg font-bold text-stone-950">{mode.title}</span>
                <span className="mt-2 block rounded-full bg-amber-100/70 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-950">
                  {mode.badge}
                </span>
                <span className="mt-3 block text-sm text-stone-700">{mode.setupDescription}</span>
              </span>
              <span className="mt-4">
                <span className="block w-full rounded-md border border-stone-300 bg-white/60 px-3 py-2 text-center text-sm font-medium text-stone-900 shadow-sm">
                  {mode.buttonLabel}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
