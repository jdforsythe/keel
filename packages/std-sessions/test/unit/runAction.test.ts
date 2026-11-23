// `runAction` step by step, over a scripted `keel` and a scripted GitHub: what makes a step count as passed, which
// diagnostics are relayed, when the run fails, the order fingerprints and files are taken in, and each way a
// fingerprint ends with no issue touched.
// Seed 1337 (no random inputs)
import type { OutRecord } from "@keel/cli";
import { describe, expect, test } from "vitest";
import type { ActionIo } from "../../src/internal/ActionIo.ts";
import { runAction } from "../../src/runAction.ts";

const NOW = 1_800_000_000_000;
const A = "0a0000000000";
const B = "0b0000000000";
const C = "0c0000000000";
const API = "https://api.github.test";
const ISSUES = `${API}/repos/acme/shop/issues`;
const NOT_REPRODUCED = "<!-- keel-session: not reproduced -->";
const ENV: Record<string, string> = {
  KEEL_SESSIONS_URL: "https://sessions.example.test",
  KEEL_SESSIONS_TOKEN: "reader",
  GITHUB_TOKEN: "ghs_token",
  GITHUB_REPOSITORY: "acme/shop",
  GITHUB_API_URL: API,
};

type Step = { code: number; records: OutRecord[] };
const file = (fp: string, n = 0): string => `.keel/sessions/${fp}-${n}.json`;
const testFile = (fp: string, module = "orders"): string => `modules/${module}/test/session-${fp}.test.ts`;
const session = (fp: string, over: Record<string, unknown> = {}): OutRecord => ({
  kind: "session",
  id: "s1",
  fingerprint: fp,
  route: "orders.show",
  events: 4,
  inputs: 2,
  error: "orders.locked",
  file: null,
  ...over,
});
const summary = (ok: boolean): OutRecord => ({ kind: "summary", ok, name: "session step", counts: {} });
const diag = (code: unknown, message = "m"): OutRecord => ({ kind: "diag", code, message });
const passed = (...records: OutRecord[]): Step => ({ code: 0, records: [...records, summary(true)] });
const failedWith = (...records: OutRecord[]): Step => ({ code: 1, records: [...records, summary(false)] });
const ingest = (...files: string[]): Step => passed(...files.map((f) => session(f.slice(15, 27), { file: f })));

/** A project and a repository: `keel session <op> <file>` answers from `steps`, GitHub from `issues` and `comments`. */
function world(o: {
  steps: Record<string, Step>;
  issues?: { open?: unknown[]; closed?: unknown[] };
  comments?: Record<number, unknown[]>;
  status?: (method: string, url: string) => number | undefined;
  read?: (path: string) => string | undefined;
  env?: Record<string, string>;
  args?: string[];
}) {
  const runs: string[] = [];
  const calls: { method: string; url: string; body: unknown }[] = [];
  let next = 100;
  const io: ActionIo = {
    args: o.args ?? [],
    tty: false,
    env: o.env ?? ENV,
    now: () => NOW,
    read: o.read ?? ((path) => (path.startsWith("modules/") ? `// test of ${path}\n` : undefined)),
    run: async (args) => {
      const [, op = "", target = ""] = args;
      runs.push(op === "ingest" ? "ingest" : `${op} ${target}`);
      const fp = target.slice(15, 27);
      const step =
        o.steps[op === "ingest" ? "ingest" : `${op} ${target}`] ??
        o.steps[op] ??
        passed(session(fp, { file: op === "to-test" ? testFile(fp) : op === "minimize" ? target : null }));
      return { code: step.code, stdout: step.records.map((r) => JSON.stringify(r)).join("\n") };
    },
    fetch: async (url, init) => {
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
      const status = o.status?.(method, url);
      if (status !== undefined) return new Response("{}", { status });
      if (method !== "GET") return new Response(JSON.stringify({ number: next++ }), { status: 201 });
      const u = new URL(url);
      const thread = /\/issues\/(\d+)\/comments$/.exec(u.pathname)?.[1];
      if (thread !== undefined) return new Response(JSON.stringify(o.comments?.[Number(thread)] ?? []));
      return new Response(
        JSON.stringify((u.searchParams.get("state") === "closed" ? o.issues?.closed : o.issues?.open) ?? []),
      );
    },
  };
  return { io, runs, calls };
}
const writes = (calls: readonly { method: string; url: string }[]): string[] =>
  calls.filter((c) => c.method !== "GET").map((c) => `${c.method} ${c.url.replace(ISSUES, "")}`);
const openIssue = (number: number, fp: string) => ({
  number,
  title: "renamed",
  body: `<!-- keel-session:${fp} -->\nold`,
  state: "open",
});
const codes = (records: readonly OutRecord[]): unknown[] => records.filter((r) => r.kind === "diag").map((r) => r.code);
const counts = (records: readonly OutRecord[]): unknown => records.at(-1)?.counts;

describe("runAction: what it needs", () => {
  test("without the url, a repository of the form owner/name, or the token, it is E1052 and nothing runs", async () => {
    const without = (key: string, value?: string): Record<string, string> => {
      const env = Object.fromEntries(Object.entries(ENV).filter(([k]) => k !== key));
      return value === undefined ? env : { ...env, [key]: value };
    };
    for (const env of [
      without("KEEL_SESSIONS_URL"),
      without("KEEL_SESSIONS_URL", ""),
      without("GITHUB_TOKEN"),
      without("GITHUB_TOKEN", ""),
      without("GITHUB_REPOSITORY"),
      without("GITHUB_REPOSITORY", "acme"),
      without("GITHUB_REPOSITORY", "acme/shop/extra"),
      without("GITHUB_REPOSITORY", "acme shop/x"),
      without("GITHUB_REPOSITORY", "x/acme shop"),
    ]) {
      const w = world({ steps: { ingest: ingest(file(A)) }, env });
      const r = await runAction(w.io);
      expect(r.code).toBe(1);
      expect(r.records).toEqual([
        {
          kind: "diag",
          code: "E1052",
          message: "session action needs KEEL_SESSIONS_URL, GITHUB_REPOSITORY and GITHUB_TOKEN",
          see: "k.cli",
        },
        {
          kind: "summary",
          ok: false,
          name: "session action",
          counts: { fingerprints: 0, created: 0, updated: 0, commented: 0 },
        },
      ]);
      expect(w.runs).toEqual([]);
      expect(w.calls).toEqual([]);
    }
  });

  test("a bad flag is E1052 naming it, in compact text, and nothing runs", async () => {
    const w = world({ steps: {}, args: ["--nope"] });
    const r = await runAction(w.io);
    expect(r.code).toBe(1);
    expect(r.records[0]).toEqual({
      kind: "diag",
      code: "E1052",
      message: "session action: unknown flag --nope",
      see: "k.cli",
    });
    expect(r.stdout).toBe(
      "E1052 session action: unknown flag --nope\n  see: k.cli\nfail session action 0 fingerprints, 0 created, 0 updated, 0 commented\n",
    );
    expect(w.runs).toEqual([]);
  });

  test("the GitHub api is GITHUB_API_URL without its trailing slashes, or api.github.com", async () => {
    const trailing = world({ steps: { ingest: ingest(file(A)) }, env: { ...ENV, GITHUB_API_URL: `${API}///` } });
    await runAction(trailing.io);
    expect(trailing.calls[0]?.url.startsWith(`${ISSUES}?state=open`)).toBe(true);
    const env = Object.fromEntries(Object.entries(ENV).filter(([k]) => k !== "GITHUB_API_URL"));
    const fallback = world({ steps: { ingest: ingest(file(A)) }, env });
    await runAction(fallback.io);
    expect(fallback.calls[0]?.url.startsWith("https://api.github.com/repos/acme/shop/issues?state=open")).toBe(true);
  });
});

describe("runAction: when a keel step counts as passed", () => {
  const afterIngest = async (step: Step) => {
    const w = world({ steps: { ingest: step } });
    const r = await runAction(w.io);
    return { r, w };
  };

  test("exit 0 and a last summary that is ok; a later record does not hide the summary", async () => {
    const { r, w } = await afterIngest({
      code: 0,
      records: [summary(false), summary(true), session(A, { file: file(A) })],
    });
    expect(r.code).toBe(0);
    expect(w.runs).toEqual(["ingest", `replay ${file(A)}`, `minimize ${file(A)}`, `to-test ${file(A)}`]);
  });

  test("a non-zero exit, a summary that is not ok, a last summary that is not ok, or no summary at all is a failure", async () => {
    for (const step of [
      { code: 1, records: [session(A, { file: file(A) }), summary(true)] },
      { code: 0, records: [session(A, { file: file(A) }), summary(false)] },
      { code: 0, records: [session(A, { file: file(A) }), summary(true), summary(false)] },
      { code: 0, records: [session(A, { file: file(A) })] },
      { code: 0, records: [session(A, { file: file(A) }), { kind: "summary", ok: "true", name: "n" }] },
    ]) {
      const { r, w } = await afterIngest(step);
      expect(r.code).toBe(1);
      expect(w.runs).toEqual(["ingest"]);
      expect(w.calls).toEqual([]);
    }
  });

  test("a failed ingest relays only diagnostics with a Keel code", async () => {
    const { r } = await afterIngest(
      failedWith(
        diag("E1056", "kept"),
        { kind: "note", code: "E1056", message: "not a diag" },
        diag(["E2004"], "code is no string"),
        diag(1056, "code is a number"),
        diag("E105", "too short"),
        diag("X1056", "not a Keel letter"),
        diag("E10567", "too long"),
        diag("W2001", "kept too"),
        diag("xE1056", "prefixed"),
      ),
    );
    expect(r.records.slice(0, -1)).toEqual([diag("E1056", "kept"), diag("W2001", "kept too")]);
    expect(r.code).toBe(1);
  });

  test("an ingest that files nothing ends the run, passed, with no GitHub call", async () => {
    const { r, w } = await afterIngest(passed());
    expect(r.code).toBe(0);
    expect(counts(r.records)).toEqual({ fingerprints: 0, created: 0, updated: 0, commented: 0 });
    expect(w.calls).toEqual([]);
  });
});

describe("runAction: order", () => {
  test("fingerprints are taken in ascending order, each one's files newest first until one reproduces", async () => {
    const w = world({
      steps: {
        ingest: ingest(file(C, 0), file(A, 1), file(B, 2), file(A, 3), file(A, 4)),
        [`replay ${file(A, 4)}`]: failedWith(diag("E2004"), session(A)),
      },
    });
    const r = await runAction(w.io);
    expect(w.runs).toEqual([
      "ingest",
      `replay ${file(A, 4)}`,
      `replay ${file(A, 3)}`,
      `minimize ${file(A, 3)}`,
      `to-test ${file(A, 3)}`,
      `replay ${file(B, 2)}`,
      `minimize ${file(B, 2)}`,
      `to-test ${file(B, 2)}`,
      `replay ${file(C, 0)}`,
      `minimize ${file(C, 0)}`,
      `to-test ${file(C, 0)}`,
    ]);
    expect(r.code).toBe(0);
    expect(counts(r.records)).toEqual({ fingerprints: 3, created: 3, updated: 0, commented: 0 });
    expect(r.records.filter((x) => x.kind === "session.issue")).toEqual([
      { kind: "session.issue", fingerprint: A, action: "created", issue: 100 },
      { kind: "session.issue", fingerprint: B, action: "created", issue: 101 },
      { kind: "session.issue", fingerprint: C, action: "created", issue: 102 },
    ]);
  });

  test("a created issue is titled `session <fingerprint>: <code> at <route>`, or `ok` with no error", async () => {
    const w = world({
      steps: {
        ingest: ingest(file(A), file(B)),
        [`to-test ${file(B)}`]: passed(session(B, { error: null, file: testFile(B) })),
      },
    });
    await runAction(w.io);
    const created = w.calls.filter((c) => c.method === "POST");
    expect(
      created.map((c) => (typeof c.body === "object" && c.body !== null && "title" in c.body ? c.body.title : "")),
    ).toEqual([`session ${A}: orders.locked at orders.show`, `session ${B}: ok at orders.show`]);
  });
});

describe("runAction: a replay that does not pass", () => {
  test("failing with no diagnostic, or with E2004 beside another code, is a broken run: relayed, that fingerprint stops, exit 1", async () => {
    for (const records of [[session(A)], [diag("E2004"), diag("E2003"), session(A)], [diag("E2003"), session(A)]]) {
      const w = world({
        steps: { ingest: ingest(file(A, 0), file(A, 1), file(B, 2)), [`replay ${file(A, 1)}`]: failedWith(...records) },
        issues: { open: [openIssue(7, A)] },
      });
      const r = await runAction(w.io);
      expect(r.code).toBe(1);
      expect(w.runs.filter((x) => x.includes(A))).toEqual([`replay ${file(A, 1)}`]);
      expect(codes(r.records)).toEqual(records.filter((x) => x.kind === "diag").map((x) => x.code));
      expect(writes(w.calls)).toEqual(["POST "]);
      expect(w.calls.some((c) => c.url.includes("/comments"))).toBe(false);
      expect(counts(r.records)).toEqual({ fingerprints: 2, created: 1, updated: 0, commented: 0 });
    }
  });

  test("failing by E2004 alone on every file, with no open issue: nothing is touched and the run passes", async () => {
    const w = world({
      steps: { ingest: ingest(file(A, 0), file(A, 1)), replay: failedWith(diag("E2004"), session(A)) },
    });
    const r = await runAction(w.io);
    expect(r.code).toBe(0);
    expect(w.runs).toEqual(["ingest", `replay ${file(A, 1)}`, `replay ${file(A, 0)}`]);
    expect(writes(w.calls)).toEqual([]);
    expect(r.records).toHaveLength(1);
  });

  test("with an open issue it gets one marked comment built from the newest file's record", async () => {
    const w = world({
      steps: {
        ingest: ingest(file(A, 0), file(A, 1)),
        [`replay ${file(A, 1)}`]: failedWith(diag("E2004"), session(A, { events: 9 })),
        [`replay ${file(A, 0)}`]: failedWith(diag("E2004"), session(A, { events: 1 })),
      },
      issues: { open: [openIssue(7, A)] },
      comments: { 7: [{ body: "an earlier remark" }] },
    });
    const r = await runAction(w.io);
    expect(r.code).toBe(0);
    expect(writes(w.calls)).toEqual(["POST /7/comments"]);
    const body = w.calls.find((c) => c.method === "POST")?.body;
    expect(body).toEqual({
      body: `${NOT_REPRODUCED}\nThe nightly replay of this fingerprint's sessions did not reproduce it.\n\n\`\`\`text\n${A} orders.show 9 events orders.locked\n\`\`\`\n`,
    });
    expect(r.records.slice(0, -1)).toEqual([
      session(A, { events: 9 }),
      { kind: "session.issue", fingerprint: A, action: "commented", issue: 7 },
    ]);
    expect(counts(r.records)).toEqual({ fingerprints: 1, created: 0, updated: 0, commented: 1 });
  });

  test("no comment when the newest one already carries the marker, or when the replay printed no session record", async () => {
    const marked = world({
      steps: { ingest: ingest(file(A)), replay: failedWith(diag("E2004"), session(A)) },
      issues: { open: [openIssue(7, A)] },
      comments: { 7: [{ body: "older" }, { body: `${NOT_REPRODUCED}\nagain` }] },
    });
    expect((await runAction(marked.io)).code).toBe(0);
    expect(writes(marked.calls)).toEqual([]);
    const silent = world({
      steps: { ingest: ingest(file(A)), replay: failedWith(diag("E2004")) },
      issues: { open: [openIssue(7, A)] },
    });
    const r = await runAction(silent.io);
    expect(r.code).toBe(0);
    expect(silent.calls.some((c) => c.url.includes("/comments"))).toBe(false);
    expect(r.records).toHaveLength(1);
  });

  test("a record of another fingerprint, or with a route or code that is no id, is E2002 at the newest file and skipped", async () => {
    for (const over of [
      { fingerprint: B },
      { route: "orders show" },
      { route: "" },
      { error: "::error::x" },
      { error: "a".repeat(129) },
    ]) {
      const w = world({
        steps: {
          ingest: ingest(file(A, 0), file(A, 1), file(A, 2)),
          replay: failedWith(diag("E2004"), session(A, over)),
        },
        issues: { open: [openIssue(7, A)] },
      });
      const r = await runAction(w.io);
      expect(r.records.slice(0, -1)).toEqual([
        {
          kind: "diag",
          code: "E2002",
          path: file(A, 2),
          line: 1,
          col: 1,
          message: "session route or error code is not an id; skipped",
          see: "std.sessions",
        },
      ]);
      expect(w.calls.some((c) => c.url.includes("/comments"))).toBe(false);
      expect(r.code).toBe(0);
    }
  });

  test("a record with no error and an id of 128 characters is safe", async () => {
    const w = world({
      steps: {
        ingest: ingest(file(A)),
        replay: failedWith(diag("E2004"), session(A, { error: null, route: "r".repeat(128) })),
      },
      issues: { open: [openIssue(7, A)] },
    });
    await runAction(w.io);
    expect(writes(w.calls)).toEqual(["POST /7/comments"]);
  });

  test("a failed read of the issue's comments is E1056 and exit 1, with no comment", async () => {
    const w = world({
      steps: { ingest: ingest(file(A)), replay: failedWith(diag("E2004"), session(A)) },
      issues: { open: [openIssue(7, A)] },
      status: (method, url) => (method === "GET" && url.includes("/comments") ? 502 : undefined),
    });
    const r = await runAction(w.io);
    expect(r.code).toBe(1);
    expect(r.records.slice(0, -1)).toEqual([
      { kind: "diag", code: "E1056", message: "github comments list answered 502", see: "k.cli" },
    ]);
    expect(writes(w.calls)).toEqual([]);
  });
});

describe("runAction: a reproduced fingerprint", () => {
  test("minimize or to-test failing by E2004 alone relays it, files no issue and does not fail the run", async () => {
    for (const op of ["minimize", "to-test"]) {
      const w = world({ steps: { ingest: ingest(file(A)), [op]: failedWith(diag("E2004", "differs"), session(A)) } });
      const r = await runAction(w.io);
      expect(r.code, op).toBe(0);
      expect(r.records.slice(0, -1)).toEqual([diag("E2004", "differs")]);
      expect(writes(w.calls)).toEqual([]);
      expect(w.runs.includes(`to-test ${file(A)}`)).toBe(op === "to-test");
    }
  });

  test("minimize or to-test failing any other way relays its Keel diagnostics and fails the run", async () => {
    for (const op of ["minimize", "to-test"]) {
      const w = world({
        steps: {
          ingest: ingest(file(A), file(B)),
          [`${op} ${file(A)}`]: failedWith(diag("E1052", "did not run"), diag("nope")),
        },
      });
      const r = await runAction(w.io);
      expect(r.code, op).toBe(1);
      expect(codes(r.records)).toEqual(["E1052"]);
      expect(writes(w.calls)).toEqual(["POST "]);
      expect(counts(r.records)).toEqual({ fingerprints: 2, created: 1, updated: 0, commented: 0 });
    }
  });

  test("the test is read only from modules/<route module>/test/session-<fingerprint>.test.ts; any other file, or none, files no issue", async () => {
    const read: string[] = [];
    for (const out of [
      testFile(A, "cart"),
      testFile(B),
      "modules/orders/test/other.test.ts",
      `x/${testFile(A)}`,
      null,
    ]) {
      const w = world({
        steps: { ingest: ingest(file(A)), "to-test": passed(session(A, { file: out })) },
        read: (path) => {
          read.push(path);
          return "// test\n";
        },
      });
      const r = await runAction(w.io);
      expect(r.code).toBe(0);
      expect(writes(w.calls), String(out)).toEqual([]);
    }
    expect(read).toEqual([]);
    const missing = world({ steps: { ingest: ingest(file(A)) }, read: () => undefined });
    expect((await runAction(missing.io)).code).toBe(0);
    expect(writes(missing.calls)).toEqual([]);
  });

  test("a to-test that prints no session record, or one that is not safe, files no issue", async () => {
    const none = world({ steps: { ingest: ingest(file(A)), "to-test": passed() } });
    const r = await runAction(none.io);
    expect(r.records).toHaveLength(1);
    expect(writes(none.calls)).toEqual([]);
    const unsafe = world({
      steps: { ingest: ingest(file(A)), "to-test": passed(session(A, { route: "bad route", file: testFile(A) })) },
    });
    const u = await runAction(unsafe.io);
    expect(codes(u.records)).toEqual(["E2002"]);
    expect(u.records[0]).toMatchObject({ path: file(A) });
    expect(writes(unsafe.calls)).toEqual([]);
  });

  test("an open issue is updated with the title and a body opening with the fingerprint's marker", async () => {
    const w = world({ steps: { ingest: ingest(file(A)) }, issues: { open: [openIssue(7, A)] } });
    const r = await runAction(w.io);
    expect(writes(w.calls)).toEqual(["PATCH /7"]);
    expect(w.calls.find((c) => c.method === "PATCH")?.body).toEqual({
      title: `session ${A}: orders.locked at orders.show`,
      body: `<!-- keel-session:${A} -->\n\`\`\`text\n${A} orders.show 4 events orders.locked -> ${testFile(A)}\n\`\`\`\n\n\`\`\`ts\n// test of ${testFile(A)}\n\`\`\`\n`,
    });
    expect(r.records.slice(0, -1)).toEqual([
      session(A, { file: testFile(A) }),
      { kind: "session.issue", fingerprint: A, action: "updated", issue: 7 },
    ]);
    expect(counts(r.records)).toEqual({ fingerprints: 1, created: 0, updated: 1, commented: 0 });
  });

  test("a failed create or update is E1056, counts nothing and fails the run; later fingerprints still go on", async () => {
    const w = world({
      steps: { ingest: ingest(file(A), file(B), file(C)) },
      issues: { open: [openIssue(7, B)] },
      status: (method, url) => (method === "POST" && url === ISSUES ? 500 : method === "PATCH" ? 422 : undefined),
    });
    const r = await runAction(w.io);
    expect(r.code).toBe(1);
    expect(r.records.slice(0, -1)).toEqual([
      { kind: "diag", code: "E1056", message: "github issue create answered 500", see: "k.cli" },
      { kind: "diag", code: "E1056", message: "github issue update answered 422", see: "k.cli" },
      { kind: "diag", code: "E1056", message: "github issue create answered 500", see: "k.cli" },
    ]);
    expect(counts(r.records)).toEqual({ fingerprints: 3, created: 0, updated: 0, commented: 0 });
    expect(w.runs).toHaveLength(10);
  });

  test("past 20 creates a new fingerprint is deferred with no step run, while one with an open issue is still updated", async () => {
    const fps = Array.from({ length: 22 }, (_, i) => `0${(i + 10).toString(16).padStart(2, "0")}000000000`);
    const last = fps.at(-1) ?? "";
    const w = world({
      steps: { ingest: ingest(...fps.map((fp) => file(fp))) },
      issues: { open: [openIssue(7, last)] },
    });
    const r = await runAction(w.io);
    expect(r.code).toBe(0);
    expect(counts(r.records)).toEqual({ fingerprints: 22, created: 20, updated: 1, commented: 0, deferred: 1 });
    expect(w.runs.filter((x) => x.includes(fps[20] ?? "x"))).toEqual([`replay ${file(fps[20] ?? "")}`]);
    expect(writes(w.calls).at(-1)).toBe("PATCH /7");
  });

  test("a fingerprint closed as not planned is skipped before any replay", async () => {
    const w = world({
      steps: { ingest: ingest(file(A), file(B)) },
      issues: { closed: [{ ...openIssue(3, A), state: "closed", state_reason: "not_planned" }] },
    });
    const r = await runAction(w.io);
    expect(w.runs.some((x) => x.includes(A))).toBe(false);
    expect(counts(r.records)).toEqual({ fingerprints: 2, created: 1, updated: 0, commented: 0, skipped: 1 });
  });
});
