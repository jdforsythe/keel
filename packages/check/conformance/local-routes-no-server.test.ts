// Spec: k.contract, clause "In a fixture whose `client` deployable `web` serves module `a` with a `local: true` page `a.tools`, `keel check` and `keel build` each report one E1511 `a.tools: local route in client deployable web, which has no server` at `topology.ts`, `keel build` exits 1 and writes no `dist/web/`, and `createApp` for `web` throws E1511; with `web` a `static` deployable, one E1511 `a.tools: local route in static deployable web, which has no server`; with `a` served by a `node` deployable, none."
// Spec: k.api Rules: "E1511 an API entry, or a `local: true` entry (k.contract Local routes), in a module a `client` or `static` deployable serves (k.topology); reported from `topology.ts` at the module's id by `keel check` and `keel build` (which then fails and writes no `dist/<name>/`), thrown by `createApp`; message `<id>: API route in <adapter> deployable <name>, which has no server`, for a `local` page `<id>: local route in <adapter> deployable <name>, which has no server`; no fix: the remedy, serving the module from a `node` deployable, is `keel explain`'s."
// This file covers the `keel check` half (`check()` of `@keel/check`, in-memory project, the topology as an option as fixtures-by-code.ts passes it). Seed 1337 (the page's path).
// ASSUMED: "at `topology.ts`" is the diagnostic's `path`; an API entry's message (`<id>: API route in ...`) is asserted for the same fixture with an API entry.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const project = (entry: string): Files => [
  f(
    "modules/a/module.ts",
    "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
  ),
  f(
    "modules/a/a.contract.ts",
    `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const a = contract('a', { ${entry} })\n`,
  ),
];
const tools = (path = "/tools"): Files => project(`'a.tools': { path: '${path}', local: true }`);
const e1511 = (files: Files, adapter: "client" | "static" | "node") =>
  check(files, { types: false, topology: { web: { modules: ["a"], adapter } } }).diagnostics.filter(
    (d) => d.code === "E1511",
  );

describe("k.contract Local routes: `keel check` and a `local` route with no server", () => {
  it("`keel check` reports one E1511 `a.tools: local route in client deployable web, which has no server` at `topology.ts` for a `local: true` page in a `client` deployable", () => {
    const d = e1511(tools(), "client");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("a.tools: local route in client deployable web, which has no server");
    expect(d[0]?.path).toBe("topology.ts");
  });

  it("with `web` a `static` deployable, `keel check` reports one E1511 `a.tools: local route in static deployable web, which has no server`", () => {
    const d = e1511(tools(), "static");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("a.tools: local route in static deployable web, which has no server");
    expect(d[0]?.path).toBe("topology.ts");
  });

  it("with `a` served by a `node` deployable, `keel check` reports no E1511", () => {
    expect(e1511(tools(), "node")).toEqual([]);
  });

  it("the E1511 is one, with the same message, whatever the `local` page's path, in a deployable with no server", () => {
    const seg = fc.stringMatching(/^[a-z]{1,8}$/);
    fc.assert(
      fc.property(
        fc.array(seg, { minLength: 1, maxLength: 3 }),
        fc.constantFrom("client", "static"),
        (segs, adapter) => {
          const d = e1511(tools(`/${segs.join("/")}`), adapter);
          expect(d).toHaveLength(1);
          expect(d[0]?.message).toBe(`a.tools: local route in ${adapter} deployable web, which has no server`);
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a `local: true` API entry in a `client` deployable is E1511 `a.list: local route in client deployable web, which has no server`, and a plain API entry keeps `API route in`", () => {
    const local = e1511(
      project("'a.list': { method: 'GET', path: '/api/list', output: s.object({}), local: true }"),
      "client",
    );
    expect(local.map((d) => d.message)).toEqual(["a.list: local route in client deployable web, which has no server"]);
    const plain = e1511(project("'a.list': { method: 'GET', path: '/api/list', output: s.object({}) }"), "client");
    expect(plain.map((d) => d.message)).toEqual(["a.list: API route in client deployable web, which has no server"]);
  });
});
