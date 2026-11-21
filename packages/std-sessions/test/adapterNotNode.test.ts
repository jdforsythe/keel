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

// Backlog 0215: E2005 sees re-exports and imports through another project file (`RuleInput.project`).
describe("E2005 adapterNotNode: re-exports (0215)", () => {
  const client = topo("web: { modules: ['cart'], adapter: 'client' }");
  const node = topo("web: { modules: ['cart'], adapter: 'node' }");
  const via = (path: string, source: string) => ({ path, source });
  test("export { routes as sessions } from the package", () => {
    const d = run([routes("export { routes as sessions } from '@keel/std-sessions/routes'"), client]);
    expect(d).toHaveLength(1);
    expect(d[0]?.line).toBe(1);
  });
  test("export * from the package", () => {
    expect(run([routes("export * from '@keel/std-sessions/routes'"), client])).toHaveLength(1);
  });
  test("an import through another file of the module", () => {
    const files = [
      routes("import { sessions } from './sessions.ts'"),
      via("modules/cart/sessions.ts", `${SESS}\nexport const sessions = routes\n`),
      client,
    ];
    expect(run(files)).toHaveLength(1);
  });
  test("a re-export chain through two files, extensionless", () => {
    const files = [
      routes("export * from './a'"),
      via("modules/cart/a.ts", "export { sessions } from './b.ts'\n"),
      via("modules/cart/b.ts", "export { routes as sessions } from '@keel/std-sessions/routes'\n"),
      client,
    ];
    expect(run(files)).toHaveLength(1);
  });
  test("each form is clean on a node deployable, and a cycle without the package is clean", () => {
    expect(run([routes("export * from '@keel/std-sessions/routes'"), node])).toHaveLength(0);
    const cycle = [routes("export * from './a.ts'"), via("modules/cart/a.ts", "export * from './routes.ts'\n"), client];
    expect(run(cycle)).toHaveLength(0);
  });
  test("a record-only chain is clean", () => {
    const files = [
      routes("export * from './rec.ts'"),
      via("modules/cart/rec.ts", "export { record } from '@keel/std-sessions/record'\n"),
      client,
    ];
    expect(run(files)).toHaveLength(0);
  });
  test("dynamic import with a literal reports at the specifier", () => {
    const d = run([
      routes("export const load = () => import('@keel/std-sessions/routes')"),
      topo("web: { modules: ['cart'], adapter: 'static' }"),
    ]);
    expect(d).toHaveLength(1);
  });
  test("dynamic import with a computed argument is not followed", () => {
    const d = run([
      routes("export const load = (n: string) => import(n)"),
      topo("web: { modules: ['cart'], adapter: 'static' }"),
    ]);
    expect(d).toHaveLength(0);
  });
  test("a .js, .jsx or .mjs specifier resolves to its TypeScript source", () => {
    const t = topo("web: { modules: ['cart'], adapter: 'static' }");
    const hop = (ext: string, file: string) =>
      run([
        routes(`export * from './sess.${ext}'`),
        { path: `modules/cart/${file}`, source: `${SESS}\nexport { routes }\n` },
        t,
      ]);
    expect(hop("js", "sess.ts")).toHaveLength(1);
    expect(hop("js", "sess.tsx")).toHaveLength(1);
    expect(hop("jsx", "sess.tsx")).toHaveLength(1);
    expect(hop("mjs", "sess.mts")).toHaveLength(1);
  });
  test("an index.tsx directory import and a .tsx file with JSX are followed", () => {
    const t = topo("web: { modules: ['cart'], adapter: 'static' }");
    const src = `${SESS}\nexport const el = <div />\n`;
    expect(run([routes("export * from './a'"), { path: "modules/cart/a/index.tsx", source: src }, t])).toHaveLength(1);
    expect(run([routes("export * from './a'"), { path: "modules/cart/a.tsx", source: src }, t])).toHaveLength(1);
  });
  test("type-only import and re-export are erased and clean", () => {
    const t = topo("web: { modules: ['cart'], adapter: 'static' }");
    expect(run([routes("import type { routes } from '@keel/std-sessions/routes'"), t])).toHaveLength(0);
    expect(run([routes("export type { routes } from '@keel/std-sessions/routes'"), t])).toHaveLength(0);
    expect(run([routes("export type * from '@keel/std-sessions/routes'"), t])).toHaveLength(0);
  });
  test("a template literal without substitutions is a literal specifier", () => {
    const t = topo("web: { modules: ['cart'], adapter: 'static' }");
    expect(run([routes("export const l = () => import(`@keel/std-sessions/routes`)"), t])).toHaveLength(1);
    expect(run([routes("export const l = (n: string) => import(`@keel/${n}`)"), t])).toHaveLength(0);
  });
});
