import { Card } from "@/components/ui/Card";
import { CardImage } from "@/components/ui/CardImage";
import { getNobleColorStyle } from "@/lib/cards/nobleColors";
import { getNoblePointText } from "@/lib/game/scoring";
import type { Player } from "@/lib/game/types";

type CollectedNoblesProps = {
  player?: Player;
  onPreviewCard?: (card: Player["collectedNobles"][number]["card"]) => void;
};

export function CollectedNobles({ player, onPreviewCard }: CollectedNoblesProps) {
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
                className={`flex w-24 flex-col rounded-md border p-1 text-xs text-stone-800 ${getNobleColorStyle(noble.card.colorCategory)}`}
                key={noble.instanceId}
              >
                <CardImage
                  alt={noble.card.name}
                  className="cursor-pointer"
                  imageClassName="aspect-[5/7] border border-stone-200"
                  imagePath={noble.card.imagePath}
                  onClick={() => onPreviewCard?.(noble.card)}
                >
                  <div className="min-h-12 rounded bg-white/60 p-1">
                    <span className="font-semibold">{noble.card.name}</span>
                  </div>
                </CardImage>
                <span className="mt-1 truncate font-semibold">{noble.card.name}</span>
                <span className="text-stone-700">{getNoblePointText(noble, player)} pts</span>
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
