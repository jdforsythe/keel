// The text of the std.multi diags for a group file: E2007 names where `SessionGroup` first fails and the rule, or
// that the file is not JSON; E2008 names the user index; a message stays within 89 characters.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { groupDiags } from "../../src/group/groupDiags.ts";

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
const messages = (value: unknown): unknown[] => groupDiags(JSON.stringify(value), "g.json").map((d) => d.message);

describe("groupDiags messages", () => {
  test("text that is not JSON is E2007 at (root): not JSON", () => {
    expect(groupDiags("{", "sessions/g.json")).toEqual([
      {
        kind: "diag",
        code: "E2007",
        path: "sessions/g.json",
        line: 1,
        col: 1,
        message: "group file fails sessions.SessionGroup at (root): not JSON",
        see: "std.multi",
      },
    ]);
  });

  test("a value that is no object fails at (root) with its rule", () => {
    expect(messages(5)).toEqual(["group file fails sessions.SessionGroup at (root): type"]);
    expect(messages(null)).toEqual(["group file fails sessions.SessionGroup at (root): type"]);
  });

  test("a failing field is named by its dotted path and its rule, the first issue only", () => {
    expect(messages({ ...group([session(1)]), v: 2 })).toEqual([
      "group file fails sessions.SessionGroup at v: literal",
    ]);
    expect(messages(group([session(1), { ...session(2), at: "now" }]))).toEqual([
      "group file fails sessions.SessionGroup at users.1.at: type",
    ]);
    expect(messages({ ...group([session(1)]), origin: 5, at: "now" })).toHaveLength(1);
  });

  test("E2008 names each unseeded user by index and nothing else", () => {
    expect(groupDiags(JSON.stringify(group([session(1), session(), session(3), session()])), "g.json")).toEqual([
      {
        kind: "diag",
        code: "E2008",
        path: "g.json",
        line: 1,
        col: 1,
        message: "group user 1's session has no seed",
        see: "std.multi",
      },
      {
        kind: "diag",
        code: "E2008",
        path: "g.json",
        line: 1,
        col: 1,
        message: "group user 3's session has no seed",
        see: "std.multi",
      },
    ]);
  });

  test("a message of 89 characters is whole; a longer one is its first 86 and '...'", () => {
    const prefix = "group file fails sessions.SessionGroup at ";
    const of = (key: string): unknown => messages({ ...group([session(1)]), [key]: 1 })[0];
    expect(of("extra")).toBe(`${prefix}extra: unknown-key`);
    const fits = 89 - prefix.length - ": unknown-key".length;
    const whole = `${prefix}${"k".repeat(fits)}: unknown-key`;
    expect(whole).toHaveLength(89);
    expect(of("k".repeat(fits))).toBe(whole);
    const over = `${prefix}${"k".repeat(fits + 1)}: unknown-key`;
    expect(of("k".repeat(fits + 1))).toBe(`${over.slice(0, 86)}...`);
    expect(of("k".repeat(200))).toBe(`${prefix}${"k".repeat(86 - prefix.length)}...`);
  });

  test("property: every message is at most 89 characters", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,120}$/), (key) => {
        for (const d of groupDiags(JSON.stringify({ ...group([session(1)]), [key]: 1 }), "g.json"))
          expect(String(d.message).length).toBeLessThanOrEqual(89);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
