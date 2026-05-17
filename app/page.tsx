import { GameBoard } from "@/components/game/GameBoard";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-100 p-6 text-stone-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold">Guillotine Prototype</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-700">
            Phase 1 local pass-and-play prototype using placeholder cards.
          </p>
        </header>
        <GameBoard />
      </div>
    </main>
  );
}
