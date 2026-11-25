// Spec: std.multi, clause "E2007 and E2008 each fire on a fixture and not on its clean twin."
// std.multi, rule E2007: a group file fails `SessionGroup` (diag at the file, 1:1).
// std.multi, rule E2008: a group user's session has no `seed` (diag at the file, 1:1).
// Seed 1337
// Driven through `keel session replay <f>` (the surface E2002 uses), on a file with a top-level `users` key.
// Assumption: the command writes compact lines `<code> <file>:1:1 ...` to stdout by default, as for E2002.
import { run } from "@keel/cli";
import { SessionGroup, openGroup } from "@keel/std-sessions/group";
import "@keel/std-sessions/tools";
import { beforeAll, describe, expect, test } from "vitest";
import { SEED, drive, groupOptions } from "./group-fixtures.ts";

const FILE = "g.json";

const replayOf = (value: unknown) =>
  run(["session", "replay", FILE], { cwd: ".", files: [{ path: FILE, source: JSON.stringify(value) }] });

let clean: Record<string, unknown> = {};

beforeAll(async () => {
  const g = await openGroup(groupOptions(SEED, 2));
  await drive(g, [
    { u: 0, do: "note", v: "milk" },
    { u: 0, do: "write" },
    { u: 1, do: "refresh" },
  ]);
  const encoded: unknown = JSON.parse(JSON.stringify(SessionGroup.encode(await g.stop())));
  if (typeof encoded !== "object" || encoded === null || Array.isArray(encoded))
    throw new Error("group: not an object");
  clean = { ...encoded };
}, 120_000);

const withoutSeed = (): Record<string, unknown> => {
  const users = clean["users"];
  if (!Array.isArray(users)) throw new Error("group: users is not an array");
  return {
    ...clean,
    users: users.map((u: unknown, i: number) => {
      if (i !== 0 || typeof u !== "object" || u === null) return u;
      return Object.fromEntries(Object.entries(u).filter(([k]) => k !== "seed"));
    }),
  };
};

describe("std.multi: E2007 and E2008", () => {
  test("E2007 fires on a group file that fails SessionGroup", async () => {
    const r = await replayOf({ ...clean, v: 2 });
    expect(r.stdout).toMatch(/E2007/);
    expect(r.code).toBe(1);
  }, 60_000);

  test("E2007 does not fire on its clean twin, a group file recorded by openGroup", async () => {
    const r = await replayOf(clean);
    expect(r.stdout).not.toMatch(/E2007/);
  }, 60_000);

  test("E2007 and E2008 diag the file at 1:1", async () => {
    const a = await replayOf({ ...clean, v: 2 });
    expect(a.stdout).toMatch(new RegExp(`E2007 ${FILE}:1:1`));
    const b = await replayOf(withoutSeed());
    expect(b.stdout).toMatch(new RegExp(`E2008 ${FILE}:1:1`));
  }, 60_000);

  test("E2008 fires on a group file whose user session has no seed", async () => {
    const r = await replayOf(withoutSeed());
    expect(r.stdout).toMatch(/E2008/);
    expect(r.code).toBe(1);
  }, 60_000);

  test("E2008 does not fire on its clean twin, every user session seeded", async () => {
    const r = await replayOf(clean);
    expect(r.stdout).not.toMatch(/E2008/);
  }, 60_000);
});
