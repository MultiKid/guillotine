import { Card } from "@/components/ui/Card";
import type { CardInstance, NobleCard } from "@/lib/game/types";
import type { ValidActionTarget } from "@/lib/game/effects";

type NobleLineProps = {
  nobles: CardInstance<NobleCard>[];
  validTargets?: ValidActionTarget[];
};

export function NobleLine({ nobles, validTargets = [] }: NobleLineProps) {
  const highlightedNobleIds = new Set(validTargets.map((target) => "instanceId" in target.target ? target.target.instanceId : ""));

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Noble Line</h2>
        <span className="text-sm text-stone-600">Front noble is on the left</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {nobles.map((noble, index) => {
          const isValidTarget = highlightedNobleIds.has(noble.instanceId);

          return (
            <div
              className={`rounded-md border p-3 ${
                isValidTarget ? "border-amber-600 bg-amber-100" : "border-stone-300 bg-stone-50"
              }`}
              key={noble.instanceId}
            >
              <div className="text-xs font-semibold uppercase text-stone-500">Position {index + 1}</div>
              <h3 className="mt-1 font-semibold">{noble.card.name}</h3>
              <p className="text-sm text-stone-600">{noble.card.points} points</p>
              {isValidTarget ? <p className="mt-2 text-xs font-semibold text-amber-800">Valid target</p> : null}
            </div>
          );
        })}
        {nobles.length === 0 ? <p className="text-sm text-stone-600">No nobles remain.</p> : null}
      </div>
    </Card>
  );
}

