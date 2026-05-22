import { Card } from "@/components/ui/Card";
import type { PlayerId, Player } from "@/lib/game/types";

type PlayerPanelProps = {
  players: Player[];
  currentPlayerId?: PlayerId;
};

export function PlayerPanel({ players, currentPlayerId }: PlayerPanelProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Players</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {players.map((player) => (
          <div
            className={`rounded-md border p-2 ${
              player.id === currentPlayerId ? "border-stone-900 bg-stone-100" : "border-stone-300 bg-white"
            }`}
            key={player.id}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold">{player.name}</h3>
              <span className="text-sm font-semibold">{player.score} pts</span>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              {player.hand.length} hand, {player.collectedNobles.length} nobles
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
