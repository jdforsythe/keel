// Examples and a property (k.api Bearer): the parse table of the `authorization` header, and that any header value
// gives a `Secret` exactly when it matches the bearer grammar, never a throw. Seed 1337.
import { reveal } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bearerOf } from "../src/internal/bearerOf.ts";

const SEED = 1337;
const GRAMMAR = /^bearer +([A-Za-z0-9\-._~+/]{1,4096}=*)$/i;
const hex = (n: number): string => "0123456789abcdef".repeat(Math.ceil(n / 16)).slice(0, n);
const withAuth = (values: readonly string[]): Request => {
  const h = new Headers();
  for (const v of values) h.append("authorization", v);
  return new Request("http://localhost/api/x", { headers: h });
};
const shown = (values: readonly string[]): string | undefined => {
  const b = bearerOf(withAuth(values));
  return b === undefined ? undefined : reveal(b);
};

const TABLE: readonly (readonly [readonly string[], string | undefined])[] = [
  [[], undefined],
  [["Bearer abc"], "abc"],
  [["bearer abc"], "abc"],
  [["BEARER   abc"], "abc"],
  [["  Bearer abc  "], "abc"],
  [["Bearer abc=="], "abc=="],
  [[`Bearer keel_${hex(16)}_${hex(64)}`], `keel_${hex(16)}_${hex(64)}`],
  [[`Bearer ${"a".repeat(4096)}`], "a".repeat(4096)],
  [["Bearer"], undefined],
  [["Bearer "], undefined],
  [["Bearer a b"], undefined],
  [["Bearer a,b"], undefined],
  [["Bearer a\tb"], undefined],
  [["Bearer\tabc"], undefined],
  [["Bearer =abc"], undefined],
  [["Bearer ab=c"], undefined],
  [[`Bearer ${"a".repeat(4097)}`], undefined],
  [["Basic YWxhZGRpbg=="], undefined],
  [["Token abc"], undefined],
  [["Bearerabc"], undefined],
  [["Bearer a", "Bearer b"], undefined],
];

describe("bearerOf", () => {
  it("reads the parse table: one Bearer token68 of 1 to 4,096 characters, any case, else undefined", () => {
    for (const [values, want] of TABLE) expect(shown(values), JSON.stringify(values)).toBe(want);
  });

  it("gives a Secret whose String and JSON forms are the marker", () => {
    const b = bearerOf(withAuth(["Bearer abc"]));
    expect(String(b)).toBe("[secret]");
    expect(JSON.stringify(b)).toBe('"[secret]"');
  });

  it("never throws, and reveals the grammar's token exactly when the trimmed value matches it", () => {
    const chars = fc.constantFrom(..."aZ09-._~+/= ,\tBearer".split(""));
    const value = fc.oneof(
      fc.string({ maxLength: 40 }),
      fc
        .tuple(fc.constantFrom("Bearer", "bearer", "BEARER", "Basic", ""), fc.array(chars, { maxLength: 30 }))
        .map(([scheme, cs]) => `${scheme}${cs.join("")}`),
    );
    fc.assert(
      fc.property(value, (v) => {
        // Headers refuse some values (a newline, a NUL); those never reach the server.
        let req: Request;
        try {
          req = withAuth([v]);
        } catch {
          return;
        }
        const read = req.headers.get("authorization") ?? "";
        const want = GRAMMAR.exec(read.trim())?.[1];
        expect(shown([v])).toBe(want);
      }),
      { seed: SEED, numRuns: 500 },
    );
  });
});
