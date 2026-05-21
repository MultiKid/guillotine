import { Card } from "@/components/ui/Card";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import type { PlayerId, Player } from "@/lib/game/types";

type PlayerPanelProps = {
  players: Player[];
  currentPlayerId?: PlayerId;
};

export function PlayerPanel({ players, currentPlayerId }: PlayerPanelProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Players</h2>
      <div className="mt-3 flex flex-col gap-3">
        {players.map((player) => (
          <div
            className={`rounded-md border p-3 ${
              player.id === currentPlayerId ? "border-stone-900 bg-stone-100" : "border-stone-300 bg-white"
            }`}
            key={player.id}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{player.name}</h3>
              <span className="text-sm font-semibold">{player.score} pts</span>
            </div>
            <p className="mt-1 text-sm text-stone-600">
              {player.hand.length} cards in hand, {player.collectedNobles.length} nobles collected
            </p>
            {player.collectedNobles.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {player.collectedNobles.slice(-6).map((noble) => (
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-medium text-stone-800 ${getNobleColorStyle(noble.card.colorCategory)}`}
                    key={noble.instanceId}
                  >
                    {noble.card.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
