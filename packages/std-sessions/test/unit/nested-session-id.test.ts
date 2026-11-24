// The session-id rule `^[A-Za-z0-9_-]{1,64}$` holds in every schema that nests `Session`: a group's `users` and the
// ingest `Archive`, the issue sitting at the nested `id`.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Archive } from "../../src/Archive.schema.ts";
import { Session } from "../../src/Session.schema.ts";
import { SessionGroup } from "../../src/group/SessionGroup.schema.ts";

const session = (id: string) => ({
  v: 1,
  id,
  deterministic: false,
  at: 0,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [],
  error: null,
  fingerprint: "",
});
const group = (...ids: string[]) => ({
  v: 1,
  seed: 1,
  at: 0,
  origin: "http://s.test",
  server: {},
  users: ids.map(session),
});
const archive = (id: string) => ({
  "000000000001": { count: 1, first: 0, last: 0, sessions: [{ bytes: 10, session: session(id) }] },
});
const VALID = /^[A-Za-z0-9_-]{1,64}$/;
const path = (r: ReturnType<typeof Session.parse>) => (r.ok ? undefined : r.error.data.issues[0]?.path);

describe("the session-id rule in nested sessions", () => {
  test("a group refuses a user id outside the rule, naming users.<i>.id", () => {
    for (const bad of ["", "../x", "a b", "a".repeat(65)]) {
      const r = SessionGroup.parse(group("ok", bad));
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error.data.issues[0]?.path, bad).toEqual(["users", 1, "id"]);
    }
  });

  test("a group accepts ids inside the rule", () => {
    for (const good of ["a", "A-z_9", "a".repeat(64)]) expect(SessionGroup.parse(group(good)).ok, good).toBe(true);
  });

  test("the archive refuses an archived session whose id is outside the rule", () => {
    for (const bad of ["", "../x", "a b", "a".repeat(65)]) expect(Archive.parse(archive(bad)).ok, bad).toBe(false);
    expect(Archive.parse(archive("s-1")).ok).toBe(true);
  });

  test("for any id, a group and the archive agree with the rule and with Session", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (id) => {
        const want = VALID.test(id);
        expect(SessionGroup.parse(group(id)).ok).toBe(want);
        expect(Archive.parse(archive(id)).ok).toBe(want);
        expect(Session.parse(session(id)).ok).toBe(want);
        if (!want) expect(path(Session.parse(session(id)))).toEqual(["id"]);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
