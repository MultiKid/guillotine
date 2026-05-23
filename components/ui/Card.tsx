import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-stone-300 bg-white/45 p-4 shadow-sm backdrop-blur-sm ${className}`}
      {...props}
    />
  );
}
