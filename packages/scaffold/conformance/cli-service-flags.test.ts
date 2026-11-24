// Spec: k.scaffold-service, Input "`keel scaffold service <module>` takes `--openapi <file>` or `--base <url>`, one of them." and, Edits, "`reason` from `--reason <text>`, and without one it is E1358."
// Spec: k.scaffold-service, Conformance "In the `node` project holding as `openapi.json` an OpenAPI 3 document k.openapi accepts, `keel scaffold service orders --openapi openapi.json --name gitHub` creates exactly `modules/orders/GitHubApi.schema.ts` (one export, `GitHubApi`) and `modules/orders/api.server.ts` (one export, `api`, importing `./GitHubApi.schema.ts`), each with the generated first line, and leaves `keel check` clean; with `--name GitHub` it is E1352, nothing written."
// Spec: k.scaffold-service, Input "It is lowerCamel, as a module id is (else E1352, nothing written, in either form)"; E1352 not E1052 for a bad --name with --openapi (RFC 0210).
// seed 1337 (the --name property below).
// Spec: k.scaffold, Generators "`route`: ... `no-loader` with `api` is E1052" (flags `--no-loader`, `--api`).
// The real binary, one fixed project per case; refusals write nothing; E1052 is a usage error (exit 2, k.cli Output), the others exit 1.
import fc from "fast-check";
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

describe("keel scaffold service --name", () => {
  const firstLine = (src: string): string => src.split("\n")[0] ?? "";
  const exportNames = (src: string): string[] =>
    [...src.matchAll(/^export\s+(?:const|function|class|let|var|default)\s+(\w+)/gm)].map((m) => m[1] ?? "");
  it("--openapi openapi.json --name gitHub creates exactly GitHubApi.schema.ts (one export, GitHubApi) and api.server.ts (one export, api, importing ./GitHubApi.schema.ts), each with the generated first line, and keel check is clean", () => {
    const tree = withOpenApi(freshNode());
    const dir = materialize(tree);
    dirs.push(dir);
    const before = readTree(dir);
    const r = keel(dir, ["scaffold", "service", "orders", "--openapi", "openapi.json", "--name", "gitHub"]);
    expect(r.status, text(r.records)).toBe(0);
    const after = readTree(dir);
    const created = [...after.keys()].filter((p) => !before.has(p)).sort();
    expect(created).toEqual(["modules/orders/GitHubApi.schema.ts", "modules/orders/api.server.ts"]);
    const schema = after.get("modules/orders/GitHubApi.schema.ts") ?? "";
    const service = after.get("modules/orders/api.server.ts") ?? "";
    expect(exportNames(schema)).toEqual(["GitHubApi"]);
    expect(exportNames(service)).toEqual(["api"]);
    expect(service).toContain("./GitHubApi.schema.ts");
    expect(firstLine(schema)).toMatch(/generated/i);
    expect(firstLine(service)).toMatch(/generated/i);
    const check = keel(dir, ["check"]);
    expect(check.status, text(check.records)).toBe(0);
    expect(check.records.filter((x) => x.kind === "diag")).toEqual([]);
  }, 120000);
  it("--openapi with --name GitHub is E1352, exit 1, nothing written", () => {
    refuses(
      withOpenApi(freshNode()),
      ["scaffold", "service", "orders", "--openapi", "openapi.json", "--name", "GitHub"],
      "E1352",
    );
  }, 60000);
  it("--base with --name GitHub is E1352, exit 1, nothing written", () => {
    refuses(freshNode(), ["scaffold", "service", "orders", "--base", ORIGIN, "--name", "GitHub"], "E1352");
  }, 60000);
  it("a --name outside lowerCamel (git_hub, git-hub, 1x) is E1352 in both forms, never E1052, nothing written", () => {
    fc.assert(
      fc.property(fc.constantFrom("git_hub", "git-hub", "1x", "Orders", "a b"), fc.boolean(), (name, openapi) => {
        const t = openapi
          ? refuses(
              withOpenApi(freshNode()),
              ["scaffold", "service", "orders", "--openapi", "openapi.json", "--name", name],
              "E1352",
            )
          : refuses(freshNode(), ["scaffold", "service", "orders", "--base", ORIGIN, "--name", name], "E1352");
        expect(t).not.toContain("E1052");
      }),
      { seed: 1337, numRuns: 6 },
    );
  }, 240000);
  it("with a --name, a second scaffolded service in the module is E1351 on api.server.ts", () => {
    const tree = withOpenApi(freshNode());
    const dir = materialize(tree);
    dirs.push(dir);
    const first = keel(dir, ["scaffold", "service", "orders", "--base", ORIGIN, "--name", "gitHub"]);
    expect(first.status, text(first.records)).toBe(0);
    const before = readTree(dir);
    const r = keel(dir, ["scaffold", "service", "orders", "--openapi", "openapi.json", "--name", "other"]);
    expect(r.status, text(r.records)).toBe(1);
    expect(diagCodes(r.records)).toContain("E1351");
    expect(text(r.records)).toContain("modules/orders/api.server.ts");
    expect(readTree(dir)).toEqual(before);
  }, 120000);
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
