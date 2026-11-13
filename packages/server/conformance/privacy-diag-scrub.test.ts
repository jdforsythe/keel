// @vitest-environment happy-dom
// Spec: k.privacy, Conformance "An action throwing an `Error` whose message holds a marked input value logs a `diag` record holding `[pii]` and not the value, in dev and production."
// Seed: 1337.
// Skipped until the diag scrub exists. Input schemas are generated objects of string fields (some nested), some nodes marked
// `.pii(class)`; the action throws an Error whose message holds every input value. Marked values are lowercase letters,
// unmarked ones digits, so no unmarked text can hide or mimic a marked value.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { type ObjectSchema, type Schema, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Params, SEED, createApp, post } from "./fixtures.ts";

const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;
type Mark = (typeof CLASSES)[number] | null;
type Node =
  | { readonly kind: "leaf"; readonly mark: Mark }
  | { readonly kind: "object"; readonly fields: readonly Node[]; readonly mark: Mark };

const markArb: fc.Arbitrary<Mark> = fc.option(fc.constantFrom(...CLASSES), { freq: 2, nil: null });
const nodeArb = (depth: number): fc.Arbitrary<Node> =>
  depth <= 0
    ? fc.record({ kind: fc.constant("leaf" as const), mark: markArb })
    : fc.oneof(
        fc.record({ kind: fc.constant("leaf" as const), mark: markArb }),
        fc.record({
          kind: fc.constant("object" as const),
          fields: fc.array(nodeArb(depth - 1), { minLength: 1, maxLength: 3 }),
          mark: markArb,
        }),
      );
const marked = (n: Node): boolean => n.mark !== null || (n.kind === "object" && n.fields.some(marked));
const inputArb: fc.Arbitrary<ObjectNode> = fc
  .array(nodeArb(2), { minLength: 1, maxLength: 3 })
  .map((fields): ObjectNode => ({ kind: "object", fields, mark: null }))
  .filter(marked);

type ObjectNode = Extract<Node, { kind: "object" }>;
const objectOf = (n: ObjectNode): ObjectSchema<unknown> => {
  const inner = s.object(Object.fromEntries(n.fields.map((f, i) => [`f${i}`, schemaOf(f)])));
  return n.mark === null ? inner : inner.pii(n.mark);
};
const schemaOf = (n: Node): Schema<unknown> => {
  if (n.kind === "object") return objectOf(n);
  return n.mark === null ? s.string() : s.string().pii(n.mark);
};

interface Leaf {
  readonly key: string;
  readonly marked: boolean;
}
/** The string leaves with their dotted form keys; `marked` when the leaf or an ancestor is marked. */
const leaves = (n: Node, prefix: string, under: boolean): Leaf[] => {
  const here = under || n.mark !== null;
  return n.kind === "leaf"
    ? [{ key: prefix, marked: here }]
    : n.fields.flatMap((f, i) => leaves(f, prefix === "" ? `f${i}` : `${prefix}.f${i}`, here));
};

const words = fc.array(fc.stringMatching(/^[a-z]{12,20}$/), { minLength: 8, maxLength: 8 });

describe("k.privacy server log", () => {
  for (const mode of ["dev", "production"] as const) {
    it(`an action throwing an Error whose message holds a marked input value logs a diag record holding [pii] and not the value, in ${mode}`, async () => {
      await fc.assert(
        fc.asyncProperty(inputArb, words, async (spec, pool) => {
          const all = leaves(spec, "", false);
          const value = (l: Leaf, i: number): string => (l.marked ? (pool[i % pool.length] ?? "") : `${i}0123456789`);
          const fields = Object.fromEntries(all.map((l, i) => [l.key, value(l, i)]));
          const secrets = all.flatMap((l, i) => (l.marked ? [value(l, i)] : []));
          const message = `cannot save ${Object.values(fields).join(" ")}`;
          const save = action({ input: objectOf(spec) }, () => Promise.reject(new Error(message)));
          const routes = manifest({
            "orders.show": {
              path: "/orders/:kind",
              params: Params,
              component: () => document.createElement("main"),
            },
          });
          routes.actions({ "orders.show": { POST: save } });
          const lines: string[] = [];
          const app = await createApp({
            topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
            routes,
            ctx: createCtx({ mode: "sim", seed: SEED }),
            mode,
            log: { format: "json", write: (l: string) => void lines.push(l) },
          });
          await app.fetch(post("/orders/open", fields, { accept: "application/json" }));
          const diags = lines.filter((l) => {
            const rec: unknown = JSON.parse(l);
            return typeof rec === "object" && rec !== null && Reflect.get(rec, "kind") === "diag";
          });
          expect(diags.length).toBeGreaterThan(0);
          for (const line of diags) {
            expect(line).toContain("[pii]");
            for (const secret of secrets) expect(line).not.toContain(secret);
          }
        }),
        { seed: SEED, numRuns: 100 },
      );
    }, 120_000);
  }
});
