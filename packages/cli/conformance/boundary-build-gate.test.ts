// Spec: k.boundary, clause "A page importing `./x.server.ts?raw` or `?url`, a plain file calling `loader`, or one importing `node:path` fails `vite build` with one E1007 naming the chain; `keel build` stops at `keel check`."
// k.boundary, Build gate "`keel build` runs `keel check` first; an error ends it with exit 1 and nothing written, a warning does not. `vite build` alone runs no check; the stubs and E1007 still hold."
// Seed 1337 (no random input). The real binary over the node fixture of boundary-support.ts with one change each; `.keel/` and `dist/` are read after the run.
// The error is unrelated to the boundary: a Node-only global (E1759) in a browser file that nothing imports. The warning case spreads an entry into the binding after one `keel build` has written `.keel/routes.json` (W1005).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SLOW, cleanup, keelRun, linesWith, materialize, nodeTree, viteBuild, withFiles } from "./boundary-support.ts";

const BADGE =
  "import { Text } from '@keel/ui'\nexport default function Badge() {\n  return <Text>{String(process.env.X)}</Text>\n}\n";
const WARN = (nodeTree("node")["modules/a/routes.ts"] ?? "").replace(
  "'a.home': { component: Home },",
  "...{ 'a.home': { component: Home } },",
);

let errored = "";
let warned = "";
let erroredCheck: ReturnType<typeof keelRun>;
let erroredBuild: ReturnType<typeof keelRun>;
let warnedCheck: ReturnType<typeof keelRun>;
let warnedBuild: ReturnType<typeof keelRun>;
beforeAll(() => {
  errored = materialize(withFiles(nodeTree("node"), { "modules/a/Badge.tsx": BADGE }));
  warned = materialize(withFiles(nodeTree("node"), { "modules/a/routes.ts": WARN }));
  erroredCheck = keelRun(errored, ["check"]);
  erroredBuild = keelRun(errored, ["build"]);
  keelRun(warned, ["build"]);
  warnedCheck = keelRun(warned, ["check"]);
  warnedBuild = keelRun(warned, ["build"]);
}, SLOW);
afterAll(() => {
  cleanup(errored);
  cleanup(warned);
});

describe("k.boundary: `keel build` runs `keel check` first and stops on any error", () => {
  test("the fixture's one diagnostic is an E1759 in `modules/a/Badge.tsx`, as `keel check` reports it", () => {
    expect(erroredCheck.status, erroredCheck.out).toBe(1);
    const diags = linesWith(erroredCheck.out, '"kind":"diag"');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toContain('"code":"E1759"');
    expect(diags[0]).toContain("modules/a/Badge.tsx");
  });

  test("`keel build` of it exits 1 and prints that E1759 record and its summary", () => {
    expect(erroredBuild.status, erroredBuild.out).toBe(1);
    const diags = linesWith(erroredBuild.out, '"E1759"');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toContain("modules/a/Badge.tsx");
    const summary = linesWith(erroredBuild.out, '"kind":"summary"');
    expect(summary).toHaveLength(1);
    expect(summary[0]).toContain('"ok":false');
    expect(summary[0]).toContain('"errors":1');
  });

  test("it writes no `dist/` and no `.keel/` file", () => {
    expect(erroredBuild.status, erroredBuild.out).toBe(1);
    expect(existsSync(join(errored, "dist"))).toBe(false);
    expect(existsSync(join(errored, ".keel"))).toBe(false);
  });
});

describe("k.boundary: a warning does not stop `keel build`", () => {
  // ASSUMED: W1005 is reserved (k.compiler Rules), so the spread no longer gives a warning; the fixture's check reports no error, no W1005 and exits 0.
  test("the fixture's `keel check` reports no error and no W1005", () => {
    expect(linesWith(warnedCheck.out, '"W1005"')).toEqual([]);
    expect(linesWith(warnedCheck.out, '"code":"E')).toEqual([]);
    expect(warnedCheck.status, warnedCheck.out).toBe(0);
  });

  test("`keel build` of it exits 0 and writes `dist/`", () => {
    expect(warnedBuild.status, warnedBuild.out).toBe(0);
    expect(existsSync(join(warned, "dist", "api", "server.mjs"))).toBe(true);
  });
});

describe("k.boundary: `vite build` alone runs no check", () => {
  test("the errored fixture builds under `vite build` with `KEEL_DEPLOYABLE=api`: the E1759 file stops nothing there", () => {
    const r = viteBuild(errored, "api");
    expect(r.status, r.out).toBe(0);
  });
});
