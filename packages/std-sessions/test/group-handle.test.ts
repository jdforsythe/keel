import { fixedTime } from "@keel/tooling/test-time";
// std.multi handle: index bounds, a navigate that matches no route, and a recorded group that is its own clean
// twin for E2007/E2008. Seed 1337
import { describe, expect, test } from "vitest";
import { ORIGIN, USER, serve } from "../conformance/group-fixtures.ts";
import { SessionGroup, groupDiags, openGroup } from "../src/group/index.ts";

describe("openGroup handle", () => {
  test(
    "bounds, navigate errors, and a clean recorded group",
    async () => {
      const g = await openGroup({ user: USER, serve, users: 1, seed: 1337, origin: ORIGIN, at: 50 });
      expect(() => g.user(1)).toThrow(RangeError);
      await expect(g.setOnline(3, false)).rejects.toThrow(RangeError);
      await expect(g.user(0).navigate("/nowhere")).rejects.toThrow("no route");
      await g.advance(25);
      await g.user(0).fire("board.refresh", { type: "click" });
      await g.settle();
      expect((await g.user(0).find("board.title")).text).toBe("Milk");
      const group = await g.stop();
      expect(group.at).toBe(50);
      expect(group.users[0]?.events.find((e) => e.kind === "fire")?.at).toBe(75);
      expect(SessionGroup.parse(group).ok).toBe(true);
      expect(groupDiags(JSON.stringify(group), "group.json")).toEqual([]);
    },
    fixedTime(60_000),
  );
});
