// Spec: k.ledger-items, clause "In an app with no test file, whose route tables give one page route and which has no `reports/`, `keel ledger --diff` after `keel ledger --write .keel/ledger.json` reports one W1733 at `reports/a11y.json`; with route tables giving only an API entry, or no `routes.ts`, it reports no W1733."
// Seed 1337 (recorded); no random inputs. The real `keel` binary over temp projects (OS tmpdir, `@keel/*` linked): the app is the project `.`, and has no `.keel/` folder, so its route tables are read through their derivation (k.derived Readers).
// Page route: module `m`'s `m.r` at `/r` (moduleFiles of a11y-project-support.ts). API entry: `m.g`, a GET at `/api/g` with a loader.
// The case "with a `reports/a11y.json`" states k.ledger-items Run evidence ("A project with a page route and no `reports/a11y.json` is W1733 at that path") and is not part of the clause's one sentence.
// ASSUMED: `keel ledger --diff` takes the file `keel ledger --write` wrote at `.keel/ledger.json`, as the clause words it, with no argument.
import { rmSync } from "node:fs";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { keelProject, moduleFiles } from "./a11y-project-support.ts";
import { put } from "./derived-support.ts";
import { diagsOf } from "./ledger-items-support.ts";
import { type Run, keel } from "./test-sim-project.ts";

const SLOW = fixedTime(600_000);
const REPORT = "reports/a11y.json";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const project = (files: Record<string, string>): string => {
  const dir = keelProject("ledger-w1733", files);
  dirs.push(dir);
  return dir;
};
/** `keel ledger --diff` after `keel ledger --write .keel/ledger.json`. */
function diffAfterWrite(dir: string): Run {
  keel(dir, ["ledger", "--write", ".keel/ledger.json"], { reports: "none" });
  return keel(dir, ["ledger", "--diff"], { reports: "none" });
}
const w1733 = (run: Run): string[] => diagsOf(run, "W1733").map((d) => String(d.path));

const API_ONLY: Record<string, string> = {
  "topology.ts": moduleFiles(["r"], false)["topology.ts"] ?? "",
  "modules/m/m.contract.ts": [
    'import { contract } from "@keel/router/contract";',
    'import { s } from "@keel/schema";',
    "",
    'export const m = contract("m", {',
    '  "m.g": { method: "GET", path: "/api/g", output: s.object({}) },',
    "});",
    "",
  ].join("\n"),
  "modules/m/routes.ts": [
    'import { loader, manifest } from "@keel/router";',
    'import { ok } from "@keel/schema";',
    'import { m } from "./m.contract.ts";',
    "",
    'const g = loader(m, "m.g", {}, async () => ok({}));',
    "",
    'export const routes = manifest(m, { "m.g": { loader: g } });',
    "",
  ].join("\n"),
};

describe("k.ledger-items: W1733 for `reports/a11y.json`", () => {
  test(
    "In an app with no test file, whose route tables give one page route and which has no `reports/`, `keel ledger --diff` after `keel ledger --write .keel/ledger.json` reports one W1733 at `reports/a11y.json`",
    () => {
      const dir = project(moduleFiles(["r"], false));
      expect(w1733(diffAfterWrite(dir))).toEqual([REPORT]);
    },
    SLOW,
  );

  test(
    "with route tables giving only an API entry, `keel ledger --diff` after `keel ledger --write .keel/ledger.json` reports no W1733",
    () => {
      const dir = project(API_ONLY);
      expect(w1733(diffAfterWrite(dir))).toEqual([]);
    },
    SLOW,
  );

  test(
    "with no `routes.ts`, `keel ledger --diff` after `keel ledger --write .keel/ledger.json` reports no W1733",
    () => {
      const dir = project({ "topology.ts": moduleFiles(["r"], false)["topology.ts"] ?? "" });
      expect(w1733(diffAfterWrite(dir))).toEqual([]);
    },
    SLOW,
  );

  test(
    "with route tables giving one page route and one API entry, `keel ledger --diff` reports one W1733 at `reports/a11y.json`",
    () => {
      const dir = project({
        ...API_ONLY,
        "modules/m/m.contract.ts":
          API_ONLY["modules/m/m.contract.ts"]?.replace('  "m.g":', '  "m.r": { path: "/r" },\n  "m.g":') ?? "",
        "modules/m/routes.ts":
          API_ONLY["modules/m/routes.ts"]?.replace(
            '{ "m.g": { loader: g } }',
            '{ "m.r": { component: () => null, title: () => "r" }, "m.g": { loader: g } }',
          ) ?? "",
      });
      expect(w1733(diffAfterWrite(dir))).toEqual([REPORT]);
    },
    SLOW,
  );

  test(
    "with a `reports/a11y.json` beside the one page route, `keel ledger --diff` after `keel ledger --write .keel/ledger.json` reports no W1733 at it",
    () => {
      const dir = project(moduleFiles(["r"], false));
      put(dir, REPORT, "[]\n");
      expect(w1733(diffAfterWrite(dir))).toEqual([]);
    },
    SLOW,
  );
});
