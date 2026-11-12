// std.multi: a response body a group user cancels is cancelled at the server too, and chunks the server had already
// sent are dropped, not pushed into the closed body. Seed 7
import { describe, expect, test } from "vitest";
import { openGroup } from "../src/group/index.ts";
import { type NotesLog, serveNotes } from "./fixtures/notes/test/serveNotes.ts";

const USER = new URL("./fixtures/notes/test/user.ts", import.meta.url).href;

describe("group response streams", () => {
  test("a cancelled body cancels the server's stream and the user keeps running", async () => {
    const log: NotesLog = { writes: [], cancelled: [] };
    const g = await openGroup({ user: USER, serve: serveNotes(log), users: 1, seed: 7, origin: "http://notes.test" });
    try {
      await g.user(0).fire("notes.peek", { type: "click" });
      await g.settle();
      expect((await g.user(0).find("notes.peeked")).text).toBe("chunk-1");
      expect(log.cancelled).toEqual(["/api/feed"]);
    } finally {
      await g.stop();
    }
  }, 240_000);
});
