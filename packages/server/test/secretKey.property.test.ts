// secretKey over generated input schemas (seed 1337): every FormData key whose decoded path reaches an `s.secret`
// node is secret, through object fields, array indices (present or not), record keys holding dots, unions and
// optional/nullable wrappers; a schema with no secret makes no key secret; a key that follows only object fields and
// optional/nullable wrappers to a plain leaf is never secret. A complexity guard runs deep record nests with many
// long keys.
import type { Schema } from "@keel/schema";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { secretKey } from "../src/internal/secretKey.ts";

type Node = Schema<unknown>["node"];
/** A generated schema with the decoded paths it holds: to a secret, and to plain leaves (`exact` when reached only
 * through object fields and wrappers). */
type Gen = { node: Node; secret: string[][]; plain: { path: string[]; exact: boolean }[] };

const SEED = 1337;
const segment = fc.stringMatching(/^[a-z0-9]{1,4}$/);
const recordKey = fc.array(segment, { minLength: 1, maxLength: 3 }).map((xs) => xs.join("."));

const prefix = (g: Gen, head: string[], exact: boolean): Gen => ({
  node: g.node,
  secret: g.secret.map((p) => [...head, ...p]),
  plain: g.plain.map((p) => ({ path: [...head, ...p.path], exact: p.exact && exact })),
});

const { gen } = fc.letrec<{ gen: Gen }>((tie) => ({
  gen: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.constant<Gen>({ node: s.string().node, secret: [], plain: [{ path: [], exact: true }] }),
    fc.constant<Gen>({ node: s.int().node, secret: [], plain: [{ path: [], exact: true }] }),
    fc.constant<Gen>({ node: s.secret(s.string()).node, secret: [[]], plain: [] }),
    tie("gen").map((g): Gen => ({ node: { kind: "secret", inner: g.node }, secret: [[]], plain: [] })),
    tie("gen").map((g): Gen => ({ ...g, node: { kind: "optional", inner: g.node } })),
    tie("gen").map((g): Gen => ({ ...g, node: { kind: "nullable", inner: g.node } })),
    fc.tuple(tie("gen"), fc.nat(99)).map(([g, i]): Gen => {
      const at = prefix(g, [String(i)], false);
      const bare = prefix(g, [], false);
      return { node: { kind: "array", item: g.node }, secret: [...at.secret, ...bare.secret], plain: [...at.plain] };
    }),
    fc.tuple(tie("gen"), recordKey).map(
      ([g, k]): Gen => ({
        ...prefix(g, k.split("."), false),
        node: { kind: "record", value: g.node },
      }),
    ),
    fc.array(tie("gen"), { minLength: 1, maxLength: 3 }).map((vs): Gen => {
      const merged = vs.map((v) => prefix(v, [], false));
      return {
        node: { kind: "anyOf", members: vs.map((v) => v.node) },
        secret: merged.flatMap((v) => v.secret),
        plain: merged.flatMap((v) => v.plain),
      };
    }),
    fc
      .uniqueArray(fc.tuple(segment, tie("gen")), { minLength: 1, maxLength: 4, selector: ([k]) => k })
      .map((fs): Gen => {
        const parts = fs.map(([k, g]) => prefix(g, [k], true));
        return {
          node: { kind: "object", fields: Object.fromEntries(fs.map(([k, g]) => [k, g.node])) },
          secret: parts.flatMap((p) => p.secret),
          plain: parts.flatMap((p) => p.plain),
        };
      }),
  ),
}));

describe("secretKey over generated schemas (seed 1337)", () => {
  it("every key whose path reaches a secret is secret, with or without a trailing []", () => {
    fc.assert(
      fc.property(gen, (g) => {
        for (const p of g.secret) {
          expect(secretKey(g.node, p.join(".")), p.join(".")).toBe(true);
          expect(secretKey(g.node, `${p.join(".")}[]`)).toBe(true);
        }
      }),
      { seed: SEED, numRuns: 400 },
    );
  });

  it("a schema with no secret makes no key secret", () => {
    fc.assert(
      fc.property(gen, fc.array(fc.array(segment, { maxLength: 6 })), (g, extra) => {
        fc.pre(g.secret.length === 0);
        for (const p of [...g.plain.map((x) => x.path), ...extra]) expect(secretKey(g.node, p.join("."))).toBe(false);
      }),
      { seed: SEED, numRuns: 400 },
    );
  });

  it("a key through object fields and optional/nullable wrappers to a plain leaf is not secret", () => {
    fc.assert(
      fc.property(gen, (g) => {
        for (const p of g.plain) if (p.exact) expect(secretKey(g.node, p.path.join(".")), p.path.join(".")).toBe(false);
      }),
      { seed: SEED, numRuns: 400 },
    );
  });
});

describe("secretKey cost", () => {
  const nest = (depth: number, leaf: Node): Node =>
    depth === 0 ? leaf : { kind: "optional", inner: { kind: "record", value: nest(depth - 1, leaf) } };
  const keys = fc.sample(fc.array(segment, { minLength: 1, maxLength: 40 }), { seed: SEED, numRuns: 20_000 });

  it("12 nested optional records, 20k keys: secret and plain leaves both answer within the test timeout", () => {
    const withSecret: Node = { kind: "object", fields: { rec: nest(12, s.secret(s.string()).node) } };
    const plain: Node = { kind: "object", fields: { rec: nest(12, s.string().node) } };
    for (const k of keys) {
      expect(secretKey(withSecret, `rec.${k.join(".")}`)).toBe(true);
      expect(secretKey(plain, `rec.${k.join(".")}`)).toBe(false);
    }
  });

  it("a record key holding dots does not hide a secret field under it", () => {
    const n = s.object({ rec: s.record(s.object({ pw: s.secret(s.string()), name: s.string() })) }).node;
    expect(secretKey(n, "rec.a.b.pw")).toBe(true);
    expect(secretKey(n, "rec.a.pw")).toBe(true);
    // Past a record holding a secret every key is secret: a sibling under it is dropped too, the safe direction.
    expect(secretKey(n, "rec.a.b.name")).toBe(true);
    expect(secretKey(s.object({ rec: s.record(s.string()), x: s.string() }).node, "rec.a.b")).toBe(false);
  });
});
