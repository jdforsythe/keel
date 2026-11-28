// k.claim, E1258's message "**E1258's message.** `<prop>: an element made before the call; make it inside a thunk` (`icon`: 61 units)."
// k.ui, E1808's message "**E1808's message.** `<base> children made before it; pass a thunk` (`Box`: 41 units)."
// k.security, E1571's message "`absolute URL fetched from client code; its origin is not declared under connect` (79 units)."
// k.topology, E1552's key message "**E1552's key message.** A deployable key the Declaration omits is E1552: `<name>: <key> is not a deployable key` (`web: cache is not a deployable key`, 34 units); the keys it may hold are `keel explain`'s."
// Seed 1337 (the property). E1258, E1808 and E1571 read their fixtures from fixtures-by-code.ts, with the names and counts those fixtures have; E1552 is an in-memory topology.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
import { type Files, SEED } from "./support.ts";

const messagesOf = (code: string): string[] => {
  const fx = CODE_FIXTURES[code];
  if (fx === undefined) throw new Error(`no fixture for ${code}`);
  return check(fx.bad, fx.badOpts ?? fx.opts ?? {})
    .diagnostics.filter((d) => d.code === code)
    .map((d) => d.message);
};
const topo = (name: string, key: string): Files => [
  {
    path: "topology.ts",
    source: `import { topology } from '@keel/server'\nexport default topology({ ${name}: { modules: ['a'], adapter: 'client', ${key}: {} } })\n`,
  },
  {
    path: "modules/a/module.ts",
    source:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
  },
];
const e1552 = (files: Files): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1552")
    .map((d) => d.message);

describe("messages stated as built", () => {
  test("E1258 is `<prop>: an element made before the call; make it inside a thunk`, `icon` 61 units", () => {
    const m = messagesOf("E1258");
    expect(m.length).toBeGreaterThan(0);
    for (const x of m)
      expect(x).toMatch(/^[A-Za-z][A-Za-z0-9]*: an element made before the call; make it inside a thunk$/);
    expect(m).toContain("icon: an element made before the call; make it inside a thunk");
    expect("icon: an element made before the call; make it inside a thunk".length).toBe(61);
  });

  test("E1808 is `<base> children made before it; pass a thunk`, `Box` 41 units", () => {
    expect(messagesOf("E1808")).toEqual(["Box children made before it; pass a thunk"]);
    expect("Box children made before it; pass a thunk".length).toBe(41);
  });

  test("E1571 is `absolute URL fetched from client code; its origin is not declared under connect`, 79 units", () => {
    const m = messagesOf("E1571");
    expect(m.length).toBeGreaterThan(0);
    for (const x of m)
      expect(x).toBe("absolute URL fetched from client code; its origin is not declared under connect");
    expect("absolute URL fetched from client code; its origin is not declared under connect".length).toBe(79);
  });

  test("a deployable key the Declaration omits is E1552 `<name>: <key> is not a deployable key`, `web: cache is not a deployable key` 34 units", () => {
    expect(e1552(topo("web", "cache"))).toEqual(["web: cache is not a deployable key"]);
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/), fc.stringMatching(/^[a-z][a-zA-Z]{2,9}$/), (name, key) => {
        fc.pre(!["modules", "adapter", "servedBy", "storage", "shells", "styles", "cache0"].includes(key));
        fc.pre(!/^(modules|adapter|servedBy|storage|shells|styles|routes|assets|peers|runners|origins|env)/.test(key));
        const m = e1552(topo(name, key));
        if (m.length === 1) expect(m[0]).toBe(`${name}: ${key} is not a deployable key`);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
