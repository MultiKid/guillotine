import { Card } from "@/components/ui/Card";
import type { PlayerId, Player } from "@/lib/game/types";

type PlayerPanelProps = {
  players: Player[];
  currentPlayerId?: PlayerId;
  onSelectPlayer?: (playerId: PlayerId) => void;
};

export function PlayerPanel({ players, currentPlayerId, onSelectPlayer }: PlayerPanelProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Players</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {players.map((player) => {
          const isCurrentPlayer = player.id === currentPlayerId;

          return (
            <button
              className={`rounded-md border p-2 text-left transition ${
                isCurrentPlayer
                  ? "cursor-default border-stone-900 bg-stone-100"
                  : "border-stone-300 bg-white hover:border-stone-900 hover:bg-stone-50"
              }`}
              disabled={isCurrentPlayer}
              key={player.id}
              onClick={() => onSelectPlayer?.(player.id)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-semibold">{player.name}</h3>
                <span className="text-sm font-semibold">{player.score} pts</span>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                {player.hand.length} hand, {player.collectedNobles.length} nobles, {player.inFrontActions.length} in front
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
