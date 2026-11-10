// @vitest-environment node
// The nightly action's issue lookup over an injected `io`: the hidden body marker, `state=all`, a fingerprint closed as
// not planned, a recurrence after a completed close, the title-prefix fallback, and the pagination bound.
import type { OutRecord } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { runAction } from "../src/action/index.ts";
import type { ActionIo } from "../src/internal/ActionIo.ts";
import { issueFor } from "../src/internal/issueFor.ts";
import { sessionMarker } from "../src/internal/sessionMarker.ts";

const FP = "7f3a9c01d2e4";
const FP2 = "0a1b2c3d4e5f";
const API = "https://api.github.test";
const ISSUES = `${API}/repos/acme/shop/issues`;
const ENV = {
  KEEL_SESSIONS_URL: "https://sessions.example.test",
  GITHUB_TOKEN: "t",
  GITHUB_REPOSITORY: "acme/shop",
  GITHUB_API_URL: API,
};

type Listed = {
  number: number;
  title: string;
  body?: string | null;
  state?: string;
  state_reason?: string | null;
};

const rec = (r: OutRecord): string => JSON.stringify(r);
const session = (fp: string, file: string | null): OutRecord => ({
  kind: "session",
  id: "s",
  fingerprint: fp,
  route: "orders.show",
  events: 1,
  inputs: 1,
  error: "orders.locked",
  file,
});
const fileOf = (fp: string) => `.keel/sessions/${fp}-0.json`;

/** A repo holding `pages` of issues, and a project whose sessions for `fps` all reproduce. */
function world(fps: readonly string[], pages: readonly Listed[][], endless = false) {
  const writes: { method: string; url: string; body: { title?: string; body?: string } }[] = [];
  const lists: string[] = [];
  const io: ActionIo = {
    args: [],
    tty: false,
    env: ENV,
    now: () => 1_800_000_000_000,
    read: (file) => (file.startsWith(".keel/") ? "{}" : "// test\n"),
    run: async (args) => {
      const [, op, target] = args;
      const fp = (target ?? "").slice(15, 27);
      if (op === "ingest")
        return {
          code: 0,
          stdout: [...fps.map((f) => session(f, fileOf(f))), { kind: "summary", ok: true, name: "x", counts: {} }]
            .map(rec)
            .join("\n"),
        };
      const out = op === "to-test" ? `modules/orders/test/session-${fp}.test.ts` : op === "minimize" ? target : null;
      return {
        code: 0,
        stdout: [session(fp, out ?? null), { kind: "summary", ok: true, name: "x", counts: {} }].map(rec).join("\n"),
      };
    },
    fetch: async (url, init) => {
      const method = init?.method ?? "GET";
      if (method !== "GET") {
        const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        writes.push({ method, url, body: typeof body === "object" && body !== null ? body : {} });
        return new Response(JSON.stringify({ number: 500 + writes.length }), { status: 201 });
      }
      lists.push(url);
      const page = Number(new URL(url).searchParams.get("page") ?? "1");
      const headers = new Headers();
      if (endless || page < pages.length) headers.set("link", `<${ISSUES}?page=${page + 1}>; rel="next"`);
      return new Response(JSON.stringify(pages[page - 1] ?? (endless ? [] : [])), { headers });
    },
  };
  return { io, writes, lists };
}

describe("action issue lookup", () => {
  test("lists issues of every state", async () => {
    const w = world([FP], [[]]);
    await runAction(w.io);
    expect(w.lists).toEqual([`${ISSUES}?state=all&labels=keel-session&per_page=100`]);
  });
  test("a created issue opens its body with the marker, and only the fingerprint is in it", async () => {
    const w = world([FP], [[]]);
    await runAction(w.io);
    const body = w.writes[0]?.body.body ?? "";
    expect(body.split("\n")[0]).toBe(`<!-- keel-session:${FP} -->`);
    expect(w.writes[0]?.method).toBe("POST");
  });
  test("a renamed open issue is reused through its marker", async () => {
    const w = world(
      [FP],
      [[{ number: 4, title: "[triaged] checkout bug", body: `${sessionMarker(FP)}\nx`, state: "open" }]],
    );
    await runAction(w.io);
    expect(w.writes.map((x) => `${x.method} ${x.url}`)).toEqual([`PATCH ${ISSUES}/4`]);
  });
  test("an issue without a marker is still found by the title prefix, and gains the marker", async () => {
    const w = world([FP], [[{ number: 4, title: `session ${FP}: old`, body: null, state: "open" }]]);
    await runAction(w.io);
    expect(w.writes.map((x) => `${x.method} ${x.url}`)).toEqual([`PATCH ${ISSUES}/4`]);
    expect(w.writes[0]?.body.body?.startsWith(sessionMarker(FP))).toBe(true);
  });
  test("closed as not planned: nothing is created, and nothing is replayed", async () => {
    const w = world(
      [FP],
      [[{ number: 4, title: "x", body: sessionMarker(FP), state: "closed", state_reason: "not_planned" }]],
    );
    const r = await runAction(w.io);
    expect(w.writes).toEqual([]);
    expect(r.code).toBe(0);
    expect(r.records.find((x) => x.kind === "summary")?.counts).toMatchObject({
      fingerprints: 1,
      created: 0,
      skipped: 1,
    });
  });
  test("closed as not planned by title prefix only is skipped too", async () => {
    const w = world([FP], [[{ number: 4, title: `session ${FP}: x`, state: "closed", state_reason: "not_planned" }]]);
    await runAction(w.io);
    expect(w.writes).toEqual([]);
  });
  test("closed as completed: the bug recurred, a new issue is created", async () => {
    const w = world(
      [FP],
      [[{ number: 4, title: "x", body: sessionMarker(FP), state: "closed", state_reason: "completed" }]],
    );
    await runAction(w.io);
    expect(w.writes.map((x) => `${x.method} ${x.url}`)).toEqual([`POST ${ISSUES}`]);
  });
  test("an open match wins over a not-planned close of the same fingerprint", async () => {
    const w = world(
      [FP],
      [
        [
          { number: 4, title: "x", body: sessionMarker(FP), state: "closed", state_reason: "not_planned" },
          { number: 5, title: "y", body: sessionMarker(FP), state: "open" },
        ],
      ],
    );
    await runAction(w.io);
    expect(w.writes.map((x) => `${x.method} ${x.url}`)).toEqual([`PATCH ${ISSUES}/5`]);
  });
  test("another fingerprint's marker does not match", async () => {
    const w = world([FP], [[{ number: 4, title: "x", body: sessionMarker(FP2), state: "open" }]]);
    await runAction(w.io);
    expect(w.writes.map((x) => x.method)).toEqual(["POST"]);
  });
  test("the lookup follows pages and stops at 50 with E1056", async () => {
    const w = world([FP], [], true);
    const r = await runAction(w.io);
    expect(w.lists).toHaveLength(50);
    expect(r.code).toBe(1);
    expect(r.records.some((x) => x.kind === "diag" && x.code === "E1056")).toBe(true);
  });
});

describe("issueFor properties", () => {
  const fp = fc.constantFrom(FP, FP2, "aaaaaaaaaaaa");
  const status = fc.constantFrom("open", "completed", "not_planned");
  const issues = fc
    .array(
      fc.record({
        title: fc.oneof(
          fp.map((f) => `session ${f}: x`),
          fc.constant("other"),
        ),
        body: fc.oneof(
          fp.map((f) => sessionMarker(f)),
          fc.constant(""),
        ),
        status,
      }),
      { maxLength: 12 },
    )
    .map((l) => l.map((i, n) => ({ ...i, number: n + 1 })));

  test("never skips or creates while an open match exists, and never reuses a non-match", () => {
    fc.assert(
      fc.property(issues, fp, (list, f) => {
        const got = issueFor(list, f);
        const matches = list.filter((i) => i.body.includes(sessionMarker(f)) || i.title.startsWith(`session ${f}:`));
        if (got.kind === "open") expect(matches).toContain(got.issue);
        expect(got.kind === "open").toBe(matches.some((i) => i.status === "open"));
        expect(got.kind === "skip").toBe(
          !matches.some((i) => i.status === "open") && matches.some((i) => i.status === "not_planned"),
        );
      }),
      { seed: 1337, numRuns: 300 },
    );
  });

  test("the action never creates two issues for one marker", async () => {
    await fc.assert(
      fc.asyncProperty(issues, fc.uniqueArray(fp, { minLength: 1, maxLength: 3 }), async (list, fps) => {
        const w = world(fps, [
          list.map((i) => ({
            ...i,
            state: i.status === "open" ? "open" : "closed",
            state_reason: i.status === "open" ? null : i.status,
          })),
        ]);
        await runAction(w.io);
        const creates = w.writes.filter((x) => x.method === "POST");
        const markers = creates.map((x) => x.body.body?.split("\n")[0]);
        expect(new Set(markers).size).toBe(markers.length);
        for (const m of markers) {
          const f = fps.find((x) => sessionMarker(x) === m);
          expect(f).toBeDefined();
          if (f !== undefined) expect(issueFor(list, f).kind).toBe("none");
        }
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
