import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CardInstanceId, Player } from "@/lib/game/types";

type ActionHandProps = {
  canPlayActions: boolean;
  player?: Player;
  onPlayAction: (cardId: CardInstanceId) => void;
};

export function ActionHand({ canPlayActions, player, onPlayAction }: ActionHandProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{player ? `${player.name}'s Hand` : "Action Hand"}</h2>
        <span className="text-sm text-stone-600">{canPlayActions ? "May play one action" : "Action already played"}</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {player?.hand.map((action) => (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3" key={action.instanceId}>
            <h3 className="font-semibold">{action.card.name}</h3>
            <p className="mt-1 text-sm text-stone-600">{action.card.description}</p>
            <p className="mt-2 text-xs font-semibold uppercase text-amber-800">Effect: {action.card.effectKey}</p>
            <Button className="mt-3 w-full" disabled={!canPlayActions} onClick={() => onPlayAction(action.instanceId)}>
              Play Card
            </Button>
          </div>
        ))}
        {player && player.hand.length === 0 ? <p className="text-sm text-stone-600">No action cards in hand.</p> : null}
      </div>
    </Card>
  );
}
