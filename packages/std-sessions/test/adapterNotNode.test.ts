import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import "../src/adapterNotNode.ts";

const topo = (body: string) => ({ path: "topology.ts", source: `export default topology({ ${body} })\n` });
const routes = (imp: string, path = "modules/cart/routes.ts") => ({ path, source: `${imp}\nexport const r = 1\n` });
const SESS = "import { routes } from '@keel/std-sessions/routes'";
const run = (files: readonly { path: string; source: string }[]) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === "E2005");

describe("E2005 adapterNotNode", () => {
  test("static deployable reports at the import source", () => {
    const d = run([routes(SESS), topo("web: { modules: ['cart'], adapter: 'static' }")]);
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(1);
    expect(d[0]?.message).toContain("deployable 'web' (static)");
  });
  test("client deployable reports", () => {
    expect(run([routes(SESS), topo("web: { modules: ['cart'], adapter: 'client' }")])).toHaveLength(1);
  });
  test("node deployable is clean", () => {
    expect(run([routes(SESS), topo("web: { modules: ['cart'], adapter: 'node' }")])).toHaveLength(0);
  });
  test("a static deployable without the module is clean", () => {
    expect(run([routes(SESS), topo("web: { modules: ['other'], adapter: 'static' }")])).toHaveLength(0);
  });
  test("no topology is clean", () => {
    expect(run([routes(SESS)])).toHaveLength(0);
  });
  test("record-only import is clean", () => {
    const imp = "import { record } from '@keel/std-sessions/record'";
    expect(run([routes(imp), topo("web: { modules: ['cart'], adapter: 'client' }")])).toHaveLength(0);
  });
  test("prefixed project resolves its own topology", () => {
    const d = run([
      routes(SESS, "apps/a/modules/cart/routes.ts"),
      { path: "apps/a/topology.ts", source: topo("w: { modules: ['cart'], adapter: 'static' }").source },
    ]);
    expect(d).toHaveLength(1);
  });
});
