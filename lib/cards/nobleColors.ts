import type { NobleColorCategory } from "@/lib/game/types";

export const nobleColorStyles: Record<NobleColorCategory, string> = {
  blue: "border-blue-300/80 bg-blue-500/[0.15] shadow-[0_0_18px_rgba(59,130,246,0.12)]",
  red: "border-red-300/80 bg-red-500/[0.15] shadow-[0_0_18px_rgba(239,68,68,0.12)]",
  green: "border-green-300/80 bg-green-500/[0.15] shadow-[0_0_18px_rgba(34,197,94,0.12)]",
  purple: "border-purple-300/80 bg-purple-500/[0.15] shadow-[0_0_18px_rgba(168,85,247,0.12)]",
  gray: "border-gray-300/80 bg-gray-500/[0.15] shadow-[0_0_18px_rgba(107,114,128,0.12)]",
};

export const selectedNobleColorStyle = "border-amber-600 bg-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.18)]";

export function getNobleColorStyle(category: NobleColorCategory): string {
  return nobleColorStyles[category];
}
