// std.multi: `replayGroup` checks its group as `keel session replay` does (E2007, E2008) before starting any worker,
// and throws the first diagnostic's code. Seed 1337
import { describe, expect, test } from "vitest";
import { ORIGIN, USER, serve } from "../conformance/group-fixtures.ts";
import { SessionGroup, replayGroup } from "../src/group/index.ts";
import { running } from "../src/group/internal/running.ts";

const session = (seed?: number) => ({
  v: 1,
  id: "s1",
  ...(seed === undefined ? {} : { seed }),
  deterministic: seed !== undefined,
  at: 0,
  route: { id: "board.show", params: {}, search: {} },
  state: {},
  events: [],
  error: null,
  fingerprint: "",
});

describe("replayGroup input", () => {
  test("a user session without a seed is E2008", async () => {
    const r = SessionGroup.parse({
      v: 1,
      seed: 1337,
      at: 0,
      origin: ORIGIN,
      server: {},
      users: [session(1), session()],
    });
    if (!r.ok) throw new Error("fixture: not a SessionGroup");
    await expect(replayGroup(r.value, { user: USER, serve })).rejects.toMatchObject({ code: "E2008" });
    expect(running.size).toBe(0);
  });

  test("a group that fails SessionGroup is E2007", async () => {
    const broken = { v: 1, seed: 1337, at: 0, origin: ORIGIN, server: {}, users: [{ ...session(1), v: 2 }] };
    await expect(replayGroup(JSON.parse(JSON.stringify(broken)), { user: USER, serve })).rejects.toMatchObject({
      code: "E2007",
    });
  });
});
