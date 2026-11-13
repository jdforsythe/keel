// @vitest-environment node
// k.privacy Server log beyond its conformance: a throwing action's dev JSON error, its diag, and a throwing loader's diag
// hold no `.pii()` value of the input, a store state the action changed or another loader's output. Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";

const Notes = s.object({ items: s.array(s.string().pii("content")) });
const Text = s.object({ text: s.string() });
const notesStores = () => {
  const notes = store(Notes, { items: [] }, { id: "test.notes" });
  const add = transaction(notes, "test.add", Text, (st, p) => ({ items: [...st.items, p.text] }));
  return { notes, add };
};

async function build(lines: string[]) {
  const routes = manifest({
    "app.a": { path: "/a", component: () => document.createElement("main") },
    "app.b": {
      loader: loader({ output: s.object({ who: s.string().pii("name") }) }, async () => ok({ who: "ada lovelace" })),
      component: () => document.createElement("div"),
    },
    "app.b.c": {
      path: "/b/c",
      layout: "app.b",
      loader: loader({ output: s.object({}) }, async () => {
        await Promise.resolve();
        throw new Error("no luck for ada lovelace");
      }),
      component: () => document.createElement("main"),
    },
  });
  routes.actions({
    "app.a": {
      POST: action(
        { input: s.object({ email: s.string().pii("contact") }), stores: notesStores },
        (input, { stores }) => {
          tx(stores.add, { text: "my diary entry" });
          throw new Error(`cannot mail ${input.email} about my diary entry`);
        },
      ),
    },
  });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "compact", write: (l) => lines.push(l) },
  });
}

describe("diag scrub", () => {
  it("a throwing action returns and logs neither its marked input nor a marked store value it wrote", async () => {
    const lines: string[] = [];
    const app = await build(lines);
    const res = await app.fetch(
      new Request("http://localhost/a", {
        method: "POST",
        body: JSON.stringify({ email: "ada@example.test" }),
        headers: { "content-type": "application/json", accept: "application/json" },
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.text();
    const diag = lines.filter((l) => l.startsWith("keel.unexpected "));
    expect(diag).toEqual(["keel.unexpected action app.a threw: Error: cannot mail [pii] about [pii]"]);
    for (const text of [body, ...lines]) {
      expect(text).not.toContain("ada@example.test");
      expect(text).not.toContain("diary");
    }
  });

  it("a throwing loader's diag drops a marked output of its layout's loader", async () => {
    const lines: string[] = [];
    const app = await build(lines);
    await app.fetch(new Request("http://localhost/b/c"));
    expect(lines.filter((l) => l.startsWith("keel.unexpected "))).toEqual([
      "keel.unexpected loader app.b.c threw: Error: no luck for [pii]",
    ]);
  });
});

describe("marked record keys", () => {
  it("a throwing action's diag drops the keys of a marked record in its input", async () => {
    const lines: string[] = [];
    const routes = manifest({ "app.a": { path: "/a", component: () => document.createElement("main") } });
    const input = s.object({ notes: s.record(s.string()).pii("content") });
    routes.actions({
      "app.a": {
        POST: action({ input }, (v) => {
          throw new Error(`cannot file ${Object.keys(v.notes).join(" ")}`);
        }),
      },
    });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      mode: "dev",
      log: { format: "compact", write: (l) => lines.push(l) },
    });
    const res = await app.fetch(
      new Request("http://localhost/a", {
        method: "POST",
        body: JSON.stringify({ notes: { "maria hernandez": "x1y" } }),
        headers: { "content-type": "application/json", accept: "application/json" },
      }),
    );
    expect(res.status).toBe(500);
    expect(lines.filter((l) => l.startsWith("keel.unexpected "))).toEqual([
      "keel.unexpected action app.a threw: Error: cannot file [pii]",
    ]);
    expect(await res.text()).not.toContain("maria");
  });
});

describe("scrubbed", () => {
  const addr = 'Flat "2"\n1 Main St';
  it("replaces a value's URL-encoded, JSON-escaped, case-folded and base64 forms", () => {
    const one = (m: string, v: string) => scrubbed(m, new Set([v]));
    expect(one(`bad ${encodeURIComponent("ada@example.test")}`, "ada@example.test")).toBe("bad [pii]");
    expect(one(`bad ${JSON.stringify({ addr })}`, addr)).toBe('bad {"addr":"[pii]"}');
    expect(one("hi ADA LOVELACE and Ada Lovelace", "ada lovelace")).toBe("hi [pii] and [pii]");
    expect(one(`token ${btoa("ada lovelace")}`, "ada lovelace")).toBe("token [pii]");
    expect(one("a+b (c) [d]", "(c)")).toBe("a+b [pii] [d]");
  });

  it("replaces a value under 3 characters only as a whole token", () => {
    const four = new Set(["4"]);
    expect(scrubbed("store orders.v4 failed at 14:04, qty 4", four)).toBe("store orders.v4 failed at 14:04, qty [pii]");
    expect(scrubbed("id ab, tab, AB.", new Set(["ab"]))).toBe("id [pii], tab, [pii].");
  });

  it("property: no form of a marked word survives, and unmarked digits stay", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,12}( [a-z]{1,8})?$/), fc.integer({ min: 0, max: 3 }), (v, form) => {
        const shown = [v, encodeURIComponent(v), v.toUpperCase(), JSON.stringify(v).slice(1, -1)][form] ?? v;
        const out = scrubbed(`x 123 ${shown} 456`, new Set([v]));
        expect(out).toBe("x 123 [pii] 456");
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
