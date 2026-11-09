// @vitest-environment node
// `@keel/std-sessions/action` (std.sessions Commands, the Action) over an injected `fetch` that records every GitHub
// request and a fake `run` that answers `keel session` with NDJSON records: the 26h `since`, the newest file per
// fingerprint, create vs update vs comment, the issue list's pagination, the body holding only the record and the
// test, secrets kept out of output and out of `keel`, and a failed ingest.
import type { OutRecord } from "@keel/cli";
import { describe, expect, test } from "vitest";
import { runAction } from "../src/action/index.ts";
import type { ActionIo } from "../src/internal/ActionIo.ts";
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

const session = (fingerprint: string, file: string | null, error: string | null = "orders.locked"): OutRecord => ({
  kind: "session",
  id: "s1",
  fingerprint,
  route: "orders.show",
  events: 42,
  inputs: 7,
  error,
  file,
});
const summary = (ok: boolean, name: string): OutRecord => ({ kind: "summary", ok, name, counts: {} });
const ndjson = (rs: readonly OutRecord[]): string => rs.map((r) => JSON.stringify(r)).join("\n");
const testFile = (fp: string) => `modules/orders/test/session-${fp}.test.ts`;
const emitted = (fp: string) =>
  `// Session: ${fp}, seed 0\nimport { record } from "@keel/std-sessions/record";\nconst note = "xxxxxxxxxxxxxxxxx";\n`;

/** A project and a GitHub repo: what `keel session` answers per op and file, the open issues by page. */
function world(o: {
  ingest?: { code: number; records: OutRecord[] };
  outcome?: Record<string, Outcome>;
  pages?: Issue[][];
  status?: number;
}) {
  const runs: { args: readonly string[]; env: Readonly<Record<string, string>> }[] = [];
  const calls: Call[] = [];
  const pages = o.pages ?? [[]];
  let next = 100;
  const io: ActionIo = {
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
      if (outcome === "broken")
        return {
          code: 1,
          stdout: ndjson([
            { kind: "diag", code: "E1720", message: "vitest include misses .keel/sessions/", see: "k.cli" },
            summary(false, `session ${op}`),
          ]),
        };
      if (outcome === "not-reproduced")
        return {
          code: 1,
          stdout: ndjson([
            { kind: "diag", code: "E2004", path: file, line: 1, col: 1, message: "replay fingerprint differs" },
            session(fp, null),
            summary(false, `session ${op}`),
          ]),
        };
      const out = op === "to-test" ? testFile(fp) : op === "minimize" ? file : null;
      return { code: 0, stdout: ndjson([session(fp, out), summary(true, `session ${op}`)]) };
    },
    fetch: async (url, init) => {
      const method = init?.method ?? "GET";
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, auth: new Headers(init?.headers).get("authorization"), body });
      if (o.status !== undefined) return new Response("{}", { status: o.status });
      if (method === "GET") {
        const page = Number(new URL(url).searchParams.get("page") ?? "1");
        const headers = new Headers();
        if (page < pages.length) headers.set("link", `<${ISSUES}?state=open&page=${page + 1}>; rel="next"`);
        return new Response(JSON.stringify(pages[page - 1] ?? []), { status: 200, headers });
      }
      return new Response(JSON.stringify({ number: next++ }), { status: method === "POST" ? 201 : 200 });
    },
  };
  return { io, runs, calls };
}

const ingested = (...rs: OutRecord[]) => ({ code: 0, records: [...rs, summary(true, "session ingest")] });

describe("runAction", () => {
  test("ingests failing sessions since now - 26h with the reader token, in json", async () => {
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

  test("replays the newest file per fingerprint, then minimize and to-test, and creates the issue", async () => {
    const w = world({
      ingest: ingested(
        session(FP, `.keel/sessions/${FP}-0.json`),
        session(FP, `.keel/sessions/${FP}-1.json`),
        session(FP2, `.keel/sessions/${FP2}-2.json`, "cart.empty"),
      ),
      outcome: { [`.keel/sessions/${FP2}-2.json`]: "broken" },
    });
    const r = await runAction(w.io);
    const ops = w.runs.slice(1).map((x) => `${x.args[1]} ${x.args[2]}`);
    expect(ops).toEqual([
      `replay .keel/sessions/${FP2}-2.json`,
      `replay .keel/sessions/${FP}-1.json`,
      `minimize .keel/sessions/${FP}-1.json`,
      `to-test .keel/sessions/${FP}-1.json`,
    ]);
    const created = w.calls.filter((c) => c.method === "POST");
    expect(created).toHaveLength(1);
    expect(created[0]?.url).toBe(ISSUES);
    expect(created[0]?.auth).toBe(`Bearer ${GH_TOKEN}`);
    const record = `${FP} orders.show 42 events orders.locked -> ${testFile(FP)}`;
    expect(created[0]?.body).toEqual({
      title: `session ${FP}: orders.locked at orders.show`,
      body: issueBody(record, emitted(FP)),
      labels: ["keel-session"],
    });
    expect(r.records).toContainEqual({ kind: "session.issue", fingerprint: FP, action: "created", issue: 100 });
    expect(r.records).toContainEqual({ kind: "session.issue", fingerprint: FP2, action: "none", issue: null });
    expect(r.records.filter((x) => x.kind === "diag").map((x) => x.code)).toEqual(["E1720"]);
    expect(r.code).toBe(0);
    expect(r.stdout.trimEnd().split("\n").at(-1)).toBe(
      "ok session action 2 fingerprints, 1 created, 0 updated, 0 commented",
    );
  });

  test("the issue body holds the record and the emitted test, never a session value", async () => {
    const w = world({ ingest: ingested(session(FP, `.keel/sessions/${FP}-0.json`)) });
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
      ingest: ingested(session(FP, `.keel/sessions/${FP}-0.json`)),
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
    const patch = w.calls.filter((c) => c.method !== "GET");
    expect(patch.map((c) => `${c.method} ${c.url}`)).toEqual([`PATCH ${ISSUES}/7`]);
    expect(r.records).toContainEqual({ kind: "session.issue", fingerprint: FP, action: "updated", issue: 7 });
  });

  test("a next page on another host is not followed, so the token stays with the API", async () => {
    const w = world({ ingest: ingested(session(FP, `.keel/sessions/${FP}-0.json`)) });
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

  test("not reproduced: one comment on the open issue, and nothing when there is none", async () => {
    const files = { a: `.keel/sessions/${FP}-0.json`, b: `.keel/sessions/${FP2}-1.json` };
    const w = world({
      ingest: ingested(session(FP, files.a), session(FP2, files.b)),
      outcome: { [files.a]: "not-reproduced", [files.b]: "not-reproduced" },
      pages: [[{ number: 9, title: `session ${FP}: orders.locked at orders.show` }]],
    });
    const r = await runAction(w.io);
    const writes = w.calls.filter((c) => c.method !== "GET");
    expect(writes.map((c) => `${c.method} ${c.url}`)).toEqual([`POST ${ISSUES}/9/comments`]);
    expect(writes[0]?.body).toEqual({
      body: `The nightly replay of this fingerprint's newest session did not reproduce it.\n\n${issueBody(
        `${FP} orders.show 42 events orders.locked`,
      )}`,
    });
    expect(w.runs.map((x) => x.args[1])).toEqual(["ingest", "replay", "replay"]);
    expect(r.records).toContainEqual({ kind: "session.issue", fingerprint: FP, action: "commented", issue: 9 });
    expect(r.records).toContainEqual({ kind: "session.issue", fingerprint: FP2, action: "none", issue: null });
    expect(r.code).toBe(0);
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
    const w = world({ ingest: ingested(session(FP, `.keel/sessions/${FP}-0.json`)), status: 403 });
    const r = await runAction(w.io);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("E1056 github issues list answered 403");
    expect(r.stdout).not.toContain(GH_TOKEN);
    expect(JSON.stringify(r.records)).not.toContain(GH_TOKEN);
  });

  test("keel never sees GITHUB_TOKEN, and only the ingest sees KEEL_SESSIONS_TOKEN", async () => {
    const w = world({ ingest: ingested(session(FP, `.keel/sessions/${FP}-0.json`)) });
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

describe("issueBody", () => {
  test("the fence outgrows any backtick run in the test", () => {
    const body = issueBody("rec", "const t = `a ```` b`;\n");
    expect(body).toBe("`````text\nrec\n`````\n\n`````ts\nconst t = `a ```` b`;\n`````\n");
  });
});
