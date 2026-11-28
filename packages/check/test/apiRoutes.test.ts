// k.api in keel check: E1511 for an API entry of a contract in a module a `client` or `static` deployable serves.
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { SourceFile } from "../src/index.ts";

const PATH = "modules/a/a.contract.ts";
const HEAD = "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\n";
const contractOf = (body: string): SourceFile => ({ path: PATH, source: `${HEAD}${body}` });

describe("E1511 API entry without a server", () => {
  const api = contractOf(
    "export const a = contract('a', { 'a.list': { method: 'GET', path: '/api/list', output: s.json() } })\n",
  );
  const run = (adapter: "client" | "static" | "node", files: SourceFile[] = [api]) =>
    check(files, { types: false, topology: { web: { modules: ["a"], adapter } } }).diagnostics.filter(
      (d) => d.code === "E1511",
    );

  it.each(["client", "static"] as const)("a %s deployable serving it is E1511 at topology.ts", (adapter) => {
    expect(run(adapter).map((d) => [d.code, d.path, d.see, d.message])).toEqual([
      ["E1511", "topology.ts", "k.api", `a.list: API route in ${adapter} deployable web, which has no server`],
    ]);
  });

  it("a node deployable serving it is clean", () => {
    expect(run("node")).toEqual([]);
  });

  it("a page or a layout in a client deployable is clean", () => {
    const page = contractOf(
      "export const a = contract('a', { 'a.home': { path: '/' }, 'a.shell': { layout: true } })\n",
    );
    expect(run("client", [page])).toEqual([]);
  });

  it("an API entry whose entries are a top-level const is E1511 from source alone", () => {
    const held = contractOf(
      "const entries = { 'a.list': { method: 'POST', path: '/api/list', body: s.json(), output: s.json() } }\nexport const a = contract('a', entries)\n",
    );
    expect(run("client", [held]).map((d) => d.message)).toEqual([
      "a.list: API route in client deployable web, which has no server",
    ]);
    expect(run("node", [held])).toEqual([]);
  });

  it("an API entry the source cannot read is E1511 from the evaluated routes.json, as createApp throws", () => {
    const json = (on: boolean): SourceFile => ({
      path: ".keel/routes.json",
      source: JSON.stringify({ "a.list": { ...(on && { api: true }), module: "a", path: "/api/list" } }),
    });
    const files = [contractOf("export const a = contract('a', make())\n")];
    expect(run("client", files)).toEqual([]);
    expect(run("client", [...files, json(true)])).toHaveLength(1);
    expect(run("client", [...files, json(false)])).toEqual([]);
  });

  it("points at the module id in an app's topology.ts", () => {
    const top = {
      path: "apps/x/topology.ts",
      source: "export default topology({\n  web: { modules: ['a'], adapter: 'client' },\n})\n",
    };
    const ds = check([top, { ...api, path: `apps/x/${PATH}` }], { types: false }).diagnostics;
    expect(ds.filter((d) => d.code === "E1511").map((d) => `${d.code} ${d.path}:${d.line}:${d.col}`)).toEqual([
      "E1511 apps/x/topology.ts:2:20",
    ]);
  });
});
