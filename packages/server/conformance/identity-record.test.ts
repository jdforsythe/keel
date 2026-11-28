// @vitest-environment happy-dom
// Spec: k.identity, clause "With `decl = { input: A }`, `a = action(c, 'p.b', decl, run)` and `A.email` a `.pii()` string: after `decl.input = B` (an untyped write), a POST whose body holds `email=jane@x.com` and whose `run` throws is decoded by `A`, and no log line holds `jane@x.com`."
// Spec: k.identity, clause "With `a = action(c, 'p.b', { input: A }, run)` and `A`, `B` object schemas: `Object.isFrozen(a)` is true, and `manifest` given `{ ...a }`, `{ ...a, input: B }`, `Object.assign(Object.create(Object.getPrototypeOf(a)), a)`, an object given every `Reflect.ownKeys(a)` key with its descriptor, or `new Proxy(a, {})` in `a`'s place throws a value whose message starts `E1515` and names `p.b`, and runs nothing; the same holds of a `loader`'s and a `guard`'s copies."
// Seed 1337 (fixed inputs). The forged-action reproduction: `{ ...action(...), input: otherSchema }` is refused, and the registered schema and personal-data set decide what is decoded and what the log scrubs.
// "Decoded by A" is observed as `run` receiving `A`'s parse of the body (B would answer 422 and never call `run`).
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { SEED, createApp, post } from "./fixtures.ts";

const EMAIL = "jane@x.com";
const A = s.object({ email: s.string().pii("contact") });
const B = s.object({ other: s.string() });
const Plain = s.object({ email: s.string() });
const c = contract("p", { "p.b": { path: "/b" } });
const view = () => document.createElement("main");
const thrownOf = (fn: () => unknown): { message: string } | null => {
  try {
    fn();
  } catch (e) {
    return { message: e instanceof Error ? e.message : String(e) };
  }
  return null;
};

const serve = async (mode: "dev" | "production", decl: Record<string, unknown>, after: (a: object) => void) => {
  const seen: unknown[] = [];
  const made = Reflect.apply(action, undefined, [
    c,
    "p.b",
    decl,
    async (input: unknown) => {
      seen.push(input);
      throw new Error(`cannot save ${EMAIL}`);
    },
  ]);
  after(made);
  const routes = Reflect.apply(manifest, undefined, [c, { "p.b": { component: view, POST: made } }]);
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["p"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  const res = await app.fetch(post("/b", { email: EMAIL }, { accept: "application/json" }));
  await res.text();
  return { seen, lines, status: res.status };
};

describe("k.identity what the kernel reads", () => {
  for (const mode of ["dev", "production"] as const) {
    it(`after decl.input = B (an untyped write) a POST whose run throws is decoded by A and no log line holds the email, in ${mode}`, async () => {
      const decl: Record<string, unknown> = { input: A };
      const { seen, lines } = await serve(mode, decl, () => {
        Reflect.set(decl, "input", B);
      });
      expect(seen).toHaveLength(1);
      expect(JSON.stringify(seen[0])).toContain(EMAIL);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line).not.toContain(EMAIL);
      if (mode === "dev") expect(lines.some((l) => l.includes("[pii]"))).toBe(true);
    });

    it(`a write to the made action's input (a frozen value) changes neither what is decoded nor what the log scrubs, in ${mode}`, async () => {
      const { seen, lines } = await serve(mode, { input: A }, (made) => {
        expect(Reflect.set(made, "input", Plain)).toBe(false);
        expect(() => Object.defineProperty(made, "input", { value: Plain })).toThrow();
      });
      expect(seen).toHaveLength(1);
      for (const line of lines) expect(line).not.toContain(EMAIL);
    });
  }

  it("the forged action `{ ...action(...), input: otherSchema }`, whose input marks nothing, is refused with E1515 naming p.b, and nothing runs", async () => {
    let ran = 0;
    const real = action(c, "p.b", { input: A }, async () => {
      ran += 1;
      throw new Error(`cannot save ${EMAIL}`);
    });
    expect(Object.isFrozen(real)).toBe(true);
    const forged = { ...real, input: Plain };
    const e = thrownOf(() => Reflect.apply(manifest, undefined, [c, { "p.b": { component: view, POST: forged } }]));
    expect(e?.message.startsWith("E1515"), e?.message).toBe(true);
    expect(e?.message).toContain("p.b");
    expect(ran).toBe(0);
  });

  it("the forged action reaches no log: serving the made action beside it logs `[pii]` in place of the email in dev", async () => {
    const { lines } = await serve("dev", { input: A }, () => undefined);
    expect(lines.some((l) => l.includes("[pii]"))).toBe(true);
    for (const line of lines) expect(line).not.toContain(EMAIL);
  });
});
