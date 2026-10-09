"use client";

import { useState } from "react";
import { formatPrice, formatPriceCompact, TIME_ZONE } from "@/lib/catalog";

export type DailyBar = { date: string; value: number; orders: number };

const dayLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtDay = (key: string) => dayLabel.format(new Date(`${key}T00:00:00Z`));

/** Nice round axis maximum (1, 2, 2.5, 5 × 10^n) at or above `max`. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * pow >= max) return step * pow;
  return 10 * pow;
}

/**
 * Single-series column chart (one hue, --chart-1). Each column is its own
 * hover/focus target with a tooltip; the same numbers are in the table view.
 */
export function DailyBarChart({ data, label }: { data: DailyBar[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = [max, max / 2, 0];
  const hovered = active !== null ? data[active] : null;
  const mid = Math.floor((data.length - 1) / 2);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="relative flex gap-2">
        {/* Y axis */}
        <div className="flex h-48 w-16 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formatPriceCompact(t)}
            </span>
          ))}
        </div>
        {/* Plot */}
        <div className="relative h-48 min-w-0 flex-1" onPointerLeave={() => setActive(null)}>
          {ticks.map((t, i) => (
            <div
              key={t}
              className="pointer-events-none absolute inset-x-0 h-px bg-border"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              aria-hidden
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label={label}>
            {data.map((d, i) => (
              <div
                key={d.date}
                role="listitem"
                tabIndex={0}
                aria-label={`${fmtDay(d.date)}: ${formatPrice(d.value)} delivered, ${d.orders} orders`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none"
              >
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity group-hover:opacity-80 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary"
                  style={{ height: d.value > 0 ? `max(${(d.value / max) * 100}%, 2px)` : 0 }}
                />
              </div>
            ))}
          </div>
          {hovered && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md"
              style={{ left: `${((active! + 0.5) / data.length) * 100}%` }}
            >
              <p className="text-sm font-semibold text-foreground">{formatPrice(hovered.value)}</p>
              <p className="whitespace-nowrap text-muted-foreground">
                {fmtDay(hovered.date)} · {hovered.orders} {hovered.orders === 1 ? "order" : "orders"}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* X axis: first, middle, last day */}
      <div className="ml-[4.5rem] flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{fmtDay(data[0].date)}</span>
        {data.length > 2 && <span>{fmtDay(data[mid].date)}</span>}
        <span>{fmtDay(data[data.length - 1].date)}</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-primary">Show as table</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <caption className="sr-only">{label}, by day ({TIME_ZONE})</caption>
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">Orders</th>
                <th className="px-3 py-2 text-right font-medium">Delivered value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5">{fmtDay(d.date)}</td>
                  <td className="px-3 py-1.5 text-right">{d.orders}</td>
                  <td className="px-3 py-1.5 text-right">{formatPrice(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
