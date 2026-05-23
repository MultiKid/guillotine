import type { Player, PlayerId } from "@/lib/game/types";

type GameEndScreenProps = {
  players: Player[];
  winnerIds: PlayerId[];
};

type RankedPlayer = Player & {
  rank: number;
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

export function GameEndScreen({ players, winnerIds }: GameEndScreenProps) {
  const rankedPlayers = getRankedPlayers(players);
  const podiumPlayers = rankedPlayers.slice(0, 3);
  const remainingPlayers = rankedPlayers.slice(3);
  const winnerNames = players
    .filter((player) => winnerIds.includes(player.id))
    .map((player) => player.name)
    .join(", ");

  return (
    <section className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-white/35 p-6 shadow-2xl backdrop-blur-sm">
      <Confetti />
      <div className="relative z-10 w-full max-w-5xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-900">Final Scores</p>
        <h1 className="mt-2 text-4xl font-bold text-stone-950">Guillotine</h1>
        <p className="mt-3 text-lg text-stone-800">
          {winnerIds.length > 1 ? "Winners" : "Winner"}: <span className="font-bold">{winnerNames}</span>
        </p>

        <div className="mt-10 grid items-end gap-4 md:grid-cols-3">
          {podiumPlayers.map((player, index) => {
            const style = podiumStyles[index];

            return (
              <div className={`flex flex-col items-center ${style.order}`} key={player.id}>
                <div className={`mb-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${style.tone}`}>
                  <p className="text-sm font-semibold">{style.label}</p>
                  <h2 className="text-xl font-bold">{player.name}</h2>
                  <p className="mt-1 text-2xl font-black">{player.score}</p>
                </div>
                <div className={`flex w-full max-w-56 items-center justify-center rounded-t-lg border border-white/60 bg-stone-900/75 text-white shadow-xl ${style.height}`}>
                  <span className="text-5xl font-black">{style.label}</span>
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
      </div>
    </section>
  );
}

function getRankedPlayers(players: Player[]): RankedPlayer[] {
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
