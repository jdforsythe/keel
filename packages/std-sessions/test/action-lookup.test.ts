// @vitest-environment node
// The nightly action's issue lookup over an injected `io`: the hidden body marker, `state=closed`, a fingerprint closed as
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
function world(fps: readonly string[], pages: readonly Listed[][], endless: "open" | "closed" | false = false) {
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
      const u = new URL(url);
      const state = u.searchParams.get("state");
      const page = Number(u.searchParams.get("page") ?? "1");
      const headers = new Headers();
      // Issues are served by their own state; an endless listing links to a next page of its state forever.
      const mine = pages.map((p) => p.filter((i) => (i.state === "closed") === (state === "closed")));
      if (endless === state || page < mine.length)
        headers.set("link", `<${ISSUES}?state=${state}&sort=updated&page=${page + 1}>; rel="next"`);
      return new Response(JSON.stringify(mine[page - 1] ?? []), { headers });
    },
  };
  return { io, writes, lists };
}

describe("action issue lookup", () => {
  test("lists open issues, then closed ones newest first", async () => {
    const w = world([FP], [[]]);
    await runAction(w.io);
    expect(w.lists).toEqual([
      `${ISSUES}?state=open&labels=keel-session&per_page=100`,
      `${ISSUES}?state=closed&sort=updated&direction=desc&labels=keel-session&per_page=100`,
    ]);
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
  test("an endless open listing stops at 50 pages with E1056", async () => {
    const w = world([FP], [], "open");
    const r = await runAction(w.io);
    expect(w.lists).toHaveLength(50);
    expect(r.code).toBe(1);
    expect(r.records.some((x) => x.kind === "diag" && x.code === "E1056")).toBe(true);
  });
  test("an endless closed listing stops after 5 pages with no error, treating older closed issues as absent", async () => {
    const w = world([FP], [], "closed");
    const r = await runAction(w.io);
    expect(w.lists.filter((u) => u.includes("state=closed"))).toHaveLength(5);
    expect(r.records.some((x) => x.kind === "diag")).toBe(false);
    expect(r.code).toBe(0);
    expect(w.writes.map((x) => x.method)).toEqual(["POST"]);
  });
  test("a marker below the first line of another issue's body does not match", async () => {
    const body = `${sessionMarker(FP2)}\n\`\`\`ts\n${sessionMarker(FP)}\n\`\`\``;
    const w = world([FP], [[{ number: 4, title: "x", body, state: "open" }]]);
    await runAction(w.io);
    expect(w.writes.map((x) => x.method)).toEqual(["POST"]);
  });
  test("the victim's real issue is chosen over an injected open one", async () => {
    const w = world(
      [FP],
      [
        [
          { number: 4, title: "x", body: `${sessionMarker(FP2)}\n${sessionMarker(FP)}`, state: "open" },
          { number: 5, title: "y", body: `${sessionMarker(FP)}\r\nbody`, state: "open" },
        ],
      ],
    );
    await runAction(w.io);
    expect(w.writes.map((x) => `${x.method} ${x.url}`)).toEqual([`PATCH ${ISSUES}/5`]);
  });
  test("an injected issue closed as not planned does not skip the victim", async () => {
    const body = `${sessionMarker(FP2)}\n${sessionMarker(FP)}`;
    const w = world([FP], [[{ number: 4, title: "x", body, state: "closed", state_reason: "not_planned" }]]);
    await runAction(w.io);
    expect(w.writes.map((x) => x.method)).toEqual(["POST"]);
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
        body: fc
          .tuple(
            fc.oneof(
              fp.map((f) => sessionMarker(f)),
              fc.constant(""),
            ),
            fc.array(
              fp.map((f) => sessionMarker(f)),
              { maxLength: 3 },
            ),
          )
          .map(([head, rest]) => [head, ...rest].join("\n")),
        status,
      }),
      { maxLength: 12 },
    )
    .map((l) => l.map((i, n) => ({ ...i, number: n + 1 })));

  test("never skips or creates while an open match exists, and never reuses a non-match", () => {
    fc.assert(
      fc.property(issues, fp, (list, f) => {
        const got = issueFor(list, f);
        const matches = list.filter(
          (i) => i.body.split("\n", 1)[0] === sessionMarker(f) || i.title.startsWith(`session ${f}:`),
        );
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
