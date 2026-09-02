"use client";

import type { DeliveryStage } from "@/types/telemetry";

/* Hand-drawn SVG rather than a charting dependency. There are two charts in the
 * whole product and a library would outweigh both of them. */

export function MetricTile({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--faint)]">{label}</div>
      <div className="mono text-[26px] leading-none" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="mt-2 text-[12px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

const STAGE_TONE: Record<string, string> = {
  sent: "var(--color-state-sent)",
  delivered: "var(--color-state-delivered)",
  opened: "var(--color-state-opened)",
  clicked: "var(--color-state-clicked)",
};

/** Delivery funnel. Each bar is a share of what was sent, so the drop between
 *  stages is the thing you actually read. */
export function Funnel({
  sent, delivered, opened, clicked,
}: { sent: number; delivered: number; opened: number; clicked: number }) {
  const rows: { stage: DeliveryStage; n: number }[] = [
    { stage: "sent", n: sent },
    { stage: "delivered", n: delivered },
    { stage: "opened", n: opened },
    { stage: "clicked", n: clicked },
  ];
  const base = Math.max(1, sent);

  return (
    <div className="space-y-3 p-4">
      {rows.map((r) => {
        const pct = (r.n / base) * 100;
        return (
          <div key={r.stage}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] capitalize text-[var(--text)]">{r.stage}</span>
              <span className="mono text-[12px] text-[var(--muted)]">
                {r.n} <span className="text-[var(--faint)]">({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-hover)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(pct, r.n > 0 ? 2 : 0)}%`, background: STAGE_TONE[r.stage] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Daily opens and clicks. Grouped bars, labelled, with a real empty state. */
export function Engagement({ daily }: { daily: { day: string; type: string; n: number }[] }) {
  const days = [...new Set(daily.map((d) => d.day))].sort();
  const opens = days.map((d) => daily.find((x) => x.day === d && x.type === "open")?.n ?? 0);
  const clicks = days.map((d) => daily.find((x) => x.day === d && x.type === "click")?.n ?? 0);
  const peak = Math.max(1, ...opens, ...clicks);

  if (days.length === 0) {
    return (
      <div className="grid h-[180px] place-items-center px-4 text-center">
        <p className="text-[13px] text-[var(--muted)]">
          No opens or clicks recorded yet.
          <br />
          <span className="text-[var(--faint)]">They appear here as recipients engage.</span>
        </p>
      </div>
    );
  }

  return (
    <figure className="m-0 p-4">
      <figcaption className="mb-4 flex flex-wrap items-center gap-4 text-[12px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-state-opened)" }} /> Opens
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-state-clicked)" }} /> Clicks
        </span>
        <span className="ml-auto text-[var(--faint)]">peak {peak}/day</span>
      </figcaption>

      <div className="flex h-[150px] items-end gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <div key={d} className="group flex min-w-[16px] flex-1 flex-col items-center gap-1">
            <div className="flex h-[130px] w-full items-end justify-center gap-[2px]">
              <div
                className="w-1/2 rounded-t-sm transition-all"
                style={{ height: `${((opens[i] ?? 0) / peak) * 100}%`, background: "var(--color-state-opened)", minHeight: opens[i] ? 3 : 0 }}
                title={`${d}: ${opens[i] ?? 0} opens`}
              />
              <div
                className="w-1/2 rounded-t-sm transition-all"
                style={{ height: `${((clicks[i] ?? 0) / peak) * 100}%`, background: "var(--color-state-clicked)", minHeight: clicks[i] ? 3 : 0 }}
                title={`${d}: ${clicks[i] ?? 0} clicks`}
              />
            </div>
            <span className="mono whitespace-nowrap text-[9px] text-[var(--faint)]">
              {d.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}
