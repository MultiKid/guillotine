import { Button } from "@/components/ui/Button";
import type { Player } from "@/lib/game/types";

type PassTurnScreenProps = {
  nextPlayer?: Player;
  onReady: () => void;
};

export function PassTurnScreen({ nextPlayer, onReady }: PassTurnScreenProps) {
  return (
    <section className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-stone-950 px-6 text-white transition-opacity duration-200">
      <div className="w-full max-w-lg rounded-lg border border-stone-700 bg-stone-900 p-8 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-300">Pass and play</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight">
          Pass the laptop to {nextPlayer?.name ?? "the next player"}
        </h1>
        <p className="mt-3 text-sm text-stone-300">
          The next hand is hidden until the player is ready.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button className="border-amber-300 bg-amber-200 text-stone-950 hover:bg-amber-100" onClick={onReady}>
            Start Turn
          </Button>
        </div>
      </div>
    </section>
  );
}
