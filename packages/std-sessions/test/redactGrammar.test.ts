// Backlog 0214: the redact path grammar. `*` matches any one segment (array index, record key, object field); `\.`
// is a literal dot, so a key containing a dot is addressable; E2001 rejects an entry that matches nothing, naming its
// path. The examples failed before the fix (`*` matched digits only, `s.record` was unresolved). Property seed 1337.
import { check } from "@keel/check";
import { type JsonValue, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { pathSegments } from "../src/internal/pathSegments.ts";
import { redact } from "../src/redact.ts";
import "../src/redactPath.ts";

const SEED = 1337;
const escapeKey = (k: string): string => (k === "*" ? "\\*" : k.replace(/\\/g, "\\\\").replace(/\./g, "\\."));

describe("redact path grammar (0214)", () => {
  test("`*` matches every record key: one entry redacts a field under every `s.record` entry", () => {
    const Book = s.object({ byId: s.record(s.object({ name: s.string(), n: s.int() })) });
    const value = { byId: { k1: { name: "alice-secret", n: 1 }, k2: { name: "bob-secret", n: 2 } } };
    const found: JsonValue[] = [];
    const out = redact(Book, value, {
      paths: ["byId.*.name"],
      seed: SEED,
      salt: "store:a.book",
      found: (v) => void found.push(v),
    });
    expect(found).toEqual(["alice-secret", "bob-secret"]);
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(Book.parse(out).ok).toBe(true);
  });

  test("`\\.` addresses a key containing a dot; its neighbours stay", () => {
    const Headers = s.object({ headers: s.record(s.string()) });
    const value = { headers: { "x.trace": "trace-value", other: "kept" } };
    const out = redact(Headers, value, { paths: ["headers.x\\.trace"], seed: SEED, salt: "tx:a.req" });
    expect(JSON.stringify(out)).not.toContain("trace-value");
    expect(JSON.stringify(out)).toContain('"other":"kept"');
  });

  test("escaping round-trips any key list (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 6 }), { minLength: 1, maxLength: 5 }), (keys) => {
        expect(pathSegments(keys.map(escapeKey).join("."))).toEqual(keys);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  test("a path over random keys redacts exactly the matched leaves, and the result parses (property)", () => {
    const keyArb = fc.stringMatching(/^[a-z.]{1,4}$/);
    fc.assert(
      fc.property(
        fc.dictionary(keyArb, fc.dictionary(keyArb, fc.string({ minLength: 1, maxLength: 6 }), { maxKeys: 3 }), {
          maxKeys: 4,
        }),
        fc.option(keyArb, { nil: undefined }),
        fc.option(keyArb, { nil: undefined }),
        (value, outer, inner) => {
          const Schema = s.object({ m: s.record(s.record(s.string())) });
          const path = `m.${outer === undefined ? "*" : escapeKey(outer)}.${inner === undefined ? "*" : escapeKey(inner)}`;
          let expected = 0;
          for (const [o, row] of Object.entries(value))
            for (const i of Object.keys(row)) if ((outer ?? o) === o && (inner ?? i) === i) expected++;
          let seen = 0;
          const out = redact(
            Schema,
            { m: value },
            { paths: [path], seed: SEED, salt: "store:a.m", found: () => void seen++ },
          );
          expect(seen).toBe(expected);
          expect(Schema.parse(out).ok).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe("E2001 with the new grammar (0214)", () => {
  const manifest = (redact: readonly string[]) => ({
    path: "modules/cart/module.ts",
    source: `import { module } from '@keel/compiler'
export default module({ id: 'cart', std: { '@keel/std-sessions': { redact: ${JSON.stringify(redact)} } } })
`,
  });
  const store = {
    path: "modules/cart/cart.ts",
    source: `import { s } from '@keel/schema'
import { store } from '@keel/store'
export const cart = store(s.object({ byId: s.record(s.object({ name: s.string() })), tags: s.array(s.string()) }), { byId: {}, tags: [] }, { id: 'cart.cart' })
`,
  };
  const e2001 = (redact: readonly string[]) =>
    check([manifest(redact), store], { types: false }).diagnostics.filter((d) => d.code === "E2001");

  test("entries that match something are clean: record key star, field star, array star", () => {
    expect(e2001(["store:cart.cart#byId.*.name", "store:cart.cart#*.*.name", "store:cart.cart#tags.*"])).toEqual([]);
  });

  test("an entry that matches nothing is E2001 with its path (unresolved `s.record` accepted it before)", () => {
    for (const entry of ["store:cart.cart#byId.*.nope", "store:cart.cart#*.*.nope", "store:cart.cart#tags.*.x"]) {
      const d = e2001([entry]);
      expect(d.length, entry).toBe(1);
      expect(d[0]?.message, entry).toMatch(
        new RegExp(`path '${entry.split("#")[1]?.replace(/[.*]/g, "\\$&")}' is not in its schema$`),
      );
    }
  });
});
