// @vitest-environment happy-dom
// Spec: std.sessions-served, Conformance "With `serve`, a session whose base page's guard admits only user `u1` and redirects anyone else to page `a.signin`: `replay` without `user` returns `unapplied: -1` and `reproduced: false`, and `keel session replay` reports E2003 `base route <id> redirected to a.signin`; with `user: 'u1'` it returns `reproduced: true`, and `to-test --user u1` writes a file whose `renderRoute` options hold `user: "u1"`."
// Spec: std.sessions-served, Served pages "A base that resumes as another route than `route.id` (a guard's redirect) is not applied: E2003 `base route <id> redirected to <other id>`, `unapplied` `-1`; such a base is never reproduced, whatever the session recorded, since the replay's own E2003 is its first error and its fingerprint differs even from a session that recorded none."
// Spec: std.sessions, API "`user` (absent: a visitor, `''`) renders the base signed in as `user`, as k.user Testing does; a recording holds no user."
// Seed 1337 (fc.assert below; the CLI cases run one fixture).
// Reading asserted: the clause says `keel session replay` reports E2003 and `with user 'u1'` for the library; the CLI is run with and without `--user u1` and the E2003 text is asserted present and absent. The recorded session holds no user, so it is recorded signed in as `u1` (the test account) and holds none.
import fs from "node:fs";
import path from "node:path";
import { run } from "@keel/cli";
import { replay } from "@keel/std-sessions/replay";
import "@keel/std-sessions/tools";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { applyTo, diskFixture, sessionFile } from "./fixtures.ts";
import { countingServe, guardedRoutes, recordServed } from "./served-fixtures.ts";

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/;

describe("std.sessions: replay of a guarded served page", () => {
  test("with `serve`, `replay` without `user` of a session whose base page's guard admits only `u1` returns `unapplied: -1` and `reproduced: false`", async () => {
    const { session } = await recordServed("a.board", [], { user: "u1" });
    expect(session.route.id).toBe("a.board");
    const r = await replay(session, { routes: guardedRoutes, serve: countingServe().serve });
    expect(r.unapplied).toBe(-1);
    expect(r.reproduced).toBe(false);
  }, 120_000);

  test("with `serve`, `replay` with `user: 'u1'` returns `reproduced: true`", async () => {
    const { session } = await recordServed("a.board", ["a.about"], { user: "u1" });
    const r = await replay(session, { routes: guardedRoutes, serve: countingServe().serve, user: "u1" });
    expect(r.reproduced).toBe(true);
    expect(r.unapplied).toBeNull();
  }, 120_000);

  test("with `serve`, `replay` with any `user` other than `u1` returns `unapplied: -1` and `reproduced: false`", async () => {
    const { session } = await recordServed("a.board", [], { user: "u1" });
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(SESSION_ID).filter((u) => u !== "u1"),
        async (user) => {
          const r = await replay(session, { routes: guardedRoutes, serve: countingServe().serve, user });
          expect(r.unapplied).toBe(-1);
          expect(r.reproduced).toBe(false);
        },
      ),
      { seed: 1337, numRuns: 8 },
    );
  }, 120_000);

  describe("keel session", () => {
    let fx: ReturnType<typeof diskFixture>;
    beforeAll(() => {
      fx = diskFixture("guarded");
    });
    afterAll(() => fx.dispose());

    test("`keel session replay` without `--user` reports E2003 `base route a.board redirected to a.signin`", async () => {
      fx.write("sessions/s.json", sessionFile((await recordServed("a.board", [], { user: "u1" })).session));
      const r = await run(["session", "replay", "sessions/s.json"], { cwd: fx.dir, files: fx.files() });
      expect(r.stdout).toContain("E2003");
      expect(r.stdout).toContain("base route a.board redirected to a.signin");
    }, 120_000);

    test("`keel session replay --user u1` of the same session reports no E2003", async () => {
      fx.write("sessions/s.json", sessionFile((await recordServed("a.board", [], { user: "u1" })).session));
      const r = await run(["session", "replay", "sessions/s.json", "--user", "u1"], {
        cwd: fx.dir,
        files: fx.files(),
      });
      expect(r.stdout).not.toContain("E2003");
      expect(r.stdout).not.toContain("redirected");
    }, 120_000);

    test('`keel session to-test --user u1` writes a file whose `renderRoute` options hold `user: "u1"`', async () => {
      fx.write("sessions/s.json", sessionFile((await recordServed("a.board", [], { user: "u1" })).session));
      const written: { path: string; content: string }[] = [];
      const apply = applyTo(fx.dir);
      const r = await run(["session", "to-test", "sessions/s.json", "--user", "u1"], {
        cwd: fx.dir,
        files: fx.files(),
        apply: (w) => {
          for (const x of w) if (x.content !== null) written.push({ path: x.path, content: x.content });
          apply(w);
        },
      });
      expect(r.code).toBe(0);
      const emitted = written.find((w) => /^test\/session-[0-9a-f]{12}\.test\.ts$/.test(w.path));
      expect(emitted).toBeDefined();
      const source = fs.readFileSync(path.join(fx.dir, emitted?.path ?? ""), "utf8");
      expect(source).toMatch(/renderRoute\(\s*"a\.board",\s*\{[^}]*\buser:\s*"u1"[^}]*\}/);
    }, 120_000);
  });
});
