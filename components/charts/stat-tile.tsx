import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Change vs the previous period, as a signed whole percent; null when there's no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * KPI tile: label · value · optional delta vs a named period. The delta's
 * color depends on direction and on whether up is good; an arrow and text
 * carry the same meaning, so it never relies on color alone.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel = "vs previous period",
  upIsGood = true,
  hero = false,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  upIsGood?: boolean;
  hero?: boolean;
}) {
  const good = delta != null && delta !== 0 && (delta > 0) === upIsGood;
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", hero ? "text-4xl sm:text-5xl" : "text-2xl")}>{value}</p>
      {delta !== undefined && (
        <p className="text-xs text-muted-foreground">
          {delta === null ? (
            "No data for the previous period"
          ) : (
            <>
              <span className={cn("font-medium", delta === 0 ? "text-muted-foreground" : good ? "text-success" : "text-danger")}>
                <span aria-hidden>{delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}</span>
                {delta > 0 ? "+" : ""}
                {delta}%
              </span>{" "}
              {deltaLabel}
            </>
          )}
        </p>
      )}
    </Card>
  );
}
