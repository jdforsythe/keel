// @vitest-environment node
// appFrames and caught (k.server Log): app positions only, relative to the folder holding `artifacts`, at most 5, in
// stack order; `server.mjs` positions through its map; none without `artifacts`; the KeelError holds no stack. Seed 1337.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { appFrames } from "../src/internal/appFrames.ts";
import { caught } from "../src/internal/caught.ts";
import { diagLine } from "../src/internal/diagLine.ts";

const SEED = 1337;
const CWD = "/srv/app";
const quiet = (): void => undefined;
const read = appFrames(`${CWD}/.keel`, quiet);
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
  it("is the first 5 app positions in stack order, relative to the folder holding artifacts", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { maxLength: 15 }), (lines) => {
        const want = lines.flatMap((l) => (l.app === null ? [] : [l.app])).slice(0, 5);
        expect(read(withStack(lines.map((l) => l.text)))).toEqual(want);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("reads no frame from the message line and none from a value without a stack", () => {
    const e = new Error(`at ${CWD}/modules/a/a.ts:1:1`);
    e.stack = `Error: at ${CWD}/modules/a/a.ts:1:1`;
    expect(read(e)).toEqual([]);
    expect(read("thrown string")).toEqual([]);
    expect(read({ stack: `x\n    at ${CWD}/a.ts:1:1` })).toEqual([]);
  });

  it("reads none without artifacts", () => {
    expect(appFrames(undefined, quiet)(withStack([`    at f (${CWD}/modules/a/a.ts:1:1)`]))).toEqual([]);
  });

  it("maps a server.mjs position through server.mjs.map, read once, and drops one it cannot map", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-frames-map-"));
    const bundle = path.join(dir, "server.mjs");
    // Line 1: col 1 from modules/a/a.server.ts 1:1, col 11 from ../packages/x.ts 5:3.
    const map = {
      version: 3,
      sources: ["modules/a/a.server.ts", "../packages/x.ts"],
      names: [],
      mappings: "AAAA,UCIE",
    };
    const at = (col: number) => `    at f (${bundle}:1:${col})`;
    try {
      const warned: string[] = [];
      const missing = appFrames(dir, (m) => warned.push(m));
      expect(missing(withStack([at(1)]))).toEqual([]);
      expect(missing(withStack([at(1)]))).toEqual([]);
      expect(warned).toEqual(["server.mjs.map missing, over 32 MB or malformed; frames in server.mjs are dropped"]);
      fs.writeFileSync(`${bundle}.map`, JSON.stringify(map));
      const mapped = appFrames(dir, quiet);
      expect(mapped(withStack([at(11), at(1), `    at g (file://${bundle}?x=1:1:1)`]))).toEqual([
        "modules/a/a.server.ts:1:1",
        "modules/a/a.server.ts:1:1",
      ]);
      fs.rmSync(`${bundle}.map`);
      expect(mapped(withStack([at(1)]))).toEqual(["modules/a/a.server.ts:1:1"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("appFrames beside a built server.mjs", () => {
  const withBundle = (use: (dir: string) => void): void => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-frames-built-"));
    try {
      fs.writeFileSync(path.join(dir, "server.mjs"), "");
      use(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  it("takes a frame Node already mapped (under <artifacts>/) relative to <artifacts>, and drops one outside the project", () => {
    withBundle((dir) => {
      const r = appFrames(dir, quiet);
      const stack = withStack([
        `    at f (${dir}/modules/a/a.server.ts:4:2)`,
        `    at g (${path.dirname(dir)}/packages/x.ts:1:1)`,
        `    at h (${dir}/lib/u.ts:9:9)`,
      ]);
      expect(r(stack)).toEqual(["modules/a/a.server.ts:4:2", "lib/u.ts:9:9"]);
    });
  });

  it("reports a malformed or over-cap map once and drops server.mjs frames", () => {
    for (const write of [
      (f: string) => fs.writeFileSync(f, "{not json"),
      (f: string) => {
        fs.writeFileSync(f, "");
        fs.truncateSync(f, 32 * 1024 * 1024 + 1);
      },
    ])
      withBundle((dir) => {
        write(path.join(dir, "server.mjs.map"));
        const warned: string[] = [];
        const r = appFrames(dir, (m) => warned.push(m));
        const stack = withStack([`    at f (${dir}/server.mjs:1:1)`]);
        expect(r(stack)).toEqual([]);
        expect(r(stack)).toEqual([]);
        expect(warned).toHaveLength(1);
      });
  });
});

describe("caught", () => {
  it("gives attempt's keel.unexpected and keeps the stack out of it", async () => {
    const e = withStack([`    at f (${CWD}/modules/a/a.server.ts:3:7)`]);
    const r = await caught(() => Promise.reject(e), read);
    expect(r.result.ok).toBe(false);
    expect(r.frames).toEqual(["modules/a/a.server.ts:3:7"]);
    expect(JSON.stringify(r.result)).not.toContain("a.server.ts");
  });

  it("catches a sync throw and resolves a value with no frames", async () => {
    const thrown = (): never => {
      throw withStack([`    at ${CWD}/lib/x.ts:1:2`]);
    };
    expect((await caught(thrown, read)).frames).toEqual(["lib/x.ts:1:2"]);
    expect(await caught(() => 4, read)).toEqual({ result: { ok: true, value: 4 }, frames: [] });
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
