import { fixedTime } from "@keel/tooling/test-time";
// @vitest-environment happy-dom
// std.multi: "Two users of one group get distinct `caller`s": each user keeps one caller across its writes, also when
// the group runs under a DOM environment whose `Request` drops a `cookie` header given at construction. Seed 7
import { describe, expect, test } from "vitest";
import { openGroup } from "../src/group/index.ts";
import { type NotesLog, serveNotes } from "./fixtures/notes/test/serveNotes.ts";

const USER = new URL("./fixtures/notes/test/user.ts", import.meta.url).href;

describe("group callers", () => {
  test(
    "a user's writes carry one caller; two users' differ",
    async () => {
      const log: NotesLog = { writes: [], cancelled: [] };
      const g = await openGroup({ user: USER, serve: serveNotes(log), users: 2, seed: 7, origin: "http://notes.test" });
      try {
        for (const [i, text] of [
          [0, "a"],
          [0, "b"],
          [1, "c"],
        ] as const) {
          await g.user(i).navigate("/");
          await g.user(i).fire("notes.draft", { type: "input", value: text });
          await g.user(i).fire("notes.save", { type: "click" });
          await g.settle();
        }
        const [first, second, other] = log.writes;
        expect(log.writes).toHaveLength(3);
        expect(second).toBe(first);
        expect(other).not.toBe(first);
      } finally {
        await g.stop();
      }
    },
    fixedTime(240_000),
  );
});
