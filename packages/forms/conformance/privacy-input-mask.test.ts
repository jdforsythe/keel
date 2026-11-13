// @vitest-environment happy-dom
// Spec: k.privacy, Conformance "Under a sim ctx, an `input` fired on an `Input` bound to a marked field reaches `observe` as `x` repeated, and the element has `data-k-pii`."
// Seed: 1337.
// Skipped until `.pii(class)` and the input mask exist. Form schemas are generated objects of string fields (some nested), some
// nodes marked, no mark under another mark; unmarked fields are the control: their value arrives unchanged, with no `data-k-pii`.
// Deviation from the sentence: the control is a plain `input` stamped `data-k` and bound with `field.bind`, mounted with runtime-dom,
// because forms may not import @keel/ui (S0003); the delegated listener reports its DOM `input` events to `observe` by that id.
import { createCtx, observe } from "@keel/ctx";
import { form } from "@keel/forms";
import { createRouter, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { type ObjectSchema, type Schema, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, memoryHistory, settle } from "./fixtures.ts";

const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;
type Mark = (typeof CLASSES)[number] | null;
type Node =
  | { readonly kind: "leaf"; readonly mark: Mark }
  | { readonly kind: "object"; readonly fields: readonly Node[]; readonly mark: Mark };
type DomNode = globalThis.Node;
type ObjectNode = Extract<Node, { kind: "object" }>;

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
const exclusive = (n: Node, under = false): Node => {
  const mark = under ? null : n.mark;
  const inner = under || n.mark !== null;
  return n.kind === "leaf"
    ? { kind: "leaf", mark }
    : { kind: "object", fields: n.fields.map((f) => exclusive(f, inner)), mark };
};
const marked = (n: Node): boolean => n.mark !== null || (n.kind === "object" && n.fields.some(marked));
const rootArb: fc.Arbitrary<ObjectNode> = fc
  .array(nodeArb(2), { minLength: 1, maxLength: 3 })
  .map((fields): Node => exclusive({ kind: "object", fields, mark: null }))
  .filter((n): n is ObjectNode => n.kind === "object" && marked(n));

const schemaOf = (n: Node): Schema<unknown> => {
  if (n.kind === "object") return objectOf(n);
  return n.mark === null ? s.string() : s.string().pii(n.mark);
};
const objectOf = (n: ObjectNode): ObjectSchema<Record<string, unknown>> => {
  const inner = s.object(Object.fromEntries(n.fields.map((f, i) => [`f${i}`, schemaOf(f)])));
  return n.mark === null ? inner : inner.pii(n.mark);
};

interface Leaf {
  readonly path: string;
  readonly cls: Exclude<Mark, null> | null;
}
const leaves = (n: Node, prefix: string, inherited: Mark): Leaf[] => {
  const cls = inherited ?? n.mark;
  return n.kind === "leaf"
    ? [{ path: prefix, cls }]
    : n.fields.flatMap((f, i) => leaves(f, prefix === "" ? `f${i}` : `${prefix}.f${i}`, cls));
};

const texts = fc.array(fc.stringMatching(/^[a-z]{1,16}$/), { minLength: 12, maxLength: 12 });

describe("k.privacy input mask", () => {
  it("under a sim ctx, an input fired on an Input bound to a marked field reaches observe as x repeated, and the element has data-k-pii", async () => {
    await fc.assert(
      fc.asyncProperty(rootArb, texts, async (spec, pool) => {
        const all = leaves(spec, "", null);
        const text = (i: number): string => pool[i % pool.length] ?? "a";
        const routes = manifest({
          "pm.show": {
            path: "/pm",
            component(): DomNode {
              const f = form(objectOf(spec));
              const main = document.createElement("main");
              for (const [i, l] of all.entries()) {
                const el = document.createElement("input");
                el.setAttribute("data-k", `pm.f${i}`);
                // `bind` keeps an id already on the element, and the observer reports `id` before `data-k`.
                el.id = `pm.f${i}`;
                f.field(l.path).bind(el);
                main.append(el);
              }
              return main;
            },
          },
        });
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const seen = new Map<string, unknown>();
        const stop = observe(ctx, (e) => {
          if (e.kind === "fire" && e.event.type === "input") seen.set(e.id, e.event.value);
        });
        const router = createRouter(routes, { ctx, history: memoryHistory("/pm") });
        const root = document.createElement("div");
        document.body.appendChild(root);
        const unmount = mount(router.App, root, { ctx });
        try {
          await settle();
          for (const [i, l] of all.entries()) {
            const el = root.querySelector(`[name="${l.path}"]`);
            if (!(el instanceof HTMLInputElement)) throw new Error(`no input ${l.path}`);
            el.value = text(i);
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
          await settle();
          for (const [i, l] of all.entries()) {
            const el = root.querySelector(`[name="${l.path}"]`);
            if (l.cls === null) {
              expect(seen.get(`pm.f${i}`)).toBe(text(i));
              expect(el?.hasAttribute("data-k-pii")).toBe(false);
            } else {
              expect(seen.get(`pm.f${i}`)).toBe("x".repeat(text(i).length));
              expect(el?.getAttribute("data-k-pii")).toBe(l.cls);
            }
          }
        } finally {
          stop();
          unmount();
          root.remove();
        }
      }),
      { seed: SEED, numRuns: 100 },
    );
  }, 120_000);
});
