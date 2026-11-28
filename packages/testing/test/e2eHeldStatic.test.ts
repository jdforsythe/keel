// @vitest-environment node
// k.e2e-page `hold` on a `static` document whose head loads the scheme script (k.schemes First paint): the fixture
// project `e2e-static-fixture/` copied to a temporary folder with `@keel/*`, `@types/node`, vitest, vite, typescript
// and playwright-core linked, `keel test --e2e` run on it once, and its test's outcome read from
// `reports/tests/e2e.json`. Needs Chromium (`playwright-core install chromium`).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const FIXTURE = join(HERE, "..", "e2e-static-fixture");

let dir = "";
let out = "";
let report: unknown;

beforeAll(() => {
  dir = tempDir("keel-e2e-held-static-");
  cpSync(FIXTURE, dir, { recursive: true });
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  mkdirSync(join(dir, "node_modules", "@types"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages")))
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules", "@keel", pkg));
  symlinkSync(join(HERE, "..", "node_modules", "@types", "node"), join(dir, "node_modules", "@types", "node"));
  for (const name of ["vitest", "vite", "typescript", "fast-check", "playwright-core"])
    symlinkSync(join(REPO, "node_modules", name), join(dir, "node_modules", name));
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !/^(?:VITEST|KEEL_)|^(?:NODE_OPTIONS|NODE_ENV|TEST)$/.test(k)) env[k] = v;
  // One build of the fixture and one file in a browser: the machine's own work, so fixed time.
  const r = spawnSync(
    process.execPath,
    [join(REPO, "packages", "cli", "src", "bin.ts"), "test", "--e2e", "--format=compact"],
    {
      cwd: dir,
      encoding: "utf8",
      env: { ...env, KEEL_TEST_TIME_SCALE: "1" },
      timeout: fixedTime(300_000),
      killSignal: "SIGKILL",
    },
  );
  out = `${r.stdout}\n${r.stderr}`;
  const at = join(dir, "reports", "tests", "e2e.json");
  report = existsSync(at) ? JSON.parse(readFileSync(at, "utf8")) : undefined;
}, fixedTime(360_000));
afterAll(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
});

/** The states `e2e.json` records for `file`, in order. */
function states(file: string): string[] {
  const files = typeof report === "object" && report !== null ? Reflect.get(report, "files") : undefined;
  const entry = typeof files === "object" && files !== null ? Reflect.get(files, file) : undefined;
  const tests: unknown = typeof entry === "object" && entry !== null ? Reflect.get(entry, "tests") : undefined;
  return Array.isArray(tests) ? tests.map((t) => String(Reflect.get(Object(t), "state"))) : [];
}

describe("k.e2e-page hold on a static document", () => {
  it("the built document's head loads the scheme script with neither async nor defer", () => {
    const html = readFileSync(join(dir, "dist", "site", "index.html"), "utf8");
    expect(html).toMatch(/<head>.*<script src="\/assets\/keel-scheme-[0-9a-f]+\.js"><\/script>.*<\/head>/s);
  });

  it("open with hold runs the scheme script as the parser reaches it, and the page resumes in place", () => {
    expect(states("test/held.e2e.ts"), out.slice(-3000)).toEqual(["passed"]);
  });
});
