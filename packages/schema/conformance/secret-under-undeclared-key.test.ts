// Spec: k.schema, Conformance "An open object with a `Secret` under an undeclared key, at any depth, fails with rule `type` at the `Secret`'s path." (rfc:0153)
// Spec: k.schema, Closed objects "(open objects ignore them, but fail rule `type` at a `Secret` anywhere under one; `encode` drops them)"
// Seed 1337. A `Secret` is built by parsing a raw value with `s.secret(...)`. Nesting is generated: objects and arrays under the
// undeclared key, an undeclared key at the root or under a declared open object.
import { type Secret, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const MARKER = "[secret]";
const opts = { seed: SEED, numRuns: RUNS };

const secretOf = (raw: string): Secret<string> => {
  const r = s.secret(s.string()).parse(raw);
  if (!r.ok) throw new Error("a raw value parses as a secret");
  return r.value;
};

type Step = { readonly kind: "key"; readonly name: string } | { readonly kind: "index"; readonly at: number };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.stringMatching(/^[a-z]{1,4}$/).map((name): Step => ({ kind: "key", name })),
  fc.nat(2).map((at): Step => ({ kind: "index", at })),
);
const undeclared = fc.stringMatching(/^x[a-z]{0,4}$/);
const steps = fc.array(stepArb, { minLength: 0, maxLength: 4 });

/** Wraps `leaf` in one object or array per step, innermost step last in `path`. */
const wrap = (leaf: unknown, path: readonly Step[]): unknown =>
  path.reduceRight<unknown>((inner, step) => {
    if (step.kind === "key") return { [step.name]: inner };
    return Array.from({ length: step.at + 1 }, (_, i) => (i === step.at ? inner : null));
  }, leaf);
const segments = (path: readonly Step[]): (string | number)[] => path.map((p) => (p.kind === "key" ? p.name : p.at));

const Root = s.object({ name: s.string() });
const Nested = s.object({ name: s.string(), inner: s.object({ n: s.int() }) });
const issues = (
  r: { ok: true } | { ok: false; error: { data: { issues: readonly unknown[] } } },
): readonly unknown[] => (r.ok ? [] : r.error.data.issues);

describe("k.schema an open object refuses a `Secret` under an undeclared key", () => {
  it("adding a `Secret` under an undeclared key of an open root, directly or nested, gives exactly one `type` issue at its path", () => {
    fc.assert(
      fc.property(undeclared, steps, fc.string(), (key, path, raw) => {
        const r = Root.parse({ name: "a", [key]: wrap(secretOf(raw), path) });
        expect(r.ok).toBe(false);
        expect(issues(r)).toEqual([{ path: [key, ...segments(path)], rule: "type" }]);
      }),
      opts,
    );
  });

  it("the same holds for an undeclared key of a declared open object, at its full path", () => {
    fc.assert(
      fc.property(undeclared, steps, fc.string(), (key, path, raw) => {
        const r = Nested.parse({ name: "a", inner: { n: 1, [key]: wrap(secretOf(raw), path) } });
        expect(r.ok).toBe(false);
        expect(issues(r)).toEqual([{ path: ["inner", key, ...segments(path)], rule: "type" }]);
      }),
      opts,
    );
  });

  it("the same key holding the secret's marker string or a plain value parses", () => {
    fc.assert(
      fc.property(
        undeclared,
        steps,
        fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
        (key, path, plain) => {
          expect(Root.parse({ name: "a", [key]: wrap(MARKER, path) }).ok).toBe(true);
          expect(Root.parse({ name: "a", [key]: wrap(plain, path) }).ok).toBe(true);
          expect(Nested.parse({ name: "a", inner: { n: 1, [key]: wrap(MARKER, path) } }).ok).toBe(true);
        },
      ),
      opts,
    );
  });

  it("a declared `s.secret` key still parses a raw value: only undeclared keys refuse a `Secret`", () => {
    const WithToken = s.object({ token: s.secret(s.string()) });
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(WithToken.parse({ token: raw }).ok).toBe(true);
        expect(WithToken.parse({ token: secretOf(raw) }).ok).toBe(true);
      }),
      opts,
    );
  });
});
