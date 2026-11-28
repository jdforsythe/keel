// @vitest-environment node
// Spec: k.e2e-run, clause "A run under a non-root user on Linux or macOS launches Chromium with its sandbox on and prints no W1734; the same run as root on Linux prints one W1734 `chromium sandbox off: running as root` and passes."
// Spec: k.e2e-run, clause "The browser of a run starts with a profile folder inside the run folder that holds no file before its first `open`, and no file outside the run folder is written by it."
// Spec: k.e2e-run, clause "A page's request to `https://example.org/x`, an origin the run does not serve or map, reaches no server, fails in the page as a network error, and leaves `{ kind: 'offsite', text: 'GET https://example.org/x' }` among `problems()`."
// Spec: k.e2e-run, clause "Each deployable a `serve` starts listens on `127.0.0.1` alone: a connection to its port on the machine's other addresses is refused."
// Spec: k.e2e-run, clause "With `AWS_SECRET_ACCESS_KEY=k` in the run's environment, a served deployable's route that answers `process.env.AWS_SECRET_ACCESS_KEY ?? 'none'` answers `none`, and `k` when the test passes it in `env`."
// Spec: k.e2e-run, clause "A `serve` that fails with `EEXIST` from the file system makes the test's T0001 message begin `uncaught: EEXIST`, with no `fix:` line."
// k.e2e-run Rules E1734 is asserted by packages/cli/conformance/e2e-command.test.ts; W1734 by the first and second cases.
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts over fixtures/e2e/node-app.ts, `extra-pages.ts`; each case is a project of its own (e2e-support.ts `runJobs`), a feature the handle may lack failing its own build alone. The cases need Chromium; none skips but where stated.
// Observation seams (the spec states none for launch options, so each is read from outside the product): the sandbox flag from the browser's own command line (`ps`): Playwright adds `--no-sandbox` to a Chromium it launches with the sandbox off; the browser of this run is the one whose
// `--user-data-dir` lies under the run's `TMPDIR` (the runner points it at the run folder, k.e2e-run Teardown).
// SKIPPED with a stated reason: the root-on-Linux case needs a root user on Linux (`process.getuid() === 0`); the non-root case needs the opposite; the loopback-address half of the listen case needs a non-loopback address of this machine (`os.networkInterfaces()`), else only the bound address is asserted.
// UNTESTABLE: E1734 `chromium cannot start its sandbox here` (Browser, Rules; no Conformance bullet): a test cannot make the kernel or container refuse unprivileged user namespaces, and the spec names no seam or the setting its fix names.
// UNTESTABLE: "holds no file before its first `open`" (the profile folder's content before the browser starts is not observable from a test); the case asserts the folder is inside the run folder, is not the user's, and that nothing is written outside the run folder.
// ASSUMED: (1) a SIGKILL-free run leaves the private `HOME` empty and the private `TMPDIR` empty but for Node's `node-compile-cache` of the `keel` process: the browser (which gets no `HOME`, Environment) writes in neither, and the run folder is removed; (2) `offsite` is raised for a `fetch` of the page to an origin the topology's `origins` declares for the policy but the `serve` does not map;
// (3) the served route answers `aws`, `home`, `tmp` as `a.env`'s `EnvOut` fields (fixtures/e2e/node-app.ts `awsApp`); (4) for the EEXIST clause the test removes `.keel/` and writes a regular file at that path before `serve`, so the library host folder cannot be made: the system error code may be EEXIST or ENOTDIR by platform (AMBIGUOUS: the spec names no way to provoke EEXIST from outside),
// and the case asserts `uncaught: ` then the system error's code, and no `fix:` line.
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { library } from "./e2e-library-support.ts";
import {
  FAILURE,
  type Ran,
  SUPPORT_ENV,
  cleanup,
  failureOf,
  outcome,
  passedJob,
  runJobs,
  suite,
} from "./e2e-support.ts";
import { EXTRA, EXTRA_FILES } from "./fixtures/e2e/extra-pages.ts";
import { PAGES, awsApp, nodeApp } from "./fixtures/e2e/node-app.ts";
import { fixedTime } from "@keel/tooling/test-time";

// The private HOME of the profile case would hide the browser the machine installed: the browsers' own folder is named.
const browsers =
  process.env.PLAYWRIGHT_BROWSERS_PATH ??
  (process.platform === "darwin"
    ? join(homedir(), "Library", "Caches", "ms-playwright")
    : join(homedir(), ".cache", "ms-playwright"));
const root = typeof process.getuid === "function" && process.getuid() === 0;
const rootLinux = root && process.platform === "linux";
const lan = Object.values(networkInterfaces())
  .flatMap((a) => a ?? [])
  .find((i) => !i.internal && i.family === "IPv4")?.address;
const IMPORTS = [
  "import { spawnSync } from 'node:child_process'",
  "import { serve } from '@keel/testing/e2e'",
  "import { failure } from './failure.ts'",
  "import { envOf, refused } from './support.ts'",
];
const EX = ", origins: { connect: { 'https://example.org': 'ex' } }";

const sandbox = suite(IMPORTS, [
  {
    title: "the browser of the run is launched with its sandbox",
    body: `const app = await serve()
await app.open('/')
const run = process.env.TMPDIR ?? ''
const ps = spawnSync('ps', ['-A', '-o', 'command='], { encoding: 'utf8' }).stdout.split('\\n')
const mine = ps.filter((l) => l.includes('--user-data-dir=' + run))
expect(mine.length).toBeGreaterThan(0)
expect(mine.some((l) => l.includes('--no-sandbox'))).toBe(false)`,
  },
]);
const rooted = suite(IMPORTS, [
  {
    title: "as root the run goes on with the sandbox off",
    body: `const app = await serve()
await app.open('/')
expect(spawnSync('ps', ['-A', '-o', 'command='], { encoding: 'utf8' }).stdout).toContain('--no-sandbox')`,
  },
]);
const profile = suite(IMPORTS, [
  {
    title: "the profile folder is inside the run folder",
    body: `const app = await serve()
await app.open('/')
const run = process.env.TMPDIR ?? ''
const ps = spawnSync('ps', ['-A', '-o', 'command='], { encoding: 'utf8' }).stdout.split('\\n')
const dirs = ps.flatMap((l) => (/--user-data-dir=(\\S+)/.exec(l)?.[1] ?? '')).filter((d) => d.startsWith(run))
expect(dirs.length).toBeGreaterThan(0)
expect(run).toMatch(/keel-e2e-/)`,
  },
]);
const offsite = suite(IMPORTS, [
  {
    title: "a request to an origin the run does not serve or map is an offsite problem",
    body: `const app = await serve()
const page = await app.open('/offsite')
await page.fire('a.offsite.go', { type: 'click' })
await page.until('a.offsite.out', { text: 'failed' })
expect(page.problems({ kind: 'offsite', text: 'GET https://example.org/x' })).toEqual([{ kind: 'offsite', text: 'GET https://example.org/x' }])
page.problems({ kind: 'console', text: /./ })`,
  },
]);
const listen = suite(
  ["import { answer, serve } from '@keel/testing/e2e'", "import { refused } from './support.ts'"],
  [
    {
      title: "each deployable and each answer listens on 127.0.0.1 alone",
      body: `const lan = process.env.KEEL_LAN ?? ''
const answered = await answer(() => new Response('ok'))
const app = await serve()
for (const origin of [app.origin(), answered.origin]) {
  expect(new URL(origin).hostname).toBe('127.0.0.1')
  if (lan !== '') expect(await refused('http://' + lan + ':' + new URL(origin).port)).toBe(true)
}`,
    },
  ],
);
const environment = suite(IMPORTS, [
  {
    title: "a name outside the allowlist reaches the served process only through env",
    body: `const plain = await serve()
const seen = await envOf(plain, 'api')
expect(seen.aws).toBe('none')
const given = await serve({ env: { AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? '' } })
expect((await envOf(given, 'api')).aws).toBe('k')
const path = (seen.data ?? '').replace(/^file:/, '')
const data = path.slice(0, path.lastIndexOf('/'))
expect((seen.home ?? '').startsWith(data)).toBe(true)
expect((seen.tmp ?? '').startsWith(data)).toBe(true)`,
  },
]);
const uncaught = suite(
  ["import { rmSync, writeFileSync } from 'node:fs'", "import { serve } from '@keel/testing/e2e'"],
  [
    {
      title: "a system error of serve is an uncaught T0001",
      body: `rmSync('.keel', { recursive: true, force: true })
writeFileSync('.keel', 'a file where the host folder goes')
await serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' } })`,
    },
  ],
);

const FILE = "test/run.e2e.ts";
let ran = new Map<string, Ran>();
let homes: string[] = [];
let tmps: string[] = [];
const empty = (): string => {
  const d = mkdtempSync(join(tmpdir(), "keel-private-"));
  homes.push(d);
  return d;
};

beforeAll(() => {
  const support = { "test/failure.ts": FAILURE, "test/support.ts": SUPPORT_ENV, ...EXTRA_FILES };
  const pages = Object.values(PAGES);
  const home = empty();
  const tmp = empty();
  tmps = [home, tmp];
  ran = runJobs([
    { key: "sandbox", tree: { ...nodeApp(pages), ...support }, file: FILE, source: sandbox.source },
    ...(rootLinux
      ? [{ key: "rooted", tree: { ...nodeApp(pages), ...support }, file: FILE, source: rooted.source }]
      : []),
    {
      key: "profile",
      tree: { ...nodeApp(pages), ...support },
      file: FILE,
      source: profile.source,
      env: { HOME: home, TMPDIR: tmp, PLAYWRIGHT_BROWSERS_PATH: browsers },
    },
    {
      key: "offsite",
      tree: { ...nodeApp([...pages, EXTRA.offsite], [], EX), ...support },
      file: FILE,
      source: offsite.source,
    },
    {
      key: "listen",
      tree: { ...nodeApp(pages), ...support },
      file: FILE,
      source: listen.source,
      env: { KEEL_LAN: lan ?? "" },
    },
    {
      key: "env",
      tree: { ...awsApp(pages), ...support },
      file: FILE,
      source: environment.source,
      env: { AWS_SECRET_ACCESS_KEY: "k" },
    },
    {
      key: "uncaught",
      tree: { ...library(undefined), "test/failure.ts": FAILURE },
      file: FILE,
      source: uncaught.source,
    },
  ]);
}, fixedTime(3_000_000));
afterAll(() => {
  for (const d of homes) rmSync(d, { recursive: true, force: true });
  cleanup();
});

describe("k.e2e-run browser, reach, environment and output", () => {
  it.skipIf(root)(
    "A run under a non-root user on Linux or macOS launches Chromium with its sandbox on and prints no W1734; the same run as root on Linux prints one W1734 `chromium sandbox off: running as root` and passes.",
    () => {
      passedJob(ran, "sandbox", sandbox.lines["the browser of the run is launched with its sandbox"]);
      expect(ran.get("sandbox")?.run.stdout ?? "").not.toContain("W1734");
    },
  );

  it.skipIf(!rootLinux)(
    "as root on Linux the run prints one W1734 `chromium sandbox off: running as root` and passes",
    () => {
      passedJob(ran, "rooted", rooted.lines["as root the run goes on with the sandbox off"]);
      const out = ran.get("rooted")?.run.stdout ?? "";
      expect(out.split("\n").filter((l) => l.includes("W1734"))).toHaveLength(1);
      expect(out).toContain("chromium sandbox off: running as root");
    },
  );

  it("The browser of a run starts with a profile folder inside the run folder that holds no file before its first `open`, and no file outside the run folder is written by it.", () => {
    passedJob(ran, "profile", profile.lines["the profile folder is inside the run folder"]);
    // The clause says what the browser writes: nothing outside the run folder, so the private HOME stays empty and the private TMPDIR holds
    // no run folder and no browser file. Node's own compile cache (`node-compile-cache`) is written by the `keel` process, not the browser, and the clause does not name it.
    const [home, tmp] = tmps;
    expect(readdirSync(home ?? "")).toEqual([]);
    expect(readdirSync(tmp ?? "").filter((n) => n !== "node-compile-cache")).toEqual([]);
  });

  it("A page's request to `https://example.org/x`, an origin the run does not serve or map, reaches no server, fails in the page as a network error, and leaves `{ kind: 'offsite', text: 'GET https://example.org/x' }` among `problems()`.", () => {
    passedJob(
      ran,
      "offsite",
      offsite.lines["a request to an origin the run does not serve or map is an offsite problem"],
    );
  });

  it("Each deployable a `serve` starts listens on `127.0.0.1` alone: a connection to its port on the machine's other addresses is refused.", () => {
    passedJob(ran, "listen", listen.lines["each deployable and each answer listens on 127.0.0.1 alone"]);
  });

  it("With `AWS_SECRET_ACCESS_KEY=k` in the run's environment, a served deployable's route that answers `process.env.AWS_SECRET_ACCESS_KEY ?? 'none'` answers `none`, and `k` when the test passes it in `env`.", () => {
    passedJob(
      ran,
      "env",
      environment.lines["a name outside the allowlist reaches the served process only through env"],
    );
  });

  it("A `serve` that fails with `EEXIST` from the file system makes the test's T0001 message begin `uncaught: EEXIST`, with no `fix:` line.", () => {
    const r = ran.get("uncaught");
    expect(r, "the run exists").toBeDefined();
    if (r === undefined) return;
    expect(outcome(r.dir, FILE, uncaught.lines["a system error of serve is an uncaught T0001"] ?? 0)).toBe("failed");
    const rows = r.run.stdout.split("\n");
    const at = rows.findIndex((l) => l.startsWith(`T0001 ${FILE}:`));
    expect(at).toBeGreaterThanOrEqual(0);
    const line = Number(/^T0001 [^:]+:(\d+):/.exec(rows[at] ?? "")?.[1]);
    const block = failureOf(r.run.stdout, FILE, line) ?? "";
    expect(block.split("\n")[0]).toMatch(/T0001 \S+ uncaught: (EEXIST|ENOTDIR|ENOENT) /);
    expect(block).not.toContain("fix:");
  });
});
