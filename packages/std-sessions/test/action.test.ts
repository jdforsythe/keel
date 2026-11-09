// @vitest-environment node
// `@keel/std-sessions/action` (std.sessions Commands, the Action) over an injected `fetch` that records every GitHub
// request and a fake `run` that answers `keel session` with NDJSON records: the 26h `since`, files replayed newest
// first until one reproduces, create vs update vs comment (once per streak), the issue list's pagination and its page
// limit, the per-run create cap, the body holding only the record and the test, sanitized log lines, secrets kept out
// of output and out of `keel`, the output flags, and failed ingests and steps.
import path from "node:path";
import type { OutRecord } from "@keel/cli";
import { describe, expect, test } from "vitest";
import { runAction } from "../src/action/index.ts";
import type { ActionIo } from "../src/internal/ActionIo.ts";
import { actionHost } from "../src/internal/actionHost.ts";
import { clean } from "../src/internal/clean.ts";
import { issueBody } from "../src/internal/issueBody.ts";

const NOW = 1_800_000_000_000;
const SINCE = NOW - 26 * 60 * 60 * 1000;
const FP = "7f3a9c01d2e4";
const FP2 = "0a1b2c3d4e5f";
const SECRET = "hunter2-card-4111";
const GH_TOKEN = "ghs_must-never-print";
const READER = "reader-cookie-value";
const API = "https://api.github.test";
const ISSUES = `${API}/repos/acme/shop/issues`;
const MARKER = "<!-- keel-session: not reproduced -->";
const ENV = {
  PATH: "/usr/bin",
  KEEL_SESSIONS_URL: "https://sessions.example.test",
  KEEL_SESSIONS_TOKEN: READER,
  GITHUB_TOKEN: GH_TOKEN,
  GITHUB_REPOSITORY: "acme/shop",
  GITHUB_API_URL: API,
};

type Outcome = "reproduced" | "not-reproduced" | "broken";
type Issue = { number: number; title: string; pull_request?: object };
type Call = { method: string; url: string; auth: string | null; body: unknown };

const session = (
  fingerprint: string,
  file: string | null,
  error: string | null = "orders.locked",
  route = "orders.show",
): OutRecord => ({ kind: "session", id: "s1", fingerprint, route, events: 42, inputs: 7, error, file });
const summary = (ok: boolean, name: string): OutRecord => ({ kind: "summary", ok, name, counts: {} });
const ndjson = (rs: readonly OutRecord[]): string => rs.map((r) => JSON.stringify(r)).join("\n");
const testFile = (fp: string) => `modules/orders/test/session-${fp}.test.ts`;
const fileOf = (fp: string, n: number) => `.keel/sessions/${fp}-${n}.json`;
const emitted = (fp: string) =>
  `// Session: ${fp}, seed 0\nimport { record } from "@keel/std-sessions/record";\nconst note = "xxxxxxxxxxxxxxxxx";\n`;
const ingested = (...rs: OutRecord[]) => ({ code: 0, records: [...rs, summary(true, "session ingest")] });

/** A project and a GitHub repo: what `keel session` answers per file, the open issues by page, comments by issue. */
function world(o: {
  ingest?: { code: number; records: OutRecord[] };
  outcome?: Record<string, Outcome>;
  route?: string;
  pages?: Issue[][];
  endless?: boolean;
  comments?: Record<number, { body: string }[][]>;
  status?: number;
  args?: string[];
}) {
  const runs: { args: readonly string[]; env: Readonly<Record<string, string>> }[] = [];
  const calls: Call[] = [];
  const pages = o.pages ?? [[]];
  let next = 100;
  const io: ActionIo = {
    args: o.args ?? [],
    tty: false,
    env: ENV,
    now: () => NOW,
    read: (file) => {
      if (file.startsWith(".keel/sessions/")) return JSON.stringify({ route: { params: { note: SECRET } } });
      const m = /session-([0-9a-f]{12})\.test\.ts$/.exec(file);
      return m?.[1] === undefined ? undefined : emitted(m[1]);
    },
    run: async (args, env) => {
      runs.push({ args, env });
      const [, op, target] = args;
      if (op === "ingest") {
        const r = o.ingest ?? { code: 0, records: [summary(true, "session ingest")] };
        return { code: r.code, stdout: ndjson(r.records) };
      }
      const file = target ?? "";
      const fp = file.slice(15, 27);
      const outcome = o.outcome?.[file] ?? "reproduced";
      const route = o.route ?? "orders.show";
      if (outcome === "broken")
        return {
          code: 1,
          stdout: ndjson([
            { kind: "diag", code: "E1720", message: "vitest include misses .keel/sessions/", fix: "- a\n+ b" },
            summary(false, `session ${op}`),
          ]),
        };
      if (outcome === "not-reproduced")
        return {
          code: 1,
          stdout: ndjson([
            { kind: "diag", code: "E2004", path: file, line: 1, col: 1, message: "replay fingerprint differs" },
            session(fp, null, "orders.locked", route),
            summary(false, `session ${op}`),
          ]),
        };
      const out = op === "to-test" ? testFile(fp) : op === "minimize" ? file : null;
      return { code: 0, stdout: ndjson([session(fp, out, "orders.locked", route), summary(true, `session ${op}`)]) };
    },
    fetch: async (url, init) => {
      const method = init?.method ?? "GET";
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, auth: new Headers(init?.headers).get("authorization"), body });
      if (o.status !== undefined) return new Response("{}", { status: o.status });
      if (method !== "GET") return new Response(JSON.stringify({ number: next++ }), { status: 201 });
      const u = new URL(url);
      const page = Number(u.searchParams.get("page") ?? "1");
      const headers = new Headers();
      const thread = /\/issues\/(\d+)\/comments$/.exec(u.pathname)?.[1];
      if (thread !== undefined) {
        const cs = o.comments?.[Number(thread)] ?? [[]];
        if (cs.length > 1) headers.set("link", `<${ISSUES}/${thread}/comments?page=${cs.length}>; rel="last"`);
        return new Response(JSON.stringify(cs[page - 1] ?? []), { headers });
      }
      if (o.endless === true || page < pages.length)
        headers.set("link", `<${ISSUES}?state=open&page=${page + 1}>; rel="next"`);
      return new Response(JSON.stringify(pages[page - 1] ?? []), { headers });
    },
  };
  return { io, runs, calls };
}

const writes = (calls: readonly Call[]) => calls.filter((c) => c.method !== "GET").map((c) => `${c.method} ${c.url}`);
const ops = (runs: readonly { args: readonly string[] }[]) => runs.slice(1).map((x) => `${x.args[1]} ${x.args[2]}`);

describe("runAction", () => {
  test("ingests failing sessions since now - 26h with the reader token, in json; clean is one line", async () => {
    const w = world({});
    const r = await runAction(w.io);
    expect(w.runs[0]?.args).toEqual([
      "session",
      "ingest",
      "https://sessions.example.test",
      "--failing",
      `--since=${SINCE}`,
      "--format=json",
    ]);
    expect(w.runs[0]?.env.KEEL_SESSIONS_TOKEN).toBe(READER);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("ok session action 0 fingerprints, 0 created, 0 updated, 0 commented\n");
    expect(w.calls).toEqual([]);
  });

  test("a reproduced fingerprint gets minimize and to-test, then a created issue", async () => {
    const w = world({ ingest: ingested(session(FP, fileOf(FP, 0))) });
    const r = await runAction(w.io);
    expect(ops(w.runs)).toEqual([`replay ${fileOf(FP, 0)}`, `minimize ${fileOf(FP, 0)}`, `to-test ${fileOf(FP, 0)}`]);
    const created = w.calls.filter((c) => c.method === "POST");
    expect(created.map((c) => [c.url, c.auth])).toEqual([[ISSUES, `Bearer ${GH_TOKEN}`]]);
    const record = `${FP} orders.show 42 events orders.locked -> ${testFile(FP)}`;
    expect(created[0]?.body).toEqual({
      title: `session ${FP}: orders.locked at orders.show`,
      body: issueBody(record, emitted(FP)),
      labels: ["keel-session"],
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(
      `${record}\n${FP} created #100\nok session action 1 fingerprints, 1 created, 0 updated, 0 commented\n`,
    );
  });

  test("files replay newest first until one reproduces; a newer non-reproducing one does not hide the bug", async () => {
    const w = world({
      ingest: ingested(session(FP, fileOf(FP, 0)), session(FP, fileOf(FP, 1)), session(FP, fileOf(FP, 2))),
      outcome: { [fileOf(FP, 2)]: "not-reproduced", [fileOf(FP, 1)]: "not-reproduced" },
    });
    const r = await runAction(w.io);
    expect(ops(w.runs)).toEqual([
      `replay ${fileOf(FP, 2)}`,
      `replay ${fileOf(FP, 1)}`,
      `replay ${fileOf(FP, 0)}`,
      `minimize ${fileOf(FP, 0)}`,
      `to-test ${fileOf(FP, 0)}`,
    ]);
    expect(writes(w.calls)).toEqual([`POST ${ISSUES}`]);
    expect(r.code).toBe(0);
  });

  test("the issue body holds the record and the emitted test, never a session value", async () => {
    const w = world({ ingest: ingested(session(FP, fileOf(FP, 0))) });
    await runAction(w.io);
    const sent = JSON.stringify(w.calls.map((c) => c.body));
    expect(sent).not.toContain(SECRET);
    expect(sent).not.toContain(READER);
    const body = w.calls.find((c) => c.method === "POST")?.body;
    const text = typeof body === "object" && body !== null && "body" in body ? String(body.body) : "";
    expect(text).toBe(
      `\`\`\`text\n${FP} orders.show 42 events orders.locked -> ${testFile(FP)}\n\`\`\`\n\n\`\`\`ts\n${emitted(FP)}\`\`\`\n`,
    );
  });

  test("updates the open issue found by title prefix on a later page, skipping pull requests and look-alikes", async () => {
    const w = world({
      ingest: ingested(session(FP, fileOf(FP, 0))),
      pages: [
        [
          { number: 3, title: `session ${FP}: PR`, pull_request: {} },
          { number: 4, title: `session ${FP}x: other` },
        ],
        [{ number: 7, title: `session ${FP}: orders.locked at orders.show` }],
      ],
    });
    const r = await runAction(w.io);
    expect(w.calls.filter((c) => c.method === "GET").map((c) => c.url)).toEqual([
      `${ISSUES}?state=open&labels=keel-session&per_page=100`,
      `${ISSUES}?state=open&page=2`,
    ]);
    expect(writes(w.calls)).toEqual([`PATCH ${ISSUES}/7`]);
    expect(r.records).toContainEqual({ kind: "session.issue", fingerprint: FP, action: "updated", issue: 7 });
  });

  test("an issue list past 50 pages is E1056 and exits 1, touching no issue", async () => {
    const w = world({ ingest: ingested(session(FP, fileOf(FP, 0))), endless: true });
    const r = await runAction(w.io);
    expect(w.calls).toHaveLength(50);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("E1056 github issues list exceeded 50 pages");
    expect(w.runs).toHaveLength(1);
  });

  test("a next page on another host is not followed, so the token stays with the API", async () => {
    const w = world({ ingest: ingested(session(FP, fileOf(FP, 0))) });
    const inner = w.io.fetch;
    const io: ActionIo = {
      ...w.io,
      fetch: async (url, init) => {
        const res = await inner(url, init);
        if ((init?.method ?? "GET") !== "GET") return res;
        return new Response("[]", { headers: { link: '<https://evil.test/issues?page=2>; rel="next"' } });
      },
    };
    await runAction(io);
    expect(w.calls.filter((c) => !c.url.startsWith(API))).toEqual([]);
    expect(w.calls.filter((c) => c.method === "GET")).toHaveLength(1);
  });

  test("not reproduced by any file: one marked comment on the open issue, nothing without one", async () => {
    const w = world({
      ingest: ingested(session(FP, fileOf(FP, 0)), session(FP2, fileOf(FP2, 1))),
      outcome: { [fileOf(FP, 0)]: "not-reproduced", [fileOf(FP2, 1)]: "not-reproduced" },
      pages: [[{ number: 9, title: `session ${FP}: orders.locked at orders.show` }]],
    });
    const r = await runAction(w.io);
    expect(writes(w.calls)).toEqual([`POST ${ISSUES}/9/comments`]);
    expect(w.calls.find((c) => c.method === "POST")?.body).toEqual({
      body: `${MARKER}\nThe nightly replay of this fingerprint's sessions did not reproduce it.\n\n${issueBody(
        `${FP} orders.show 42 events orders.locked`,
      )}`,
    });
    expect(w.runs.map((x) => x.args[1])).toEqual(["ingest", "replay", "replay"]);
    expect(r.records.filter((x) => x.kind === "session.issue")).toEqual([
      { kind: "session.issue", fingerprint: FP, action: "commented", issue: 9 },
    ]);
    expect(r.stdout).not.toContain(FP2);
    expect(r.code).toBe(0);
  });

  test("no second not-reproduced comment while the newest comment (on the last page) carries the marker", async () => {
    const w = world({
      ingest: ingested(session(FP, fileOf(FP, 0))),
      outcome: { [fileOf(FP, 0)]: "not-reproduced" },
      pages: [[{ number: 9, title: `session ${FP}: orders.locked at orders.show` }]],
      comments: { 9: [[{ body: "first" }], [{ body: "triage" }, { body: `${MARKER}\nolder streak` }]] },
    });
    const r = await runAction(w.io);
    expect(w.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `GET ${ISSUES}?state=open&labels=keel-session&per_page=100`,
      `GET ${ISSUES}/9/comments?per_page=100`,
      `GET ${ISSUES}/9/comments?page=2`,
    ]);
    expect(r.records.filter((x) => x.kind === "session.issue")).toEqual([]);
    expect(r.code).toBe(0);
  });

  test("a replay failing with anything but E2004 is relayed with its fix, stops that fingerprint and exits 1", async () => {
    const w = world({
      ingest: ingested(session(FP, fileOf(FP, 0)), session(FP, fileOf(FP, 1)), session(FP2, fileOf(FP2, 2))),
      outcome: { [fileOf(FP, 1)]: "broken" },
    });
    const r = await runAction(w.io);
    expect(ops(w.runs)).toEqual([
      `replay ${fileOf(FP2, 2)}`,
      `minimize ${fileOf(FP2, 2)}`,
      `to-test ${fileOf(FP2, 2)}`,
      `replay ${fileOf(FP, 1)}`,
    ]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("E1720 vitest include misses .keel/sessions/\n  fix: - a\n       + b\n");
    expect(r.stdout.trimEnd().split("\n").at(-1)).toBe(
      "fail session action 2 fingerprints, 1 created, 0 updated, 0 commented",
    );
  });

  test("a route that is not an id is E2002 and skipped; no log line starts a workflow command", async () => {
    const route = "orders.show\n::error file=.github/workflows/release.yml::pwned\n::stop-commands::zz";
    const w = world({ ingest: ingested(session(FP, fileOf(FP, 0), "orders.locked", route)), route });
    const fake: OutRecord = { kind: "diag", code: "::warning::x", message: "\u001b[31mred\u001b[0m" };
    const ingest = ingested(session(FP, fileOf(FP, 0), "orders.locked", route), fake);
    const r = await runAction({ ...w.io, run: (a, e) => (a[1] === "ingest" ? fakeRun(ingest) : w.io.run(a, e)) });
    expect(writes(w.calls)).toEqual([]);
    expect(r.records.map((x) => x.code).filter((c) => c !== undefined)).toEqual(["E2002"]);
    for (const l of r.stdout.split("\n")) expect(l.trimStart().startsWith("::")).toBe(false);
    expect(r.stdout).not.toContain("\u001b");
    expect(r.code).toBe(0);
  });

  test("at most 20 issues are created per run; the rest count as deferred", async () => {
    const fps = Array.from({ length: 22 }, (_, i) => i.toString(16).padStart(12, "0"));
    const w = world({ ingest: ingested(...fps.map((fp, i) => session(fp, fileOf(fp, i)))) });
    const r = await runAction(w.io);
    expect(writes(w.calls)).toHaveLength(20);
    expect(w.runs.filter((x) => x.args[1] === "to-test")).toHaveLength(20);
    expect(r.stdout.trimEnd().split("\n").at(-1)).toBe(
      "ok session action 22 fingerprints, 20 created, 0 updated, 0 commented, 2 deferred",
    );
  });

  test("a file outside .keel/sessions/<fingerprint>-<n>.json never reaches keel", async () => {
    const w = world({
      ingest: ingested(session(FP, "--help"), session(FP, `.keel/sessions/${FP2}-0.json`), session(FP, "../x.json")),
    });
    await runAction(w.io);
    expect(w.runs).toHaveLength(1);
  });

  test("a failed ingest relays its diagnostics, touches no issue, and exits 1", async () => {
    const w = world({
      ingest: {
        code: 1,
        records: [
          { kind: "diag", code: "E1056", message: "session ingest target answered 302", see: "k.cli" },
          summary(false, "session ingest"),
        ],
      },
    });
    const r = await runAction(w.io);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe(
      "E1056 session ingest target answered 302\n  see: k.cli\nfail session action 0 fingerprints, 0 created, 0 updated, 0 commented\n",
    );
    expect(w.runs).toHaveLength(1);
    expect(w.calls).toEqual([]);
  });

  test("a failed GitHub call is E1056 and exits 1; the token is never printed", async () => {
    const w = world({ ingest: ingested(session(FP, fileOf(FP, 0))), status: 403 });
    const r = await runAction(w.io);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("E1056 github issues list answered 403");
    expect(r.stdout).not.toContain(GH_TOKEN);
    expect(JSON.stringify(r.records)).not.toContain(GH_TOKEN);
  });

  test("keel never sees GITHUB_TOKEN, and only the ingest sees KEEL_SESSIONS_TOKEN", async () => {
    const w = world({ ingest: ingested(session(FP, fileOf(FP, 0))) });
    await runAction(w.io);
    expect(w.runs.length).toBe(4);
    for (const x of w.runs) {
      expect(x.env.GITHUB_TOKEN).toBeUndefined();
      expect(x.env.PATH).toBe("/usr/bin");
      expect(x.env.KEEL_SESSIONS_TOKEN).toBe(x.args[1] === "ingest" ? READER : undefined);
    }
  });

  test("without the url or the GitHub env it is E1052 and runs nothing", async () => {
    const w = world({});
    const r = await runAction({ ...w.io, env: { ...ENV, GITHUB_REPOSITORY: "" } });
    expect(r.code).toBe(1);
    expect(r.records[0]?.code).toBe("E1052");
    expect(w.runs).toEqual([]);
  });
});

/** A `run` answering with fixed records. */
async function fakeRun(r: { code: number; records: OutRecord[] }) {
  return { code: r.code, stdout: ndjson(r.records) };
}

describe("output flags (docs/OUTPUT.md)", () => {
  const two = () =>
    world({
      ingest: ingested(session(FP, fileOf(FP, 0)), session(FP2, fileOf(FP2, 1))),
      args: [],
    });

  test("--format=json is NDJSON ending in the summary", async () => {
    const w = two();
    const r = await runAction({ ...w.io, args: ["--format=json"] });
    const lines = r.stdout.trimEnd().split("\n");
    const kinds = lines.map((l) => {
      const v: unknown = JSON.parse(l);
      return typeof v === "object" && v !== null && "kind" in v ? v.kind : null;
    });
    expect(kinds).toEqual(["session", "session", "session.issue", "session.issue", "summary"]);
  });

  test("--quiet keeps the trailer; --limit caps each kind with the hint", async () => {
    const q = two();
    expect((await runAction({ ...q.io, args: ["--quiet"] })).stdout).toBe(
      "ok session action 2 fingerprints, 2 created, 0 updated, 0 commented\n",
    );
    const l = two();
    const r = await runAction({ ...l.io, args: ["--limit", "1"] });
    expect(r.stdout).toContain("... +1 more session.issue (keel-session-action --limit 2)");
  });

  test("pretty on a terminal; an unknown flag is E1052", async () => {
    const p = two();
    const r = await runAction({ ...p.io, tty: true });
    expect(r.stdout.trimEnd().split("\n").at(-1)).toBe(
      "session action: passed (2 fingerprints, 2 created, 0 updated, 0 commented)",
    );
    const u = two();
    const bad = await runAction({ ...u.io, args: ["--verbose"] });
    expect(bad.code).toBe(1);
    expect(bad.stdout).toContain("E1052 session action: unknown flag --verbose");
    expect(u.runs).toEqual([]);
  });
});

describe("helpers", () => {
  test("issueBody: the fence outgrows any backtick run in the test", () => {
    const body = issueBody("rec", "const t = `a ```` b`;\n");
    expect(body).toBe("`````text\nrec\n`````\n\n`````ts\nconst t = `a ```` b`;\n`````\n");
  });
  test("clean: ANSI and control characters go, newlines become spaces, length is capped", () => {
    expect(clean("a\u001b[31mb\u001b[0m\nc\u0007d")).toBe("ab c d");
    expect(clean("x".repeat(300), 10)).toBe("xxxxxxx...");
  });
  test("actionHost.read refuses a path outside the cwd", () => {
    const host = actionHost();
    expect(host.read("package.json")).toContain("@keel/std-sessions");
    expect(host.read(path.join("..", "cli", "package.json"))).toBeUndefined();
    expect(host.read("/etc/hosts")).toBeUndefined();
  });
});
