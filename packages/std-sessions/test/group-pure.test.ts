// std.multi pure parts: per-user seeds, user module URLs, the `SessionGroup` schema and the E2007/E2008 diags.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SessionGroup, groupDiags } from "../src/group/index.ts";
import { moduleUrl } from "../src/group/internal/moduleUrl.ts";
import { userSeed } from "../src/group/internal/userSeed.ts";

const session = (seed?: number) => ({
  v: 1,
  id: "s1",
  ...(seed === undefined ? {} : { seed }),
  deterministic: seed !== undefined,
  at: 0,
  route: { id: "board.show", params: {}, search: {} },
  state: { view: { note: "" } },
  events: [
    { at: 0, kind: "net", online: false },
    { at: 5, kind: "fire", id: "board.probe", event: { type: "click" } },
  ],
  error: null,
  fingerprint: "",
});
const group = (users: unknown[]) => ({ v: 1, seed: 1337, at: 0, origin: "http://group.test", server: {}, users });

describe("userSeed", () => {
  test("is a fixed uint32 per seed and index, distinct across a group's users", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const seeds = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => userSeed(seed, i));
        expect(seeds).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((i) => userSeed(seed, i)));
        for (const x of seeds) expect(Number.isInteger(x) && x >= 0 && x < 2 ** 32).toBe(true);
        expect(new Set(seeds).size).toBe(seeds.length);
      }),
      { seed: 1337 },
    );
  });
});

describe("moduleUrl", () => {
  test("keeps a file URL and maps served and bare paths to files", () => {
    expect(moduleUrl("file:///p/m.ts", "/cwd")).toBe("file:///p/m.ts");
    expect(moduleUrl("http://localhost:3000/conformance/m.ts", "/cwd")).toBe("file:///cwd/conformance/m.ts");
    expect(moduleUrl("http://localhost:3000/@fs/abs/m.ts", "/cwd")).toBe("file:///abs/m.ts");
    expect(moduleUrl("/abs/m.ts", "/cwd")).toBe("file:///abs/m.ts");
  });
});

describe("SessionGroup and groupDiags", () => {
  test("a clean group parses and gives no diag", () => {
    const g = group([session(1), session(2)]);
    expect(SessionGroup.parse(g).ok).toBe(true);
    expect(groupDiags(JSON.stringify(g), "g.json")).toEqual([]);
  });

  test("E2007 on a file that is not JSON or fails SessionGroup, at 1:1", () => {
    for (const text of ["{", JSON.stringify({ ...group([session(1)]), v: 2 }), JSON.stringify(group([{}]))]) {
      const [d, ...rest] = groupDiags(text, "g.json");
      expect(rest).toEqual([]);
      expect(d).toMatchObject({ kind: "diag", code: "E2007", path: "g.json", line: 1, col: 1, see: "std.multi" });
    }
  });

  test("E2008 once per user session without a seed, never on its seeded twin", () => {
    fc.assert(
      fc.property(fc.array(fc.option(fc.nat(), { nil: undefined }), { minLength: 1, maxLength: 5 }), (seeds) => {
        const diags = groupDiags(JSON.stringify(group(seeds.map((s) => session(s)))), "g.json");
        expect(diags.map((d) => d.code)).toEqual(seeds.flatMap((s) => (s === undefined ? ["E2008"] : [])));
        const twin = groupDiags(JSON.stringify(group(seeds.map((s) => session(s ?? 0)))), "g.json");
        expect(twin).toEqual([]);
      }),
      { seed: 1337 },
    );
  });
});
