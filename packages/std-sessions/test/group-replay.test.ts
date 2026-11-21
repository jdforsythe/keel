// @vitest-environment node
// `keel session replay <f>` on a file with a top-level `users` key: E2007 and E2008 at the file, 1:1, nothing replayed;
// a valid group gets a one-line summary and exit 0. E2007 and E2008 are explained.
// Seed 1337
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { explain } from "@keel/check/explain";
import { afterAll, describe, expect, test } from "vitest";
import "../src/tools.ts";
import { commandRun } from "../src/internal/commandRun.ts";

const cwd = mkdtempSync(path.join(tmpdir(), "keel-group-replay-"));
afterAll(() => rmSync(cwd, { recursive: true, force: true }));

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
const group = (users: unknown[]) => ({ v: 1, seed: 1337, at: 0, origin: "http://group.test", server: {}, users });
const put = (name: string, value: unknown): string => {
  writeFileSync(path.join(cwd, name), typeof value === "string" ? value : JSON.stringify(value));
  return name;
};

describe("keel session replay on a group file", () => {
  test("E2007 for a group that fails SessionGroup, nothing else, exit-failing summary", async () => {
    const out = await commandRun("replay", put("bad.json", { ...group([session(1)]), v: 2 }), { cwd }, undefined);
    expect(out.writes).toEqual([]);
    expect(out.records).toHaveLength(2);
    expect(out.records[0]).toMatchObject({
      kind: "diag",
      code: "E2007",
      path: "bad.json",
      line: 1,
      col: 1,
      see: "std.multi",
    });
    expect(out.records[1]).toMatchObject({ kind: "summary", ok: false, name: "session replay" });
  });

  test("E2008 for each user session without a seed", async () => {
    const out = await commandRun(
      "replay",
      put("noseed.json", group([session(1), session(), session()])),
      { cwd },
      undefined,
    );
    expect(out.records.filter((r) => r.kind === "diag").map((r) => [r.code, r.message])).toEqual([
      ["E2008", "group user 1's session has no seed"],
      ["E2008", "group user 2's session has no seed"],
    ]);
    expect(out.records[2]).toMatchObject({ kind: "summary", ok: false });
  });

  test("a valid group reports that it replays through replayGroup and passes", async () => {
    const out = await commandRun("replay", put("ok.json", group([session(1), session(2)])), { cwd }, undefined);
    expect(out.writes).toEqual([]);
    expect(out.records).toEqual([
      {
        kind: "summary",
        ok: true,
        name: "session replay: a group file replays through replayGroup",
        counts: { sessions: 1 },
      },
    ]);
  });

  test("minimize reads a group file as a session (E2002), not as a group", async () => {
    const out = await commandRun("minimize", put("m.json", group([session(1)])), { cwd }, undefined);
    expect(out.records[0]).toMatchObject({ code: "E2002" });
  });

  test("E2007 and E2008 are explained", () => {
    expect(explain("E2007")).toContain("SessionGroup");
    expect(explain("E2008")).toContain("seed");
    expect(explain("E2007")).toContain("see: std.multi");
  });
});
