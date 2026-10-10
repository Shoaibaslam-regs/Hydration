/** Compact "Deal" marker with the deal's title, for shop cards. */
export function DealTag({ title }: { title: string }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 rounded-lg bg-warning/10 px-2 py-1 text-xs">
      <span className="shrink-0 rounded bg-warning px-1.5 py-0.5 font-semibold text-white">Deal</span>
      <span className="truncate font-medium text-foreground">{title}</span>
    </p>
  );
}
