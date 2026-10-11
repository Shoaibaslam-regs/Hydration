"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";

export type PlaceHit = { title: string; subtitle: string; lat: number; lng: number };

/**
 * Search an area, street or landmark (through our /api/geocode proxy) and pick
 * one of the matches. Works without GPS and on plain-HTTP pages.
 */
export function PlaceSearch({
  onPick,
  placeholder = "Search area, street or landmark",
  extraButton,
  autoFocus,
}: {
  onPick: (hit: PlaceHit) => void;
  placeholder?: string;
  /** Rendered next to the Search button (e.g. "My location"). */
  extraButton?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (q.length < 3) {
      setMessage("Type at least 3 characters, e.g. a street, area or landmark.");
      return;
    }
    setSearching(true);
    setMessage(null);
    const result = await apiRequest<{ items: PlaceHit[] }>(`/api/geocode?q=${encodeURIComponent(q)}`);
    setSearching(false);
    if (!result.ok) {
      setHits(null);
      setMessage(result.fieldErrors.q?.[0] ?? result.message);
      return;
    }
    setHits(result.data.items);
    if (result.data.items.length === 0) setMessage("No places found. Try a nearby landmark, or add the city (e.g. “Gulberg, Lahore”).");
  }

  function pick(hit: PlaceHit) {
    setHits(null);
    setMessage(null);
    setQuery([hit.title, hit.subtitle].filter(Boolean).join(", "));
    onPick(hit);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Search instead of submitting a surrounding form.
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder={placeholder}
          aria-label="Search for a place"
          maxLength={200}
          autoFocus={autoFocus}
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={search} disabled={searching} className="flex-1 sm:flex-none">
            {searching ? "Searching…" : "Search"}
          </Button>
          {extraButton}
        </div>
      </div>
      {hits && hits.length > 0 && (
        <ul className="glass-panel divide-y divide-border/60 overflow-hidden rounded-xl border" aria-label="Places found">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lng}`}>
              <button
                type="button"
                onClick={() => pick(h)}
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="font-medium">{h.title}</span>
                {h.subtitle && <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
