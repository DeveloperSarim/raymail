import type { EmailAddress } from "@/types/mail";
import { displayName, initials } from "@/lib/format";

/* Deterministic colour per sender, the way Gmail does it: the same person is
 * always the same colour, which makes a list scannable without reading it.
 * Hues are picked from a fixed set rather than a raw hash so every one of them
 * clears contrast against white text. */
const HUES = [
  "#C5372C", "#B8541A", "#8A5A0B", "#2E7D4F",
  "#1F6F8B", "#3B5BC4", "#6B4BA8", "#A8367F",
];

function hueFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length] ?? HUES[0]!;
}

export function Avatar({
  person, size = 36,
}: { person: EmailAddress | undefined; size?: number }) {
  const seed = person?.email ?? "unknown";
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-medium text-white select-none"
      style={{
        width: size, height: size,
        background: hueFor(seed),
        fontSize: Math.round(size * 0.4),
      }}
      title={displayName(person)}
    >
      {initials(person)}
    </span>
  );
}
