// IBAN helpers for the bank account shown on shopkeepers' billing page. Safe for client code.

/** Strip spaces and dashes and upper-case: "pk36 scbl 0000…" → "PK36SCBL0000…". */
export function normalizeIban(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

/**
 * A well-formed IBAN with a valid ISO 13616 check (mod 97). Pakistani IBANs
 * (PK…) are exactly 24 characters: PK, 2 check digits, a 4-letter bank code, 16 digits.
 */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("PK") && !/^PK\d{2}[A-Z]{4}\d{16}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Groups of four for reading aloud or copying by eye: "PK36 SCBL 0000 0011 2345 6702". */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}
