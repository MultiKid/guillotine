import { Card } from "@/components/ui/Card";
import type { PlayerId, Player } from "@/lib/game/types";

type ScorePanelProps = {
  players: Player[];
  winnerIds: PlayerId[];
};

export function ScorePanel({ players, winnerIds }: ScorePanelProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Scores</h2>
      <div className="mt-3 flex flex-col gap-2">
        {players.map((player) => {
          const isWinner = winnerIds.includes(player.id);

          return (
            <div className="flex items-center justify-between gap-3 text-sm" key={player.id}>
              <span className={isWinner ? "font-semibold" : undefined}>{player.name}</span>
              <span className="font-semibold">{player.score}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
