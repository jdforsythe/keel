// Spec: std.sessions, clause "`minimize` output reproduces the fingerprint; removing any one of its input events does not; two runs are equal."
// Seed 1337
import { describe, expect, test } from "vitest";
import { run } from "@keel/cli";
import { Session, replay } from "@keel/std-sessions";
import { cartRoutes } from "./fixtures.ts";

// Gap: the spec names no buggy-fixture session, no stdout record or output path for `minimize` (only `.keel/sessions/` for ingest), so the minimized Session cannot be read back; "input events" is not defined (fire and nav?).
// TODO 0092: unskip
describe.skip("std.sessions: minimize", () => {
  const minimized = async (file: string, source: string): Promise<string> => {
    const writes: { path: string; content: string | null }[] = [];
    await run(["session", "minimize", file], {
      cwd: ".",
      files: [{ path: file, source }],
      apply: (w) => void writes.push(...w),
    });
    return writes.find((w) => w.path === file)?.content ?? "";
  };

  test("`minimize` output reproduces the fingerprint", async () => {
    const out = await minimized("failing.json", "{}");
    const parsed = Session.parse(JSON.parse(out));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect((await replay(parsed.value, { routes: cartRoutes() })).reproduced).toBe(true);
  });

  test("removing any one of its input events does not", async () => {
    const out = await minimized("failing.json", "{}");
    const parsed = Session.parse(JSON.parse(out));
    if (!parsed.ok) throw new Error("minimize output is not a Session");
    const inputs = parsed.value.events.filter((e) => e.kind === "fire" || e.kind === "nav");
    for (const drop of inputs) {
      const events = parsed.value.events.filter((e) => e !== drop);
      expect((await replay({ ...parsed.value, events }, { routes: cartRoutes() })).reproduced).toBe(false);
    }
  });

  test("two runs are equal", async () => {
    expect(await minimized("failing.json", "{}")).toBe(await minimized("failing.json", "{}"));
  });
});
