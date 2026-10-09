export function Rating({ average, count }: { average: number; count: number }) {
  if (count === 0) return <span className="text-sm text-muted-foreground">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${average.toFixed(1)} out of 5`}>
      <span aria-hidden className="text-warning">★</span>
      <span className="font-medium">{average.toFixed(1)}</span>
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}
