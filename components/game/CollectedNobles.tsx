import { Card } from "@/components/ui/Card";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import { getNoblePointText } from "@/lib/game/scoring";
import type { Player } from "@/lib/game/types";

type CollectedNoblesProps = {
  player?: Player;
};

export function CollectedNobles({ player }: CollectedNoblesProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Collected Nobles</h2>
        <span className="text-sm font-semibold text-stone-700">{player?.score ?? 0} pts</span>
      </div>

      <div className="mt-3 max-h-44 overflow-auto">
        {player && player.collectedNobles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {player.collectedNobles.map((noble) => (
              <div
                className={`rounded-md border px-2 py-1 text-xs text-stone-800 ${getNobleColorStyle(noble.card.colorCategory)}`}
                key={noble.instanceId}
              >
                <span className="font-semibold">{noble.card.name}</span>
                <span className="ml-1 text-stone-700">{getNoblePointText(noble, player)} pts</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-600">No nobles collected yet.</p>
        )}
      </div>
    </Card>
  );
}
