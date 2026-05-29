import type { PlayerId, TurnTimingState } from "@/lib/game/types";

type GameEndPlayer = {
  id: PlayerId;
  name: string;
  score: number;
};

type GameEndScreenProps = {
  onBackToBoard?: () => void;
  onRequestRematch?: () => void;
  players: GameEndPlayer[];
  rematchPlayerIds?: PlayerId[];
  turnTiming?: TurnTimingState;
  viewerPlayerId?: PlayerId;
  winnerIds: PlayerId[];
};

type RankedPlayer = GameEndPlayer & {
  rank: number;
};

type TurnSpeedPlayer = GameEndPlayer & {
  averageMs: number;
  displayAverage: string;
  speedRank: number;
  turnCount: number;
};

const podiumStyles = [
  {
    label: "1st",
    height: "h-44",
    order: "md:order-2",
    tone: "border-amber-300 bg-amber-100/70 text-amber-950",
  },
  {
    label: "2nd",
    height: "h-36",
    order: "md:order-1",
    tone: "border-slate-300 bg-slate-100/70 text-slate-950",
  },
  {
    label: "3rd",
    height: "h-28",
    order: "md:order-3",
    tone: "border-orange-300 bg-orange-100/70 text-orange-950",
  },
];

export function GameEndScreen({
  onBackToBoard,
  onRequestRematch,
  players,
  rematchPlayerIds = [],
  turnTiming,
  viewerPlayerId,
}: GameEndScreenProps) {
  const rankedPlayers = getRankedPlayers(players);
  const podiumPlayers = rankedPlayers.filter((player) => player.rank <= 3);
  const remainingPlayers = rankedPlayers.filter((player) => player.rank > 3);
  const turnSpeedPlayers = getTurnSpeedPlayers(players, turnTiming);
  const viewerRequestedRematch = Boolean(viewerPlayerId && rematchPlayerIds.includes(viewerPlayerId));

  return (
    <section className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-white/35 p-6 shadow-2xl backdrop-blur-sm">
      <Confetti />
      {onBackToBoard ? (
        <button
          className="absolute left-4 top-4 z-20 rounded-md border border-stone-300 bg-white/55 px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-white/75"
          onClick={onBackToBoard}
          type="button"
        >
          Back
        </button>
      ) : null}
      <div className="relative z-10 w-full max-w-5xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-900">Final Scores</p>
        {onRequestRematch ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              className="rounded-md border border-amber-400 bg-amber-100/70 px-4 py-2 text-sm font-bold text-amber-950 shadow-sm transition hover:bg-amber-200/80 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={viewerRequestedRematch}
              onClick={onRequestRematch}
              type="button"
            >
              {viewerRequestedRematch ? "Rematch Requested" : "Rematch"}
            </button>
            <p className="text-xs font-medium text-stone-700">
              {rematchPlayerIds.length}/{players.length} players ready
            </p>
          </div>
        ) : null}

        <div
          className="mt-10 grid items-end gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, podiumPlayers.length)}, minmax(0, 1fr))`,
          }}
        >
          {podiumPlayers.map((player) => {
            const style = podiumStyles[Math.min(player.rank - 1, podiumStyles.length - 1)];
            const rankLabel = getOrdinalRank(player.rank);

            return (
              <div className="flex flex-col items-center" key={player.id}>
                <div className={`mb-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${style.tone}`}>
                  <p className="text-sm font-semibold">{rankLabel}</p>
                  <h2 className="text-xl font-bold">{player.name}</h2>
                  <p className="mt-1 text-2xl font-black">{player.score}</p>
                </div>
                <div className={`flex w-full max-w-56 items-center justify-center rounded-t-lg border border-white/60 bg-stone-900/75 text-white shadow-xl ${style.height}`}>
                  <span className="text-5xl font-black">{rankLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {remainingPlayers.length > 0 ? (
          <div className="mx-auto mt-8 grid max-w-2xl gap-2">
            {remainingPlayers.map((player) => (
              <div className="flex items-center justify-between rounded-md border border-white/50 bg-white/45 px-4 py-3 text-left shadow-sm backdrop-blur-sm" key={player.id}>
                <span className="font-semibold text-stone-800">
                  {player.rank}. {player.name}
                </span>
                <span className="font-bold text-stone-950">{player.score}</span>
              </div>
            ))}
          </div>
        ) : null}

        {turnSpeedPlayers.length > 0 ? (
          <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-white/50 bg-white/45 p-4 text-left shadow-sm backdrop-blur-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-stone-950">Fastest Turns</h2>
                <p className="text-sm text-stone-700">Average time per turn.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {turnSpeedPlayers.map((player) => (
                <div
                  className="flex items-center justify-between rounded-md border border-white/50 bg-white/45 px-4 py-3 shadow-sm backdrop-blur-sm"
                  key={player.id}
                >
                  <span className="font-semibold text-stone-800">
                    {player.speedRank}. {player.name}
                  </span>
                  <span className="text-right font-bold text-stone-950">
                    {player.displayAverage} avg
                    <span className="ml-2 text-xs font-medium text-stone-600">
                      {player.turnCount} {player.turnCount === 1 ? "turn" : "turns"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function getRankedPlayers(players: GameEndPlayer[]): RankedPlayer[] {
  const sortedPlayers = [...players].sort((first, second) => second.score - first.score || first.name.localeCompare(second.name));
  let previousScore: number | undefined;
  let previousRank = 0;

  return sortedPlayers.map((player, index) => {
    const rank = player.score === previousScore ? previousRank : index + 1;
    previousScore = player.score;
    previousRank = rank;

    return {
      ...player,
      rank,
    };
  });
}

function getTurnSpeedPlayers(players: GameEndPlayer[], turnTiming?: TurnTimingState): TurnSpeedPlayer[] {
  if (!turnTiming) {
    return [];
  }

  const sortedPlayers = [...players]
    .map((player) => {
      const stats = turnTiming.playerStats[player.id] ?? { totalMs: 0, turnCount: 0 };

      return {
        ...player,
        averageMs: stats.turnCount > 0 ? stats.totalMs / stats.turnCount : Number.POSITIVE_INFINITY,
        displayAverage: "",
        speedRank: 0,
        turnCount: stats.turnCount,
      };
    })
    .sort((first, second) => {
      if (first.averageMs !== second.averageMs) {
        return first.averageMs - second.averageMs;
      }

      return first.name.localeCompare(second.name);
    })
    .map((player, index, sorted) => {
      const previousPlayer = sorted[index - 1];
      const speedRank = previousPlayer && player.averageMs === previousPlayer.averageMs ? previousPlayer.speedRank : index + 1;

      return {
        ...player,
        speedRank,
      };
    });
  const precision = getNeededTurnDurationPrecision(sortedPlayers);

  return sortedPlayers.map((player) => ({
    ...player,
    displayAverage: formatTurnDuration(player.averageMs, precision),
  }));
}

function getNeededTurnDurationPrecision(players: Pick<TurnSpeedPlayer, "averageMs">[]): number {
  const finiteAverages = players
    .map((player) => player.averageMs)
    .filter((averageMs) => Number.isFinite(averageMs));

  for (let precision = 0; precision <= 3; precision += 1) {
    const labels = finiteAverages.map((averageMs) => formatTurnDuration(averageMs, precision));

    if (new Set(labels).size === labels.length) {
      return precision;
    }
  }

  return 3;
}

function formatTurnDuration(milliseconds: number, precision = 0): string {
  if (!Number.isFinite(milliseconds)) {
    return "--:--";
  }

  const rawTotalSeconds = milliseconds / 1000;
  const factor = 10 ** precision;
  const totalSeconds = precision > 0 ? Math.round(rawTotalSeconds * factor) / factor : Math.floor(rawTotalSeconds);
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const secondsInMinute = totalSeconds - wholeMinutes * 60;
  const secondsText =
    precision > 0
      ? secondsInMinute.toFixed(precision).padStart(3 + precision, "0")
      : String(Math.floor(secondsInMinute)).padStart(2, "0");

  return `${wholeMinutes}:${secondsText}`;
}

function getOrdinalRank(rank: number): string {
  const lastTwoDigits = rank % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${rank}th`;
  }

  if (rank % 10 === 1) {
    return `${rank}st`;
  }

  if (rank % 10 === 2) {
    return `${rank}nd`;
  }

  if (rank % 10 === 3) {
    return `${rank}rd`;
  }

  return `${rank}th`;
}

function Confetti() {
  const pieces = Array.from({ length: 42 }, (_, index) => ({
    delay: `${(index % 12) * 0.18}s`,
    duration: `${3.2 + (index % 5) * 0.35}s`,
    left: `${(index * 17) % 100}%`,
    rotate: `${(index * 37) % 180}deg`,
    tone: ["bg-amber-400", "bg-rose-400", "bg-sky-400", "bg-emerald-400", "bg-violet-400"][index % 5],
  }));

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece, index) => (
        <span
          className={`absolute -top-8 h-3 w-1.5 rounded-sm opacity-75 ${piece.tone} animate-confettiFall`}
          key={index}
          style={{
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            left: piece.left,
            transform: `rotate(${piece.rotate})`,
          }}
        />
      ))}
    </div>
  );
}
