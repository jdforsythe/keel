// Spec: std.multi, clause "`SessionGroup` refuses a group whose `users[1].id` is `../x`, its first issue's `path` being `['users', 1, 'id']`; `keel session replay` of that group file emits E2007 and exits 1, and `replayGroup` of it throws E2007 before any user opens."
// Seed 1337
// A clean group is recorded by `openGroup` (group-fixtures.ts); its `users[1].id` is then set to each bad id.
import { fixedTime } from "@keel/tooling/test-time";
import { run } from "@keel/cli";
import { SessionGroup, openGroup, replayGroup } from "@keel/std-sessions/group";
import "@keel/std-sessions/tools";
import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import { GROUP_BOUND, SEED, USER, drive, groupOptions, serve } from "./group-fixtures.ts";

const RULE = /^[A-Za-z0-9_-]{1,64}$/;
const hostile = ["../x", "a/b", "a\\b", "", "a".repeat(65), "a\u0000b", "a b", "."];

let clean: SessionGroup | undefined;
let encoded: Record<string, unknown> = {};

beforeAll(async () => {
  const g = await openGroup(groupOptions(SEED, 2));
  await drive(g, [
    { u: 0, do: "note", v: "milk" },
    { u: 0, do: "write" },
    { u: 1, do: "refresh" },
  ]);
  clean = await g.stop();
  const e: unknown = JSON.parse(JSON.stringify(SessionGroup.encode(clean)));
  if (typeof e !== "object" || e === null || Array.isArray(e)) throw new Error("group: not an object");
  encoded = { ...e };
}, GROUP_BOUND);

/** The encoded group with `users[1].id` replaced. */
function withId(id: string): Record<string, unknown> {
  const users = encoded["users"];
  if (!Array.isArray(users)) throw new Error("group: users is not an array");
  return {
    ...encoded,
    users: users.map((u: unknown, i: number) => (i === 1 && typeof u === "object" && u !== null ? { ...u, id } : u)),
  };
}

/** The recorded group with `users[1].id` replaced, typed as a `SessionGroup` without a cast. */
function typedWithId(id: string): SessionGroup {
  if (clean === undefined) throw new Error("group not recorded");
  const users = clean.users.map((u, i) => (i === 1 ? { ...u, id } : u));
  return Object.assign(structuredClone(clean), { users });
}

const replayFile = (value: unknown) =>
  run(["session", "replay", "g.json", "--format=compact"], {
    cwd: ".",
    files: [{ path: "g.json", source: JSON.stringify(value) }],
  });

describe("std.multi: a group's users meet the session-id rule", () => {
  test("`SessionGroup` refuses a group whose `users[1].id` is `../x`, its first issue's `path` being `['users', 1, 'id']`", () => {
    const r = SessionGroup.parse(withId("../x"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.data.issues[0]?.path).toEqual(["users", 1, "id"]);
  });

  test("`SessionGroup` accepts the clean group (the twin of the refused one)", () => {
    expect(SessionGroup.parse(encoded).ok).toBe(true);
  });

  test("a group whose `users[1].id` is any string parses exactly when the string meets the rule", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.stringMatching(RULE), fc.string({ unit: "binary" })), (id) => {
        expect(SessionGroup.parse(withId(id)).ok).toBe(RULE.test(id));
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  test(
    "`keel session replay` of that group file emits E2007 and exits 1",
    async () => {
      const r = await replayFile(withId("../x"));
      expect(r.stdout).toContain("E2007");
      expect(r.code).toBe(1);
    },
    fixedTime(60_000),
  );

  test(
    "`replayGroup` of it throws E2007 before any user opens",
    async () => {
      await expect(replayGroup(typedWithId("../x"), { user: USER, serve })).rejects.toMatchObject({ code: "E2007" });
    },
    fixedTime(60_000),
  );

  test(
    "hostile ids (`../x`, `a/b`, `a\\b`, empty, 65 characters, a NUL, a space, a dot) in `users[1].id` are refused by `SessionGroup`, the group file and `replayGroup`",
    async () => {
      for (const id of hostile) {
        const label = JSON.stringify(id);
        expect(SessionGroup.parse(withId(id)).ok, `parse ${label}`).toBe(false);
        expect((await replayFile(withId(id))).stdout, `file ${label}`).toContain("E2007");
        await expect(replayGroup(typedWithId(id), { user: USER, serve }), `replayGroup ${label}`).rejects.toMatchObject(
          {
            code: "E2007",
          },
        );
      }
    },
    fixedTime(120_000),
  );

  test("a group has no id of its own: its users are named by index (no top-level `id` is part of the encoded group)", () => {
    expect(Object.keys(encoded)).not.toContain("id");
  });
});
