import { Card } from "@/components/ui/Card";
import type { GameLogEntry } from "@/lib/game/types";

type GameHistoryProps = {
  log: GameLogEntry[];
};

export function GameHistory({ log }: GameHistoryProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Game History</h2>
      <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto text-sm text-stone-700">
        {log.map((entry) => (
          <p key={entry.id}>{entry.message}</p>
        ))}
      </div>
    </Card>
  );
}
