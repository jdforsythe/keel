// `runJob` with `keel test` scripted: the job test file it writes under `.keel/sessions/`, the `keel test` call it
// makes, the result it reads back, what it answers when there is none, and that it leaves nothing behind.
// Seed 1337 (no random inputs)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { runJob } from "../../src/internal/runJob.ts";

vi.mock("@keel/cli", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keel/cli")>()),
  run: vi.fn(),
}));
const keel = vi.mocked(run);
beforeEach(() => {
  keel.mockReset();
});

const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "keel-run-job-"));
afterAll(() => fs.rmSync(cwd, { recursive: true, force: true }));
const dir = path.join(cwd, ".keel", "sessions");
const session = { v: 1, id: "s1", note: 'quote " and \\ slash' };
const jobOf = (over: Record<string, unknown> = {}) => ({
  op: "replay" as const,
  session,
  modules: ["cart"],
  expose: [],
  redact: [],
  ...over,
});
const good = {
  reproduced: true,
  fingerprint: "7f3a9c01d2e4",
  error: null,
  unapplied: null,
  redirectedTo: null,
  session: null,
  navs: [],
  runs: 1,
  minimal: false,
};
type Seen = { args: readonly string[]; io: Parameters<typeof run>[1]; test: string; source: string; listed: string[] };

/** `keel test` stands in: it notes its call and the job file, then writes `result` (when given) where the job says. */
function scripted(result?: unknown, stdout = ""): Seen[] {
  const seen: Seen[] = [];
  keel.mockImplementation(async (args, io) => {
    const rel = args[1] ?? "";
    const source = fs.readFileSync(path.join(cwd, rel), "utf8");
    seen.push({ args, io, test: rel, source, listed: fs.readdirSync(dir) });
    const to = /"result":("(?:[^"\\]|\\.)*")/.exec(source)?.[1];
    if (result !== undefined && to !== undefined)
      fs.writeFileSync(JSON.parse(to), typeof result === "string" ? result : JSON.stringify(result));
    return { code: 0, stdout, stderr: "" };
  });
  return seen;
}

describe("runJob: the job it starts", () => {
  test("writes .keel/sessions/job-<pid>-<n>.test.ts and runs `keel test <that file> --format=json` in the project", async () => {
    const seen = scripted(good);
    const io = { cwd, env: { KEEL_X: "1" } };
    const r = await runJob(io, jobOf());
    expect(r).toEqual({ ok: true, result: good });
    expect(keel).toHaveBeenCalledTimes(1);
    const [call] = seen;
    expect(call?.test).toMatch(new RegExp(`^\\.keel/sessions/job-${process.pid}-\\d+\\.test\\.ts$`));
    expect(call?.args).toEqual(["test", call?.test, "--format=json"]);
    expect(call?.io).toEqual({
      cwd,
      files: [{ path: call?.test, source: call?.source }],
      tty: false,
      env: { KEEL_X: "1" },
    });
    expect(call?.listed).toEqual([path.basename(call?.test ?? "")]);
  });

  test("without io.env the call carries none; each job gets a file name of its own", async () => {
    const seen = scripted(good);
    await runJob({ cwd }, jobOf());
    await runJob({ cwd }, jobOf());
    expect(seen[0]?.io).not.toHaveProperty("env");
    expect(seen[0]?.io).toMatchObject({ cwd, tty: false });
    expect(seen[1]?.test).not.toBe(seen[0]?.test);
  });

  test("the job file imports each serving module's routes, holds the session inline and calls commandJob once", async () => {
    const seen = scripted(good);
    await runJob(
      { cwd },
      jobOf({ op: "to-test", modules: ["cart", "orders"], expose: ["el:a#value"], redact: ["tx:b#c"] }),
    );
    const source = seen[0]?.source ?? "";
    const resultFile = path.join(dir, path.basename(seen[0]?.test ?? "").replace(".test.ts", ".result.json"));
    expect(source).toBe(
      [
        "// keel session job (@keel/std-sessions/tools): generated, run once by keel test, then removed.",
        'import { commandJob } from "@keel/std-sessions/commandJob";',
        'import { test } from "vitest";',
        'import { routes as r0 } from "../../modules/cart/routes.ts";',
        'import { routes as r1 } from "../../modules/orders/routes.ts";',
        "",
        `const session: unknown = ${JSON.stringify(session)};`,
        "",
        'test("keel session job", async () => {',
        `  await commandJob({ ...${JSON.stringify({ op: "to-test", result: resultFile, expose: ["el:a#value"], redact: ["tx:b#c"] })}, session, routes: [r0, r1] });`,
        "}, 600_000);",
        "",
      ].join("\n"),
    );
  });

  test("--max-runs is in the job only when given, and a job with no module imports none", async () => {
    const seen = scripted(good);
    await runJob({ cwd }, jobOf({ op: "minimize", maxRuns: 9 }));
    await runJob({ cwd }, jobOf({ op: "minimize" }));
    await runJob({ cwd }, jobOf({ modules: [] }));
    expect(seen[0]?.source).toContain('"redact":[],"maxRuns":9}, session, routes: [r0] });');
    expect(seen[1]?.source).not.toContain("maxRuns");
    expect(seen[2]?.source).toContain("session, routes: [] });");
    expect(seen[2]?.source).not.toContain("modules/");
  });
});

describe("runJob: what it answers", () => {
  test("the result the job wrote, and both files are gone afterwards", async () => {
    const full = {
      ...good,
      reproduced: false,
      error: "cart.full",
      unapplied: 2,
      redirectedTo: null,
      runs: 4,
      minimal: true,
      navs: [{ index: 1, id: "cart.show", params: {}, search: { q: "a" } }],
    };
    scripted(full);
    expect(await runJob({ cwd }, jobOf())).toEqual({ ok: true, result: full });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test("no result file: the diag records of the test run's NDJSON stdout, each a diag with its fields", async () => {
    const stdout = [
      JSON.stringify({
        kind: "diag",
        code: "T0001",
        message: "the app threw",
        path: "modules/cart/routes.ts",
        line: 3,
      }),
      "",
      "   ",
      "not json",
      "5",
      "null",
      JSON.stringify({ kind: "summary", ok: false }),
      JSON.stringify({ kind: "diag", message: "no code" }),
      JSON.stringify({ code: "E1000", message: "no kind" }),
      JSON.stringify(["diag"]),
      JSON.stringify({ kind: "diag", code: "E1052", message: "second" }),
    ].join("\n");
    scripted(undefined, stdout);
    expect(await runJob({ cwd }, jobOf())).toEqual({
      ok: false,
      diags: [
        { kind: "diag", code: "T0001", message: "the app threw", path: "modules/cart/routes.ts", line: 3 },
        { kind: "diag", code: "E1052", message: "second" },
      ],
    });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test("no result file and no diagnostic: E1052 says the job test did not run, with the vitest include fix", async () => {
    for (const op of ["replay", "minimize", "to-test"] as const) {
      scripted(undefined, `${JSON.stringify({ kind: "summary", ok: true })}\n`);
      expect(await runJob({ cwd }, jobOf({ op })), op).toEqual({
        ok: false,
        diags: [
          {
            kind: "diag",
            code: "E1052",
            message: `session ${op}: the job test did not run; add ".keel/sessions/*.test.ts" to vitest include`,
            fix: '-  include: ["test/**/*.test.{ts,tsx}"]\n+  include: ["test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"]',
            see: "k.cli",
          },
        ],
      });
    }
  });

  test("a result file that is no JobResult is treated as no result", async () => {
    scripted({ reproduced: "yes" }, JSON.stringify({ kind: "diag", code: "T0001", message: "m" }));
    expect(await runJob({ cwd }, jobOf())).toEqual({
      ok: false,
      diags: [{ kind: "diag", code: "T0001", message: "m" }],
    });
    scripted({ ...good, runs: 1.5 });
    expect(await runJob({ cwd }, jobOf())).toMatchObject({ ok: false, diags: [{ code: "E1052" }] });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test("when the test run throws, both files are still removed", async () => {
    keel.mockImplementation(async (args) => {
      fs.writeFileSync(path.join(cwd, (args[1] ?? "").replace(".test.ts", ".result.json")), JSON.stringify(good));
      throw new Error("vitest crashed");
    });
    await expect(runJob({ cwd }, jobOf())).rejects.toThrow("vitest crashed");
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test("with serve the job replays over every placed table and builds the app as the generated entry does", async () => {
    const seen = scripted(good);
    const serve = {
      deployable: "api",
      identity: true,
      routes: ["../../modules/cart/routes.ts", "@keel/std-sessions/routes"],
    };
    await runJob({ cwd }, jobOf({ serve, user: "u1" }));
    await runJob({ cwd }, jobOf({ serve: { ...serve, identity: false } }));
    const source = seen[0]?.source ?? "";
    expect(source).toContain('import { routes as r1 } from "@keel/std-sessions/routes";');
    expect(source).toContain('import { createApp } from "@keel/server";');
    expect(source).toContain('import identity from "../../identity.server.ts";');
    expect(source).toContain('"user":"u1"');
    expect(source).toContain(
      'routes: [r0, r1], serve: (ctx) => createApp({ topology, deployable: "api", routes: routeTable(r0, r1), ctx, identity }) });',
    );
    expect(seen[1]?.source).not.toContain("identity");
    expect(seen[1]?.source).not.toContain('"user"');
  });
});
