// The imports `toTest` writes are in the order the repo's formatter leaves them (biome's organized imports), in both forms. Seed 1337
import { spawnSync } from "node:child_process";
import nodePath from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import { expect, test } from "vitest";
import { Session } from "../src/Session.schema.ts";
import { toTest } from "../src/toTest.ts";

const REPO_ROOT = repoRoot(import.meta.dirname);
const BIOME = nodePath.join(REPO_ROOT, "node_modules/.bin/biome");

const parsed = Session.parse({
  v: 1,
  id: "s1",
  seed: 1337,
  deterministic: true,
  at: 0,
  route: { id: "ops.home", params: {}, search: {} },
  state: {},
  events: [],
  error: null,
  fingerprint: "f",
});
if (!parsed.ok) throw new Error("fixture session does not parse");
const session = parsed.value;
const routes = [
  { module: "ops", from: "../modules/ops/routes.ts", contract: "" },
  { module: "sessions", from: "@keel/std-sessions/routes", contract: "" },
];

/** The import lines of `text` as biome leaves them, and as `toTest` wrote them. */
function importLines(text: string): { written: string[]; formatted: string[] } {
  const run = spawnSync(
    BIOME,
    [
      "check",
      "--write",
      `--config-path=${nodePath.join(REPO_ROOT, "biome.json")}`,
      "--stdin-file-path=test/session-f.test.ts",
    ],
    { input: text, encoding: "utf8", cwd: REPO_ROOT },
  );
  const only = (t: string): string[] => t.split("\n").filter((l) => l.startsWith("import "));
  return { written: only(text), formatted: only(run.stdout) };
}

test("the client form's imports are in the formatter's order", () => {
  const { written, formatted } = importLines(toTest(session, { navs: [], stores: [], routes }));
  expect(formatted.length).toBeGreaterThan(4);
  expect(written).toEqual(formatted);
});

test("the node form's imports are in the formatter's order", () => {
  const { written, formatted } = importLines(
    toTest(session, {
      navs: [],
      stores: [],
      routes,
      serve: { deployable: "web", topology: "../topology.ts", identity: "../identity.server.ts" },
    }),
  );
  expect(formatted.length).toBeGreaterThan(6);
  expect(written).toEqual(formatted);
});
