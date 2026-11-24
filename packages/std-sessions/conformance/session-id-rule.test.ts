// Spec: std.sessions, clause "`sessions.Session` refuses a session whose `id` is `''`, `../x`, `a b` or 65 `a`s, its first issue's `path` being `['id']`, and accepts `id`s `a`, `A-z_9` and 64 `a`s; `keel session replay` of a session file whose `id` is `../x` emits E2002 and exits 1; a POST of that session to `sessions.ingest` is 422 `keel.fields`."
// @vitest-environment node
// Seed 1337
// The rule is `^[A-Za-z0-9_-]{1,64}$`, asserted as a law over arbitrary strings, in a session, in a group's users and in
// a `sessions.ingest` body (the archive holds what ingest accepted). The archive schema itself is not public; its
// intake is the ingest POST.
import { run } from "@keel/cli";
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { Session } from "@keel/std-sessions";
import { SessionGroup } from "@keel/std-sessions/group";
import { routes } from "@keel/std-sessions/routes";
import "@keel/std-sessions/tools";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const RULE = /^[A-Za-z0-9_-]{1,64}$/;
const error = { code: "CART_FAILED", message: "failed", data: null };
const raw = (id: string) => ({
  v: 1,
  id,
  seed: 1337,
  deterministic: true,
  at: 1000,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [{ at: 1000, kind: "error", route: "cart.show", error }],
  error,
  fingerprint: "abcdef012345",
});
const rawGroup = (id: string) => ({
  v: 1,
  seed: 1337,
  at: 0,
  origin: "http://group.test",
  server: {},
  users: [raw("u-0"), raw(id)],
});

const hostile = ["../x", "a/b", "a\\b", "", "a".repeat(65), "a\u0000b", "a b", "."];
const accepted = ["a", "A-z_9", "a".repeat(64)];
const ids = fc.oneof(
  fc.string(),
  fc.string({ unit: "binary" }),
  fc.stringMatching(RULE),
  fc.string({ unit: fc.constantFrom("a", "Z", "0", "_", "-", ".", "/", " "), minLength: 0, maxLength: 70 }),
);

async function ingest(id: string): Promise<Response> {
  const app = await createApp({
    topology: topology({ sessions: { modules: ["sessions"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
  return app.fetch(
    new Request("http://localhost/sessions", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(raw(id)),
    }),
  );
}

const replayOf = (value: unknown) =>
  run(["session", "replay", "s.json", "--format=compact"], {
    cwd: ".",
    files: [{ path: "s.json", source: JSON.stringify(value) }],
  });

describe("std.sessions: the session-id rule", () => {
  test("`sessions.Session` refuses a session whose `id` is `''`, `../x`, `a b` or 65 `a`s, its first issue's `path` being `['id']`", () => {
    for (const id of ["", "../x", "a b", "a".repeat(65)]) {
      const r = Session.parse(raw(id));
      expect(r.ok, JSON.stringify(id)).toBe(false);
      if (!r.ok) expect(r.error.data.issues[0]?.path).toEqual(["id"]);
    }
  });

  test("`sessions.Session` accepts `id`s `a`, `A-z_9` and 64 `a`s", () => {
    for (const id of accepted) expect(Session.parse(raw(id)).ok, id).toBe(true);
  });

  test("a `Session` with any string as `id` parses exactly when the string meets the rule", () => {
    fc.assert(
      fc.property(ids, (id) => {
        expect(Session.parse(raw(id)).ok).toBe(RULE.test(id));
      }),
      { seed: 1337, numRuns: 300 },
    );
  });

  test("a `Session` nested in a group's `users` parses exactly when its id meets the rule", () => {
    fc.assert(
      fc.property(ids, (id) => {
        expect(SessionGroup.parse(rawGroup(id)).ok).toBe(RULE.test(id));
      }),
      { seed: 1337, numRuns: 300 },
    );
  });

  test("a POST of a session to `sessions.ingest` is 422 `keel.fields` exactly when its id fails the rule", async () => {
    await fc.assert(
      fc.asyncProperty(ids, async (id) => {
        const res = await ingest(id);
        if (RULE.test(id)) {
          expect(res.status).toBe(200);
        } else {
          expect(res.status).toBe(422);
          const body: unknown = await res.json();
          expect(Reflect.get(Object(Reflect.get(Object(body), "error")), "code")).toBe("keel.fields");
        }
      }),
      { seed: 1337, numRuns: 20 },
    );
  }, 120_000);

  test("`keel session replay` of a session file whose `id` is `../x` emits E2002 and exits 1", async () => {
    const r = await replayOf(raw("../x"));
    expect(r.stdout).toContain("E2002");
    expect(r.code).toBe(1);
  }, 60_000);

  test("a POST of a session whose `id` is `../x` to `sessions.ingest` is 422 `keel.fields`", async () => {
    const res = await ingest("../x");
    expect(res.status).toBe(422);
    const body: unknown = await res.json();
    expect(Reflect.get(Object(Reflect.get(Object(body), "error")), "code")).toBe("keel.fields");
  }, 60_000);

  test("hostile ids (`../x`, `a/b`, `a\\b`, empty, 65 characters, a NUL, a space, a dot) are refused in a session, a group, a session file and an ingest body", async () => {
    for (const id of hostile) {
      const label = JSON.stringify(id);
      expect(Session.parse(raw(id)).ok, `session ${label}`).toBe(false);
      expect(SessionGroup.parse(rawGroup(id)).ok, `group ${label}`).toBe(false);
      expect((await replayOf(raw(id))).stdout, `file ${label}`).toContain("E2002");
      expect((await ingest(id)).status, `ingest ${label}`).toBe(422);
    }
  }, 120_000);
});
