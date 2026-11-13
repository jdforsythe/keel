// @vitest-environment node
// appFrames and caught (k.server Log): app positions only, relative, at most 5, in stack order; the KeelError holds no
// stack. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { appFrames } from "../src/internal/appFrames.ts";
import { caught } from "../src/internal/caught.ts";
import { diagLine } from "../src/internal/diagLine.ts";

const SEED = 1337;
const CWD = "/srv/app";
const withStack = (lines: readonly string[]): Error => {
  const e = new Error("boom");
  e.stack = ["Error: boom", ...lines].join("\n");
  return e;
};
const seg = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
const pos = fc.tuple(fc.integer({ min: 1, max: 999 }), fc.integer({ min: 1, max: 99 }));
type Line = { readonly text: string; readonly app: string | null };
const lineArb: fc.Arbitrary<Line> = fc.oneof(
  fc.tuple(seg, seg, pos, fc.boolean()).map(([d, f, [l, c], named]): Line => {
    const at = `${CWD}/modules/${d}/${f}.ts:${l}:${c}`;
    return { text: named ? `    at run (${at})` : `    at ${at}`, app: `modules/${d}/${f}.ts:${l}:${c}` };
  }),
  fc
    .tuple(seg, pos)
    .map(
      ([f, [l, c]]): Line => ({ text: `    at x (file://${CWD}/lib/${f}.ts:${l}:${c})`, app: `lib/${f}.ts:${l}:${c}` }),
    ),
  fc.tuple(seg, pos, fc.constantFrom("?t=1&token=x", "#frag", "?v=2#h"), fc.boolean()).map(
    ([f, [l, c], q, url]): Line => ({
      text: `    at q (${url ? "file://" : ""}${CWD}/src/${f}.ts${q}:${l}:${c})`,
      app: `src/${f}.ts:${l}:${c}`,
    }),
  ),
  fc
    .tuple(fc.constantFrom("packages/router/src", "node_modules/x", ".keel", "lib/node_modules/y"), seg, pos)
    .map(([d, f, [l, c]]): Line => ({ text: `    at y (${CWD}/${d}/${f}.js:${l}:${c})`, app: null })),
  fc.tuple(seg, pos).map(([f, [l, c]]): Line => ({ text: `    at z (/home/u/${f}.js:${l}:${c})`, app: null })),
  pos.map(([l, c]): Line => ({ text: `    at node:internal/process/task_queues:${l}:${c}`, app: null })),
  fc.constant<Line>({ text: "    at new Promise (<anonymous>)", app: null }),
);

describe("appFrames", () => {
  it("is the first 5 app positions in stack order, relative to the working directory", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { maxLength: 15 }), (lines) => {
        const want = lines.flatMap((l) => (l.app === null ? [] : [l.app])).slice(0, 5);
        expect(appFrames(withStack(lines.map((l) => l.text)), CWD)).toEqual(want);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("reads no frame from the message line and none from a value without a stack", () => {
    const e = new Error(`at ${CWD}/modules/a/a.ts:1:1`);
    e.stack = `Error: at ${CWD}/modules/a/a.ts:1:1`;
    expect(appFrames(e, CWD)).toEqual([]);
    expect(appFrames("thrown string", CWD)).toEqual([]);
    expect(appFrames({ stack: `x\n    at ${CWD}/a.ts:1:1` }, CWD)).toEqual([]);
  });
});

describe("caught", () => {
  it("gives attempt's keel.unexpected and keeps the stack out of it", async () => {
    const e = withStack([`    at f (${process.cwd()}/modules/a/a.server.ts:3:7)`]);
    const r = await caught(() => Promise.reject(e));
    expect(r.result.ok).toBe(false);
    expect(r.frames).toEqual(["modules/a/a.server.ts:3:7"]);
    expect(JSON.stringify(r.result)).not.toContain("a.server.ts");
  });

  it("catches a sync throw and resolves a value with no frames", async () => {
    const thrown = (): never => {
      throw withStack([`    at ${process.cwd()}/lib/x.ts:1:2`]);
    };
    expect((await caught(thrown)).frames).toEqual(["lib/x.ts:1:2"]);
    expect(await caught(() => 4)).toEqual({ result: { ok: true, value: 4 }, frames: [] });
  });
});

describe("diagLine", () => {
  it("writes frames in json only, and only when the record has them", () => {
    const d = { code: "keel.unexpected", message: "loader a threw: Error: boom", frames: ["modules/a/a.ts:1:1"] };
    expect(JSON.parse(diagLine("json", d)).frames).toEqual(["modules/a/a.ts:1:1"]);
    expect(diagLine("compact", d)).toBe("keel.unexpected loader a threw: Error: boom");
    expect("frames" in JSON.parse(diagLine("json", { code: "E1554", message: "m" }))).toBe(false);
  });
});
