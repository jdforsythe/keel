// Spec: k.scaffold, Service "`keel scaffold service <module>` takes `--openapi <file>` or `--base <url>`, one of them." and "`reason` from `--reason <text>`, and without one it is E1358."
// Spec: k.scaffold, Generators "`route`: ... `no-loader` with `api` is E1052" (flags `--no-loader`, `--api`).
// The real binary, one fixed project per case; refusals write nothing; E1052 is a usage error (exit 2, k.cli Output), the others exit 1.
import { afterAll, describe, expect, it } from "vitest";
import { type Files, ORDERS_OPENAPI, fresh } from "./fixtures.ts";
import { cleanup, keel, materialize, readTree } from "./keel-cli.ts";
import { ORIGIN, REASON, diagCodes, freshNode, text } from "./service-base-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

function refuses(tree: Files, args: string[], code: string): string {
  const exit = code === "E1052" ? 2 : 1;
  const dir = materialize(tree);
  dirs.push(dir);
  const before = readTree(dir);
  const r = keel(dir, args);
  expect(r.status, text(r.records)).toBe(exit);
  expect(diagCodes(r.records), text(r.records)).toContain(code);
  expect(readTree(dir)).toEqual(before);
  return text(r.records);
}
const withOpenApi = (tree: Files): Files => {
  tree.set("openapi.json", `${ORDERS_OPENAPI}\n`);
  return tree;
};

describe("keel scaffold service flags", () => {
  it("--base with no --reason in the default project is E1358 naming web and the origin, exit 1, nothing written", () => {
    const t = refuses(fresh(), ["scaffold", "service", "orders", "--base", ORIGIN], "E1358");
    expect(t).toContain("web");
    expect(t).toContain(ORIGIN);
  }, 60000);
  it("--openapi with no --reason in the default project is E1358 naming web and the origin, exit 1, nothing written", () => {
    const t = refuses(withOpenApi(fresh()), ["scaffold", "service", "orders", "--openapi", "openapi.json"], "E1358");
    expect(t).toContain("web");
    expect(t).toContain(ORIGIN);
  }, 60000);
  it("--base --reason in the default project creates the two files and changes package.json and topology.ts", () => {
    const dir = materialize(fresh());
    dirs.push(dir);
    const r = keel(dir, ["scaffold", "service", "orders", "--base", ORIGIN, "--reason", REASON]);
    expect(r.status, text(r.records)).toBe(0);
    const edits = r.records.filter((x) => x.kind === "scaffold.edit").map((x) => `${x.action} ${x.path}`);
    expect([...edits].sort()).toEqual(
      [
        "create modules/orders/OrdersApi.schema.ts",
        "create modules/orders/api.server.ts",
        "change package.json",
        "change topology.ts",
      ].sort(),
    );
  }, 120000);
  it("--reason in a node project is E1052", () => {
    refuses(freshNode(), ["scaffold", "service", "orders", "--base", ORIGIN, "--reason", REASON], "E1052");
  }, 60000);
  it("--base together with --openapi is E1052", () => {
    refuses(
      withOpenApi(freshNode()),
      ["scaffold", "service", "orders", "--base", ORIGIN, "--openapi", "openapi.json"],
      "E1052",
    );
  }, 60000);
  it("neither --base nor --openapi is E1052", () => {
    refuses(freshNode(), ["scaffold", "service", "orders"], "E1052");
  }, 60000);
  it("--base that is not an absolute http or https URL is E1052", () => {
    refuses(freshNode(), ["scaffold", "service", "orders", "--base", "ftp://a.example"], "E1052");
  }, 60000);
  it("--base http://api.example.com with a reason in the default project is E1353 naming E1590", () => {
    const t = refuses(
      fresh(),
      ["scaffold", "service", "orders", "--base", "http://api.example.com", "--reason", REASON],
      "E1353",
    );
    expect(t).toContain("E1590");
  }, 60000);
});

describe("keel scaffold route --no-loader", () => {
  it("creates the page and the test, binds { component }, writes no *.server.ts", () => {
    const dir = materialize(fresh());
    dirs.push(dir);
    const before = readTree(dir);
    const r = keel(dir, ["scaffold", "route", "app.home", "--path", "/", "--no-loader"]);
    expect(r.status, text(r.records)).toBe(0);
    const created = r.records
      .filter((x) => x.kind === "scaffold.edit" && x.action === "create")
      .map((x) => String(x.path));
    expect(created).toHaveLength(2);
    expect(created.filter((p) => p.endsWith(".server.ts"))).toEqual([]);
    const after = readTree(dir);
    expect([...after.keys()].filter((p) => !before.has(p) && p.endsWith(".server.ts"))).toEqual([]);
    expect(after.get("modules/app/routes.ts")).toMatch(
      /["']app\.home["']\s*:\s*\{\s*component(?:\s*:\s*\w+)?\s*,?\s*\}/,
    );
  }, 120000);
  it("--no-loader with --api is E1052, exit 2, nothing written", () => {
    refuses(fresh(), ["scaffold", "route", "app.hook", "--path", "/hook", "--api", "--no-loader"], "E1052");
  }, 60000);
});
