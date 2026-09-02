"use client";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[4px] text-[12.5px] font-medium " +
  "transition-colors duration-100 disabled:opacity-40 disabled:pointer-events-none select-none";

const VARIANTS: Record<Variant, string> = {
  // The accent is reserved for the single primary action on a surface.
  primary: "bg-[var(--accent)] text-[#0A0A0B] hover:brightness-110 px-3 h-8 font-semibold",
  outline: "border border-[var(--color-line-strong)] text-[var(--text)] hover:bg-[var(--color-hover)] px-3 h-8",
  ghost:   "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--color-hover)] px-2 h-8",
};

export function Button({
  variant = "outline", className = "", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`${BASE} ${VARIANTS[variant]} ${className}`} />;
}
