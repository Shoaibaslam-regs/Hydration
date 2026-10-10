// Forgiving text matching for shop search: case, punctuation and hyphens
// don't matter ("Gulshan-e-Bahar" = "gulshan e bahar"), and words can come in
// any order. Pure and safe for client code.

/** Words that carry no location meaning on their own. */
const STOPWORDS = new Set(["near", "in", "at", "the", "of", "and", "pakistan", "shop", "shops", "water"]);

/** Lowercase, turn every run of non-letters/digits (any script) into one space. */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The words of a query worth matching: normalized, de-duplicated, without single letters and stopwords. */
export function searchTokens(query: string): string[] {
  const words = normalizeSearchText(query).split(" ");
  // Single letters like the "e" in "gulshan e bahar" match everything; keep single digits ("street 4").
  const useful = words.filter((w) => (w.length > 1 || /\d/.test(w)) && !STOPWORDS.has(w));
  return [...new Set(useful)].slice(0, 12);
}

/** What a shop is searchable by: its name and full address, normalized. Stored as `Shop.searchText`. */
export function shopSearchText(shop: { name: string; address: { line1: string; area?: string | null; city: string } }): string {
  return normalizeSearchText([shop.name, shop.address.line1, shop.address.area ?? "", shop.address.city].join(" "));
}
