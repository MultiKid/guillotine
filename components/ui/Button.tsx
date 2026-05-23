import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-md border border-stone-300 bg-white/50 px-3 py-2 text-sm font-medium text-stone-900 shadow-sm backdrop-blur-sm transition hover:bg-stone-50/65 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
