// std.monitor and std.sessions commands: a failure prints the target's origin only, never its user info or query.
// @vitest-environment node
import { run } from "@keel/cli";
import { describe, expect, test } from "vitest";
import "../src/tools.ts";

const URL_ = "http://user:secret@example.test/?token=abc";

describe("session command URLs", () => {
  test.each([
    ["monitor", () => Promise.resolve(new Response("{}", { status: 200 }))],
    ["ingest", () => Promise.resolve(new Response("{}", { status: 200 }))],
  ])("session %s on a URL with user info and a query prints neither", async (op, fetch) => {
    for (const format of ["compact", "json", "pretty"]) {
      const r = await run(["session", op, URL_, `--format=${format}`], {
        cwd: "/nonexistent",
        env: { KEEL_SESSIONS_TOKEN: "tok" },
        fetch,
        apply: () => {
          throw new Error("nothing is written");
        },
      });
      expect(r.code).toBe(1);
      for (const text of [r.stdout, r.stderr]) {
        expect(text).not.toContain("secret");
        expect(text).not.toContain("abc");
      }
      expect(r.stdout).toContain("http://example.test");
    }
  });
});
