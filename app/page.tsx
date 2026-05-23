import { GameBoard } from "@/components/game/GameBoard";

export default function Home() {
  return (
    <main className="game-page-background min-h-screen p-6 text-stone-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold">Guillotine</h1>
        </header>
        <GameBoard />
      </div>
    </main>
  );
}
