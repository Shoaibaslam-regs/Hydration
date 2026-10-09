import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("passes plain values through", () => {
    expect(csvCell("Pure Flow")).toBe("Pure Flow");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("Gulberg, Lahore")).toBe('"Gulberg, Lahore"');
    expect(csvCell('19" can')).toBe('"19"" can"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+92 300 1234567")).toBe("'+92 300 1234567");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-1+1")).toBe("'-1+1");
  });
});

describe("toCsv", () => {
  it("writes a BOM, header and CRLF rows", () => {
    const csv = toCsv([{ a: "x", b: 1 }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv).toBe("﻿A,B\r\nx,1\r\n");
  });
});
