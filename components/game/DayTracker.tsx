import { Card } from "@/components/ui/Card";

type DayTrackerProps = {
  day: number;
  maxDays: number;
};

export function DayTracker({ day, maxDays }: DayTrackerProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Day {day} of {maxDays}</h2>
      <p className="mt-2 text-sm text-stone-600">The first playable loop keeps the game on Day 1.</p>
    </Card>
  );
}
