// @vitest-environment happy-dom
// Spec: k.privacy, clause "An action throwing an `Error` whose message or a stack frame's file path holds a marked input value logs a `diag` record with `[pii]` in its place, in dev and production."
// Spec: k.privacy, clause "An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await` or made earlier and revealed in it, a record or `json` key in one, and a runner's; a boolean or declared field name logs as is; of two overlapping requests each marks only its own."
// k.privacy Sinks "Each string, number and key but a declared field name (not a boolean) in a `Secret` made or revealed while the request runs (`bearer` too) becomes `[secret]`."
// Spec: k.serverlog, clause "In production mode with `KEEL_LOG_THROWN` an instant one hour after start, an action throwing an `Error` whose message holds a marked input value, and one throwing the revealed value of a `Secret` input, log a second `diag` holding `[pii]` or `[secret]` in its place and not the value, as each does under `mode: 'dev'`."
// Seed: 1337.
// Production holds the scrubbed text only inside the `KEEL_LOG_THROWN` window, so each production iteration opens it one hour after the sim clock's start (set before `createApp`, restored after the iteration).
// Input schemas are generated objects of string fields (some nested), some nodes marked
// `.pii(class)`; the action throws an Error whose message holds every input value. Marked values are lowercase letters,
// unmarked ones digits, so no unmarked text can hide or mimic a marked value.
// k.serverlog: a thrown value's text is in the log in dev mode (its second `diag`) and in production inside the window; these cases read that record. Production outside the window holds none of it: privacy-production-absence.test.ts asserts it.
import { fixedTime } from "@keel/tooling/test-time";
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type ObjectSchema, type Schema, reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Params, SEED, createApp, post } from "./fixtures.ts";
import { isoOfEpochMs } from "./iso-instant.ts";

const HOUR = 3_600_000;
/** Sets `KEEL_LOG_THROWN` to one hour after `ctx`'s clock for production, and returns the restoring function. */
function openWindow(mode: string, ctx: ReturnType<typeof createCtx>): () => void {
  const saved = process.env.KEEL_LOG_THROWN;
  if (mode === "production") process.env.KEEL_LOG_THROWN = isoOfEpochMs(Number(ctx.clock.now()) + HOUR);
  return () => {
    if (saved === undefined) delete process.env.KEEL_LOG_THROWN;
    else process.env.KEEL_LOG_THROWN = saved;
  };
}

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
    it(
      `an action throwing an Error whose message holds a marked input value logs a diag record holding [pii] and not the value, in ${mode}`,
      async () => {
        await fc.assert(
          fc.asyncProperty(inputArb, words, async (spec, pool) => {
            const all = leaves(spec, "", false);
            const value = (l: Leaf, i: number): string => (l.marked ? (pool[i % pool.length] ?? "") : `${i}0123456789`);
            const fields = Object.fromEntries(all.map((l, i) => [l.key, value(l, i)]));
            const secrets = all.flatMap((l, i) => (l.marked ? [value(l, i)] : []));
            const message = `cannot save ${Object.values(fields).join(" ")}`;
            const ordersContract = contract("orders", {
              "orders.show": { path: "/orders/:kind", params: Params },
            });
            const save = action(ordersContract, "orders.show", { input: objectOf(spec) }, () =>
              Promise.reject(new Error(message)),
            );
            const routes = manifest(ordersContract, {
              "orders.show": { component: () => document.createElement("main"), POST: save },
            });
            const lines: string[] = [];
            const ctx = createCtx({ mode: "sim", seed: SEED });
            const restore = openWindow(mode, ctx);
            try {
              const app = await createApp({
                topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
                routes,
                ctx,
                mode,
                log: { format: "json", write: (l: string) => void lines.push(l) },
              });
              await app.fetch(post("/orders/open", fields, { accept: "application/json" }));
              const diags = lines.filter((l) => {
                const rec: unknown = JSON.parse(l);
                return typeof rec === "object" && rec !== null && Reflect.get(rec, "kind") === "diag";
              });
              // dev writes the thrown text in a second diag; the first holds none (k.serverlog Thrown values)
              expect(diags).toHaveLength(2);
              expect(diags[1]).toContain("[pii]");
              for (const line of diags) for (const secret of secrets) expect(line).not.toContain(secret);
            } finally {
              restore();
            }
          }),
          { seed: SEED, numRuns: 100 },
        );
      },
      fixedTime(120_000),
    );
  }

  const TOKEN = "tok-7f3a9c";
  const forms = [TOKEN, btoa(TOKEN), encodeURIComponent(TOKEN)];
  const throwers = {
    "the revealed value": (v: string) => v,
    "an Error whose message holds the revealed value": (v: string) => new Error(`bad ${v}`),
  } as const;
  for (const mode of ["dev", "production"] as const) {
    for (const [how, make] of Object.entries(throwers)) {
      it(`An action throwing the revealed value of a \`Secret\` input or \`bearer\`, as a string or in an \`Error\` message, logs a \`diag\` record holding \`[secret]\` and not the value, in ${mode}: it throws ${how}, and no line holds its base64 or encodeURIComponent form`, async () => {
        const orders = contract("orders", {
          "orders.show": { path: "/orders/:kind", params: Params },
        });

        const save = action(orders, "orders.show", { input: s.object({ k: s.secret(s.string()) }) }, (input) =>
          Promise.reject(make(reveal(input.k))),
        );
        const routes = manifest(orders, {
          "orders.show": { component: () => document.createElement("main"), POST: save },
        });
        const lines: string[] = [];
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const restore = openWindow(mode, ctx);
        try {
          const app = await createApp({
            topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
            routes,
            ctx,
            mode,
            log: { format: "json", write: (l: string) => void lines.push(l) },
          });
          await app.fetch(post("/orders/open", { k: TOKEN }, { accept: "application/json" }));
          const diags = lines.filter((l) => {
            const rec: unknown = JSON.parse(l);
            return typeof rec === "object" && rec !== null && Reflect.get(rec, "kind") === "diag";
          });
          expect(diags).toHaveLength(2);
          expect(diags[1]).toContain("[secret]");
          for (const line of diags) for (const form of forms) expect(line).not.toContain(form);
          for (const line of lines) for (const form of forms) expect(line).not.toContain(form);
        } finally {
          restore();
        }
      });
    }
  }
});
