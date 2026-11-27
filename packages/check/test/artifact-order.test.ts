import { describe, expect, it } from "vitest";
import { format } from "../src/index.ts";
import type { Diagnostic } from "../src/index.ts";

const d = (code: string, path: string, line = 1): Diagnostic => ({
  kind: "diag",
  code,
  path,
  line,
  col: 1,
  message: `m ${code}`,
});
const codes = (out: string): string[] =>
  out
    .split("\n")
    .map((l) => (l.startsWith("{") ? (l.match(/"code":"([A-Z]\d{4})"/)?.[1] ?? "") : (l.split(" ")[0] ?? "")))
    .filter((c) => /^[EWI]\d{4}$/.test(c));

describe("stale-artifact lines come after source diagnostics", () => {
  const mixed = [d("E1005", ".keel/routes.json"), d("E1405", "src/a.tsx"), d("W2001", "src/b.tsx")];

  it("compact: source codes first, E1005 last", () => {
    expect(codes(format(mixed))).toEqual(["E1405", "W2001", "E1005"]);
  });

  it("json: the same order, input order does not matter", () => {
    const a = codes(format(mixed, { mode: "json" }));
    const b = codes(format([...mixed].reverse(), { mode: "json" }));
    expect(a).toEqual(["E1405", "W2001", "E1005"]);
    expect(b).toEqual(a);
  });

  it("json with a limit keeps the same order", () => {
    expect(codes(format(mixed, { mode: "json", limit: 1 }))).toEqual(["E1405", "W2001", "E1005"]);
  });
});
