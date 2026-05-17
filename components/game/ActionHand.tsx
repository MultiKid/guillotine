import { Card } from "@/components/ui/Card";
import type { Player } from "@/lib/game/types";

type ActionHandProps = {
  player?: Player;
};

export function ActionHand({ player }: ActionHandProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">{player ? `${player.name}'s Hand` : "Action Hand"}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {player?.hand.map((action) => (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3" key={action.instanceId}>
            <h3 className="font-semibold">{action.card.name}</h3>
            <p className="mt-1 text-sm text-stone-600">{action.card.description}</p>
            <p className="mt-2 text-xs font-semibold uppercase text-amber-800">Effect: {action.card.effectKey}</p>
          </div>
        ))}
        {player && player.hand.length === 0 ? <p className="text-sm text-stone-600">No action cards in hand.</p> : null}
      </div>
    </Card>
  );
}
