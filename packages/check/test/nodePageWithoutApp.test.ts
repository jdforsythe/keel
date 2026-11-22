// W1723 examples pinned by location and message: which `renderRoute` calls render a node page through a router.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const TOPOLOGY = (adapter: string) => ({
  path: "topology.ts",
  source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['f'], adapter: '${adapter}' } })\n`,
});
const test = (call: string, imp = "import { renderRoute } from '@keel/testing'\n") => ({
  path: "modules/f/f.test.ts",
  source: `${imp}declare const routes: never\ndeclare const opts: never\nexport const t = async () => { await ${call} }\n`,
});
const out = (call: string, adapter = "node", imp?: string): string[] =>
  check([TOPOLOGY(adapter), test(call, imp)], { types: false })
    .diagnostics.filter((d) => d.code === "W1723")
    .map((d) => `${d.line}:${d.col} ${d.message}`);

describe("W1723 a node page rendered without app", () => {
  it("reports at the id with the message", () => {
    expect(out("renderRoute('f.page', { routes })")).toEqual([
      "4:50 renderRoute('f.page') renders a node page through a router; pass app",
    ]);
  });
  it("reports an aliased import", () => {
    expect(out("rr('f.page', { routes })", "node", "import { renderRoute as rr } from '@keel/testing'\n")).toHaveLength(
      1,
    );
  });
  it("leaves app, a spread, options not a literal, another module and a static deployable alone", () => {
    expect(out("renderRoute('f.page', { routes, app: opts })")).toEqual([]);
    expect(out("renderRoute('f.page', { ...opts })")).toEqual([]);
    expect(out("renderRoute('f.page', opts)")).toEqual([]);
    expect(out("renderRoute('g.page', { routes })")).toEqual([]);
    expect(out("renderRoute('f.page', { routes })", "static")).toEqual([]);
  });
});
