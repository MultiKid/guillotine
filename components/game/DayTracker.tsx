import { Card } from "@/components/ui/Card";

type DayTrackerProps = {
  day: number;
  maxDays: number;
};

export function DayTracker({ day, maxDays }: DayTrackerProps) {
  return (
    <Card className="flex h-full items-center p-2">
      <h2 className="text-sm font-semibold">Day {day} of {maxDays}</h2>
    </Card>
  );
}
