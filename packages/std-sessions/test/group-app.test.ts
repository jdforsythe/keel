// std.multi with a real app module (stores, components, a router Form), loaded the way the app's own tests load it:
// each user's Form submit runs its action; the recorded group replays without applying the submit and the navigation
// the click caused a second time. Seed 7
import { describe, expect, test } from "vitest";
import { openGroup, replayGroup } from "../src/group/index.ts";
import { running } from "../src/group/internal/running.ts";
import { type NotesLog, serveNotes } from "./fixtures/notes/test/serveNotes.ts";

const USER = new URL("./fixtures/notes/test/user.ts", import.meta.url).href;
const ORIGIN = "http://notes.test";

describe("a group of a compiled app", () => {
  test("a Form submit in a group user, and its replay", async () => {
    const log: NotesLog = { writes: [], cancelled: [] };
    const g = await openGroup({ user: USER, serve: serveNotes(log), users: 1, seed: 7, origin: ORIGIN });
    const live = await (async () => {
      try {
        await g.user(0).fire("notes.draft", { type: "input", value: "Milk" });
        await g.user(0).fire("notes.save", { type: "click" });
        await g.settle();
        expect((await g.user(0).find("notes.count")).text).toBe("1");
        return await g.user(0).state();
      } catch (error) {
        await g.stop().catch(() => undefined);
        throw error;
      }
    })();
    const group = await g.stop();
    expect(running.size).toBe(0);
    expect(log.writes).toHaveLength(1);

    const again: NotesLog = { writes: [], cancelled: [] };
    const r = await replayGroup(group, { user: USER, serve: serveNotes(again) });
    expect(running.size).toBe(0);
    expect(r.users.map((u) => u.unapplied)).toEqual([null]);
    expect(r.reproduced).toBe(true);
    expect(r.users[0]?.state).toEqual(live);
    expect(again.writes).toHaveLength(1);
  }, 240_000);

  test("a user module that fails to load ends every worker", async () => {
    const missing = new URL("./fixtures/notes/test/missing.ts", import.meta.url).href;
    const log: NotesLog = { writes: [], cancelled: [] };
    await expect(
      openGroup({ user: missing, serve: serveNotes(log), users: 2, seed: 7, origin: ORIGIN }),
    ).rejects.toThrow();
    expect(running.size).toBe(0);
  }, 240_000);
});
