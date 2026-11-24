// Spec: std.sessions, clause "`keel session capture <url>` against an inspect document whose `sessions.live` section is absent, is `{ doc, value: null }`, is `{ doc, error }`, or holds a value that fails `sessions.Session` emits one E1056, writes no file and exits 1; with a section holding a valid `Session` it writes `.keel/sessions/<fingerprint>-0.json` and exits 0."
// @vitest-environment node
// Seed 1337
// Driven through `run(['session', 'capture', url], { fetch, apply })`: a fake `fetch` answers each inspect document,
// `apply` collects the file effects. The message text is not pinned by the spec beyond "naming the case": the cases
// are asserted to name `sessions.live` and to differ pairwise.
// Untestable here: that the message names the case in particular words (the spec gives none).
import { run } from "@keel/cli";
import "@keel/std-sessions/tools";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const URL_ = "http://localhost:5173";
const FINGERPRINT = "abcdef012345";
const error = { code: "CART_FAILED", message: "failed", data: null };
const validSession = {
  v: 1,
  id: "s-1",
  seed: 1337,
  deterministic: true,
  at: 1000,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [{ at: 1000, kind: "error", route: "cart.show", error }],
  error,
  fingerprint: FINGERPRINT,
};
const doc = (sections: Record<string, unknown>) => ({
  live: true,
  graph: { nodes: [], edges: [] },
  stores: {},
  ids: {},
  a11y: {},
  routes: {},
  sections,
});
const DOC = { type: "object" };

async function capture(sections: Record<string, unknown>, args: readonly string[] = []) {
  const writes: { path: string; content: string | null }[] = [];
  const r = await run(["session", "capture", URL_, "--format=compact", ...args], {
    cwd: ".",
    files: [],
    fetch: () => Promise.resolve(new Response(JSON.stringify(doc(sections)), { status: 200 })),
    apply: (w) => void writes.push(...w),
  });
  const e1056 = r.stdout.split("\n").filter((l) => l.startsWith("E1056 "));
  return { r, writes, e1056 };
}

const cases: readonly { name: string; sections: Record<string, unknown> }[] = [
  { name: "absent", sections: {} },
  { name: "null", sections: { "sessions.live": { doc: DOC, value: null } } },
  {
    name: "error",
    sections: { "sessions.live": { doc: DOC, error: { code: "E1057", message: "read threw", data: null } } },
  },
  { name: "not a session", sections: { "sessions.live": { doc: DOC, value: { v: 2 } } } },
];

describe("std.sessions: capture with nothing to save", () => {
  for (const c of cases) {
    test(`\`keel session capture <url>\` against an inspect document whose \`sessions.live\` section is ${c.name} emits one E1056, writes no file and exits 1`, async () => {
      const { r, writes, e1056 } = await capture(c.sections);
      expect(e1056).toHaveLength(1);
      expect(writes).toEqual([]);
      expect(r.code).toBe(1);
    }, 60_000);
  }

  test("a section that is absent, null, an error or not a session: the message names `sessions.live` and the case, one per case", async () => {
    const messages: string[] = [];
    for (const c of cases) {
      const { e1056 } = await capture(c.sections);
      const line = e1056[0] ?? "";
      expect(line, c.name).toContain("sessions.live");
      messages.push(line);
    }
    expect(new Set(messages).size).toBe(cases.length);
  }, 60_000);

  test("a `sessions.live` value that fails `sessions.Session` emits one E1056, writes no file and exits 1, for any JSON value that is not a session", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (value) => {
        const { r, writes, e1056 } = await capture({ "sessions.live": { doc: DOC, value } });
        expect(e1056).toHaveLength(1);
        expect(writes).toEqual([]);
        expect(r.code).toBe(1);
      }),
      { seed: 1337, numRuns: 25 },
    );
  }, 120_000);

  test("with a section holding a valid `Session` it writes `.keel/sessions/<fingerprint>-0.json` and exits 0", async () => {
    const { r, writes, e1056 } = await capture({ "sessions.live": { doc: DOC, value: validSession } });
    expect(e1056).toEqual([]);
    expect(r.code).toBe(0);
    expect(writes.map((w) => w.path)).toEqual([`.keel/sessions/${FINGERPRINT}-0.json`]);
    const content = writes[0]?.content ?? "";
    expect(JSON.parse(content)).toMatchObject({ id: "s-1", fingerprint: FINGERPRINT });
  }, 60_000);

  test("an empty `ingest` archive stays ok: exit 0, no E1056, nothing written", async () => {
    const writes: unknown[] = [];
    const r = await run(["session", "ingest", URL_, "--format=compact"], {
      cwd: ".",
      files: [],
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true, results: { "sessions.list": { ok: true, value: {} } } }), {
            status: 200,
          }),
        ),
      apply: (w) => void writes.push(...w),
    });
    expect(r.stdout).not.toContain("E1056");
    expect(r.code).toBe(0);
    expect(writes).toEqual([]);
  }, 60_000);
});
