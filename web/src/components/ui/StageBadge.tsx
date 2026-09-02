import type { DeliveryStage } from "@/types/telemetry";

const TONE: Record<DeliveryStage, string> = {
  queued:    "var(--color-state-queued)",
  sent:      "var(--color-state-sent)",
  delivered: "var(--color-state-delivered)",
  opened:    "var(--color-state-opened)",
  clicked:   "var(--color-state-clicked)",
  bounced:   "var(--color-state-bounced)",
};

/** Stage is carried by a dot plus the label, never colour alone — the palette
 *  has to survive a colour-blind reader and a greyscale print. */
export function StageBadge({ stage }: { stage: DeliveryStage }) {
  return (
    <span
      className="mono inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em]"
      style={{ color: TONE[stage] }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[stage] }} />
      {stage}
    </span>
  );
}
