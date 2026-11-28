import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  JOBS,
  SLOW,
  SLOW_JOB,
  bindMounts,
  dockerProblem,
  slowContainer,
  slowEnv,
  slowExecArgs,
  slowParallel,
  slowRunArgs,
  slowSetupScript,
  slowShards,
  slowSteps,
  applyRewrites,
  badWith,
  downloadPatterns,
  expandSteps,
  expr,
  failLines,
  instances,
  keepNodeModules,
  matchesPattern,
  nodeMajor,
  planJobs,
  resultPath,
  parseOutputs,
  stepRuns,
  stepName,
  verdict,
  versionCheck,
  workspaceGlobs,
} from "../gate-plan.mjs";

const setup = [
  { uses: "actions/checkout@abc # v4", with: { "fetch-depth": 0 } },
  { uses: "pnpm/action-setup@def # v6" },
  { uses: "actions/setup-node@123 # v4", with: { "node-version": 22, cache: "pnpm" } },
  { run: "pnpm install --frozen-lockfile" },
];

const fixture = {
  setup,
  jobs: {
    late: { needs: ["first", "middle"], steps: ["$setup", { run: "echo late" }] },
    first: { steps: ["$setup", { run: "echo first" }] },
    middle: { needs: "first", strategy: { matrix: { shard: [1, 2] } }, steps: [{ run: "echo ${{ matrix.shard }}" }] },
    optional: { steps: [{ run: "echo optional" }] },
    never: { steps: [{ run: "echo never" }] },
  },
};

const table = {
  first: { run: true },
  middle: { run: true },
  late: { run: true },
  optional: { skip: "minutes of a toolchain", flag: true },
  never: { skip: "schedule only" },
};

describe("planJobs", () => {
  it("orders the jobs so each runs after its needs, source order among equals", () => {
    const plan = planJobs(fixture, { table });
    expect(plan.unknown).toEqual([]);
    expect(plan.jobs.map((j) => [j.name, j.decision])).toEqual([
      ["first", "run"],
      ["middle", "run"],
      ["late", "run"],
      ["optional", "skip"],
      ["never", "skip"],
    ]);
    expect(plan.jobs.find((j) => j.name === "optional")?.reason).toBe("minutes of a toolchain (--with optional)");
    expect(plan.jobs.find((j) => j.name === "never")?.reason).toBe("schedule only");
  });

  it("names a job the table does not know", () => {
    const source = { jobs: { ...fixture.jobs, brand_new: { steps: [] } } };
    const plan = planJobs(source, { table });
    expect(plan.unknown).toEqual(["brand_new"]);
    expect(plan.jobs.find((j) => j.name === "brand_new")).toEqual({
      name: "brand_new",
      decision: "unknown",
      reason: "unknown job: decide",
    });
  });

  it("runs a flag job with --with, and only --only's jobs with --only", () => {
    const plan = planJobs(fixture, { table, with: new Set(["optional"]), only: new Set(["first", "optional"]) });
    expect(plan.jobs.filter((j) => j.decision === "run").map((j) => j.name)).toEqual(["first", "optional"]);
    expect(plan.jobs.find((j) => j.name === "late")?.reason).toBe("not in --only");
  });

  it("refuses needs that loop", () => {
    const source = { jobs: { a: { needs: "b", steps: [] }, b: { needs: "a", steps: [] } } };
    expect(() => planJobs(source, { table: { a: { run: true }, b: { run: true } } })).toThrow("the needs of a, b loop");
  });

  it("knows every job of the CI source", () => {
    const source = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "ci.source.json"), "utf8"));
    const plan = planJobs(source);
    expect(plan.unknown).toEqual([]);
    expect(Object.keys(JOBS).sort()).toEqual(Object.keys(source.jobs).sort());
  });

  it("refuses --with for a job that is not behind a flag", () => {
    expect(badWith(new Set(["optional", "first", "nope"]), table)).toEqual(["first", "nope"]);
  });
});

describe("expandSteps and instances", () => {
  it("expands $setup in place", () => {
    expect(expandSteps(fixture, "first")).toEqual([...setup, { run: "echo first" }]);
  });
  it("gives one instance per matrix combination", () => {
    expect(instances("middle", fixture.jobs.middle)).toEqual([
      { label: "middle 1", matrix: { shard: 1 } },
      { label: "middle 2", matrix: { shard: 2 } },
    ]);
    expect(instances("first", fixture.jobs.first)).toEqual([{ label: "first", matrix: {} }]);
    const two = instances("x", { strategy: { matrix: { a: [1, 2], b: ["p", "q", "r"] } } });
    expect(two.map((i) => i.label)).toEqual(["x 1 p", "x 1 q", "x 1 r", "x 2 p", "x 2 q", "x 2 r"]);
  });
});

describe("expr", () => {
  const ctx = {
    matrix: { shard: 3 },
    workspace: "/w",
    runnerOs: "macOS",
    runnerArch: "ARM64",
    needs: { check: "success" },
  };
  it("answers the expressions it knows", () => {
    expect(expr("--shard ${{ matrix.shard }}/6", ctx)).toBe("--shard 3/6");
    expect(expr("${{secrets.TURBO_TOKEN}}|${{ vars.TEAM }}", ctx)).toBe("|");
    expect(expr("${{ github.workspace }}/x ${{ runner.os }} ${{ runner.arch }}", ctx)).toBe("/w/x macOS ARM64");
    expect(expr("${{ needs.check.result }}", ctx)).toBe("success");
  });
  it("throws on any other expression", () => {
    expect(() => expr("${{ github.event_name }}", ctx)).toThrow("unknown expression ${{ github.event_name }}");
    expect(() => expr("${{ matrix.other }}", ctx)).toThrow("unknown expression");
    expect(() => expr("${{ needs.build.result }}", ctx)).toThrow("unknown expression");
  });
  it("leaves text without an expression as it is", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("${{")),
        (s) => expr(s, ctx) === s,
      ),
      { numRuns: 200, seed: 1337 },
    );
  });
  it("puts a matrix value where each matrix expression stood", () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z ]{0,6}$/), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 99 }),
        (parts, n) => expr(parts.join("${{ matrix.shard }}"), { matrix: { shard: n } }) === parts.join(String(n)),
      ),
      { numRuns: 200, seed: 1337 },
    );
  });
});

describe("step outputs and conditions", () => {
  it("answers steps.<id>.outputs.<name> from what the step wrote, empty when it wrote nothing", () => {
    const ctx = { steps: { browser: { browser: "true", playwright: "1.50.0" } } };
    expect(expr("pw-${{ steps.browser.outputs.playwright }}", ctx)).toBe("pw-1.50.0");
    expect(expr("${{ steps.browser.outputs.other }}|${{ steps.none.outputs.x }}", ctx)).toBe("|");
    expect(expr("${{ steps.browser.outputs.playwright }}", {})).toBe("");
  });
  it("reads name=value lines and name<<DELIMITER blocks of a GITHUB_OUTPUT file", () => {
    expect(parseOutputs("browser=true\nplaywright=1.50.0\n")).toEqual({ browser: "true", playwright: "1.50.0" });
    expect(parseOutputs("a=1\nlog<<EOF\nx=y\nz\nEOF\nb=a=b\na=2\n")).toEqual({ a: "2", log: "x=y\nz", b: "a=b" });
    expect(parseOutputs("")).toEqual({});
  });
  it("runs a step by its condition: always() after a failure, an output test only while passing, else only while passing", () => {
    const out = { browser: { browser: "true" } };
    expect(stepRuns({ run: "x" }, false)).toBe(true);
    expect(stepRuns({ run: "x" }, true)).toBe(false);
    expect(stepRuns({ run: "x", if: "always()" }, true)).toBe(true);
    const yes = { run: "x", if: "steps.browser.outputs.browser == 'true'" };
    expect(stepRuns(yes, false, out)).toBe(true);
    expect(stepRuns(yes, false, { browser: { browser: "false" } })).toBe(false);
    expect(stepRuns(yes, false, {})).toBe(false);
    expect(stepRuns(yes, true, out)).toBe(false);
    expect(stepRuns({ run: "x", if: "steps.t.outputs.cache-hit != 'true'" }, false, {})).toBe(true);
    expect(() => stepRuns({ run: "x", if: "failure()" }, false)).toThrow('unknown step condition "failure()"');
  });
  it("carries the id and condition of a shard's steps into the container run", () => {
    const { steps } = slowSteps(realSource, 2);
    const probe = steps.find((s) => s.id === "browser");
    expect(probe?.run).toContain("ci-shards.mjs --browser 2");
    expect(steps.filter((s) => s.if === "steps.browser.outputs.browser == 'true'").length).toBeGreaterThan(0);
  });
  it("gives every job's steps only expressions and conditions the gate answers", () => {
    const names = Object.keys(realSource.jobs).filter((n) => JOBS[n]?.run === true);
    const ctx = { matrix: { shard: 1 }, workspace: "/w", runnerOs: "macOS", runnerArch: "ARM64", needs: {}, steps: {} };
    for (const n of names)
      for (const step of expandSteps(realSource, n)) {
        if (typeof step !== "object") continue;
        if (step.run !== undefined)
          expr(step.run, { ...ctx, needs: Object.fromEntries(names.map((m) => [m, "success"])) });
        stepRuns(step, false, {});
      }
  });
});

describe("applyRewrites", () => {
  const job = {
    env: { KEEL_DATABASE_URL: "postgres://k:k@127.0.0.1:5432/keel" },
    steps: [{ run: "docker run --name pg-tls -p 5433:5432 postgres" }],
  };
  const rewrites = [
    { from: "127.0.0.1:5432/", to: "127.0.0.1:{port:pg}/" },
    { from: "--name pg-tls", to: "--name keel-gate-pg-ssl" },
    { from: "-p 5433:5432", to: "-p 127.0.0.1:{port:pg-ssl}:5432" },
  ];
  it("rewrites the job's env and steps, filling ports", () => {
    const out = applyRewrites(job, job.steps, rewrites, { pg: 41000, "pg-ssl": 41001 });
    expect(out.env.KEEL_DATABASE_URL).toBe("postgres://k:k@127.0.0.1:41000/keel");
    expect(out.steps[0].run).toBe("docker run --name keel-gate-pg-ssl -p 127.0.0.1:41001:5432 postgres");
  });
  it("throws when a rewrite no longer matches the source", () => {
    const changed = { ...job, steps: [{ run: "docker run --name pg-ssl -p 5433:5432 postgres" }] };
    expect(() => applyRewrites(changed, changed.steps, rewrites, { pg: 1, "pg-ssl": 2 })).toThrow(
      'rewrite "--name pg-tls" matches nothing in the source',
    );
  });
  it("matches the real postgres job of the CI source", () => {
    const source = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "ci.source.json"), "utf8"));
    const rule = JOBS.postgres;
    const out = applyRewrites(source.jobs.postgres, expandSteps(source, "postgres"), rule.rewrites, {
      pg: 41000,
      "pg-ssl": 41001,
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain(":5433");
    expect(text).not.toContain("127.0.0.1:5432/");
    expect(text).not.toContain("--name pg-tls");
    expect(text).not.toContain("docker exec pg-tls");
  });
  it("matches the real built-smokes job of the CI source: its postgres service has a container and port", () => {
    const source = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "ci.source.json"), "utf8"));
    const rule = JOBS["built-smokes"];
    expect(rule.services?.postgres).toEqual({ container: "keel-gate-pg-smokes", port: "pg-smokes" });
    expect(Object.keys(source.jobs["built-smokes"].services)).toEqual(Object.keys(rule.services ?? {}));
    const out = applyRewrites(source.jobs["built-smokes"], expandSteps(source, "built-smokes"), rule.rewrites, {
      "pg-smokes": 41002,
    });
    expect(out.env.KEEL_TEST_POSTGRES_URL).toContain("127.0.0.1:41002/");
    expect(JSON.stringify(out)).not.toContain("sudo sysctl");
  });
  it("runs the ledger job's own steps, its artifact unpacking included", () => {
    const source = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "ci.source.json"), "utf8"));
    expect(JOBS.ledger).toEqual({ run: true });
    expect(JSON.stringify(expandSteps(source, "ledger"))).toContain("tar -xf");
  });
  it("matches an artifact name against a download pattern and lists the source's patterns", () => {
    expect(matchesPattern("test-reports-3", "test-reports-*")).toBe(true);
    expect(matchesPattern("test-reports", "test-reports-*")).toBe(false);
    expect(matchesPattern("a.b", "a.b")).toBe(true);
    expect(matchesPattern("axb", "a.b")).toBe(false);
    const source = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "ci.source.json"), "utf8"));
    expect(downloadPatterns(source)).toContain("test-reports-*");
  });
  it("a job that downloads the run reports needs every job that uploads one, so none is missing from its ledger", () => {
    const source = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "ci.source.json"), "utf8"));
    const jobs: [string, { needs?: string | string[]; steps: unknown[] }][] = Object.entries(source.jobs);
    const stepsOf = (name: string): { uses?: string; with?: { name?: string; pattern?: string } }[] =>
      expandSteps(source, name).filter((s: unknown) => typeof s === "object" && s !== null);
    const uploads = jobs
      .filter(([name]) =>
        stepsOf(name).some(
          (s) =>
            s.uses?.startsWith("actions/upload-artifact") === true &&
            matchesPattern(s.with?.name ?? "", "test-reports-*"),
        ),
      )
      .map(([name]) => name);
    expect(uploads).toEqual(expect.arrayContaining(["test-shard", "postgres"]));
    const readers = jobs.filter(([name]) =>
      stepsOf(name).some(
        (s) => s.uses?.startsWith("actions/download-artifact") === true && s.with?.pattern === "test-reports-*",
      ),
    );
    expect(readers.map(([name]) => name)).toEqual(expect.arrayContaining(["ledger"]));
    const direct = (name: string): string[] => {
      const n = source.jobs[name]?.needs;
      return n === undefined ? [] : Array.isArray(n) ? n : [n];
    };
    const after = (name: string): Set<string> => {
      const seen = new Set<string>();
      const walk = (n: string): void => {
        for (const d of direct(n)) if (!seen.has(d)) seen.add(d), walk(d);
      };
      walk(name);
      return seen;
    };
    for (const [name] of readers) expect([...after(name)]).toEqual(expect.arrayContaining(uploads));
  });
});

describe("failLines", () => {
  it("keeps the lines that start with fail, colour and CR removed", () => {
    const out = ["ok check 3 tasks", "\u001b[31mfail docs-freshness\u001b[0m\r", "  fail inside", "failed: no", ""];
    expect(failLines(out.join("\n"))).toEqual(["fail docs-freshness\r"]);
  });
  it("finds nothing in a passing log", () => {
    expect(failLines("ok test 12 tasks (3.1s)\n")).toEqual([]);
  });
});

describe("versionCheck and nodeMajor", () => {
  const pkg = { packageManager: "pnpm@10.12.1+sha512.abc" };
  it("accepts any release of the pinned node major and the packageManager pnpm", () => {
    expect(versionCheck({ setup }, pkg, { node: "v22.11.0", pnpm: "10.12.1" })).toEqual([]);
    expect(nodeMajor({ setup })).toBe("22");
  });
  it("names both versions on a mismatch", () => {
    expect(versionCheck({ setup }, pkg, { node: "v24.1.0", pnpm: "10.11.0" })).toEqual([
      { tool: "pnpm", want: "10.12.1", found: "10.11.0" },
      { tool: "node", want: "22", found: "24.1.0" },
    ]);
  });
  it("prefers the action's pnpm version and compares a full node version exactly", () => {
    const pinned = [
      { uses: "pnpm/action-setup@x", with: { version: "9.0.0" } },
      { uses: "actions/setup-node@y", with: { "node-version": "22.3.0" } },
    ];
    expect(versionCheck({ setup: pinned }, pkg, { node: "v22.3.1", pnpm: "10.12.1" })).toEqual([
      { tool: "pnpm", want: "9.0.0", found: "10.12.1" },
      { tool: "node", want: "22.3.0", found: "22.3.1" },
    ]);
  });
});

describe("verdict, stepName and resultPath", () => {
  const ok = { label: "check", name: "check", status: "ok", steps: [{ name: "pnpm check", status: "ok" }] };
  it("is ok when every job ran or was allowed to be skipped", () => {
    const notRun = { label: "postgres", name: "postgres", status: "not-run", reason: "docker is not running" };
    expect(verdict([ok, { label: "eval", name: "eval", status: "skip" }])).toEqual({
      ok: true,
      failed: 0,
      first: undefined,
    });
    expect(verdict([ok, notRun])).toEqual({ ok: false, failed: 1, first: "postgres/docker is not running" });
    expect(verdict([ok, notRun], new Set(["postgres"])).ok).toBe(true);
  });
  it("names the first failed job and step", () => {
    const bad = {
      label: "test-shard 2",
      name: "test-shard",
      status: "fail",
      steps: [
        { name: "setup", status: "ok" },
        { name: "pnpm test", status: "fail" },
      ],
    };
    expect(verdict([ok, bad, { ...bad, label: "test-shard 3" }])).toEqual({
      ok: false,
      failed: 2,
      first: "test-shard 2/pnpm test",
    });
  });
  it("names a step by name, else its first line or action, cut at 60", () => {
    expect(stepName({ name: "a", run: "b" })).toBe("a");
    expect(stepName({ run: "pnpm check\nmore" })).toBe("pnpm check");
    expect(stepName({ uses: "actions/checkout@x" })).toBe("actions/checkout@x");
    expect(stepName({ run: "x".repeat(70) })).toBe(`${"x".repeat(57)}...`);
  });
  it("puts the result file under the main worktree's .keel-gate", () => {
    expect(resultPath("/repo", "abc123")).toBe(path.join("/repo", ".keel-gate", "abc123.json"));
  });
  it("keeps the node_modules of the root and each workspace package, not one under a fixture", () => {
    const yaml = "packages:\n  - 'packages/*'\n  - 'apps/*'\n  - 'tooling'\n\nallowBuilds:\n  esbuild: false\n";
    expect(workspaceGlobs(yaml)).toEqual(["packages/*", "apps/*", "tooling"]);
    expect(keepNodeModules(workspaceGlobs(yaml))).toEqual([
      "/node_modules",
      "/packages/*/node_modules",
      "/apps/*/node_modules",
      "/tooling/node_modules",
    ]);
    const real = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "pnpm-workspace.yaml"), "utf8");
    expect(workspaceGlobs(real)).toContain("packages/*");
  });
});

const realSource = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../ci.source.json"), "utf8"));

describe("the slow-machine job", () => {
  it("is ordered after every fast job, and is not planned unless asked for", () => {
    const names = planJobs(realSource, { slow: { skip: false } }).jobs.map((j) => j.name);
    expect(names.at(-1)).toBe(SLOW_JOB);
    expect(names.indexOf(SLOW_JOB)).toBe(names.length - 1);
    expect(planJobs(realSource).jobs.map((j) => j.name)).not.toContain(SLOW_JOB);
    const slow = planJobs(realSource, { slow: { skip: false } }).jobs.at(-1);
    expect(slow?.decision).toBe("run");
    expect(slow?.rule?.requires).toBe("docker");
  });

  it("records an explicit skip, and --only another job skips it without calling it explicit", () => {
    const skipped = planJobs(realSource, { slow: { skip: true } }).jobs.at(-1);
    expect(skipped).toMatchObject({ decision: "skip", explicit: true });
    const other = planJobs(realSource, { slow: { skip: false }, only: new Set(["check"]) }).jobs.at(-1);
    expect(other?.decision).toBe("skip");
    expect(other?.explicit).toBeUndefined();
    expect(planJobs(realSource, { slow: { skip: false }, only: new Set([SLOW_JOB]) }).jobs.at(-1)?.decision).toBe(
      "run",
    );
  });

  it("names its container keel-gate- and mounts only a named volume, never a host path", () => {
    const name = slowContainer("0123456789ab");
    expect(name).toBe("keel-gate-slow-0123456789ab");
    const args = slowRunArgs({ name, image: "node:22" });
    expect(args.slice(args.indexOf("--name"), args.indexOf("--name") + 2)).toEqual(["--name", name]);
    expect(args).toContain("--cpus");
    expect(args[args.indexOf("--cpus") + 1]).toBe(String(SLOW.cpus));
    expect(args[args.indexOf("--memory") + 1]).toBe(SLOW.memory);
    expect(args).toContain(`${SLOW.volume}:/pnpm-store`);
    expect(bindMounts(args)).toEqual([]);
    expect(args.some((a) => a.startsWith("--mount"))).toBe(false);
  });

  it("runs as a non-root user under an init, as a hosted runner does", () => {
    const args = slowRunArgs({ name: "keel-gate-slow-x", image: "node:22" });
    expect(args).toContain("--init");
    expect(args[args.indexOf("--user") + 1]).toBe(SLOW.user);
    expect(SLOW.user).not.toBe("root");
    expect(slowSetupScript).toContain("lsof");
    expect(slowSetupScript).toContain("corepack enable");
    expect(slowSetupScript).toContain(`chown -R ${SLOW.user}:${SLOW.user} ${SLOW.workdir}`);
  });

  it("names a shard's container after the commit and the shard", () => {
    expect(slowContainer("0123456789ab", 3)).toBe("keel-gate-slow-0123456789ab-3");
  });

  it("runs as many shards at once as the docker machine holds, no more than asked", () => {
    const gb = 1024 ** 3;
    const machine = { machineCpus: 10, machineMemory: 25 * gb, cpus: 2, memory: "7700m" };
    expect(slowParallel(machine)).toBe(3);
    expect(slowParallel({ ...machine, want: 2 })).toBe(2);
    expect(slowParallel({ ...machine, machineMemory: 12 * gb })).toBe(1);
    expect(slowParallel({ ...machine, machineCpus: 4 })).toBe(2);
    expect(slowParallel({ ...machine, machineCpus: 1 })).toBe(1);
    expect(slowParallel({ ...machine, cpus: 1, machineMemory: 100 * gb, want: 6 })).toBe(6);
  });

  it("finds a bind mount in any spelling", () => {
    expect(bindMounts(["run", "-v", "/srv/repo:/work"])).toEqual(["/srv/repo"]);
    expect(bindMounts(["run", "--volume=./here:/work"])).toEqual(["./here"]);
    expect(bindMounts(["run", "--mount", "type=bind,src=/a,dst=/b"])).toHaveLength(1);
    expect(bindMounts(["run", "-v", "named:/work"])).toEqual([]);
  });

  it("runs the source's shard commands at time scale 1 with CI's environment", () => {
    expect(slowShards(realSource)).toEqual([1, 2, 3, 4, 5, 6]);
    const { install, steps } = slowSteps(realSource, 4);
    expect(install.map((s) => s.run)).toEqual(["pnpm install --frozen-lockfile"]);
    expect(steps.map((s) => s.run)).toContain("node tooling/ci-shards.mjs 4");
    expect(steps.map((s) => s.name)).toContain("node tooling/ci-shards.mjs 4");
    const env = slowEnv(realSource);
    expect(env).toMatchObject({ CI: "true", GITHUB_ACTIONS: "true", KEEL_TEST_TIME_SCALE: "1", KEEL_AGENT: "1" });
    const exec = slowExecArgs("keel-gate-slow-x", { CI: "true" }, "node tooling/ci-shards.mjs 1");
    expect(exec.slice(0, 3)).toEqual(["exec", "-e", "CI=true"]);
    expect(exec.at(-1)).toBe("node tooling/ci-shards.mjs 1");
  });

  it("reports a hung or failed docker command by name", () => {
    const cp = ["cp", "/tmp/tree/.", "keel-gate-slow-x:/work"];
    expect(dockerProblem(cp, { status: 0 }, 1000)).toBeUndefined();
    const hung = dockerProblem(
      cp,
      { status: null, signal: "SIGKILL", error: { code: "ETIMEDOUT", message: "x" } },
      900_000,
    );
    expect(hung).toBe("docker cp /tmp/tree/. hung: no answer in 900s");
    expect(dockerProblem(["pull", "node:22"], { status: 1, stderr: "denied\n" }, 1000)).toBe(
      "docker pull node:22 failed (exit 1): denied",
    );
  });
});
