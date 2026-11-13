// Spec: k.server, Conformance "A loader throwing in `modules/a/a.server.ts` logs a `diag` whose `frames` start at that file: at most 5, none under `packages/`, `node_modules/` or outside the working directory."
// Seed: 1337.
// @vitest-environment happy-dom
// ASSUMED shape (spec: "each `<path>:<line>:<col>` relative to the working directory"): `frames` is an array of strings in json mode.
// The throw is a real Error whose `stack` is replaced by a generated V8-style stack: a loader cannot live in a real
// `modules/a/a.server.ts` inside this suite, so the stack names the file under the working directory.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, build, get } from "./fixtures.ts";

type Where = "app" | "packages" | "node_modules" | "outside";
interface Frame {
  readonly where: Where;
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly parens: boolean;
}

const APP_FILES = ["modules/a/a.server.ts", "modules/a/util.ts", "modules/b/b.server.ts", "lib/x.ts"];
const cwd = (): string => process.cwd();
const absolute = (f: Frame): string => (f.where === "outside" ? `/__outside__/${f.file}` : `${cwd()}/${f.file}`);
const text = (f: Frame): string => {
  const pos = `${absolute(f)}:${f.line}:${f.col}`;
  return f.parens ? `    at fn (${pos})` : `    at ${pos}`;
};
const stackOf = (frames: readonly Frame[]): string => ["Error: boom", ...frames.map(text)].join("\n");
const expectedOf = (frames: readonly Frame[]): string[] =>
  frames
    .filter((f) => f.where === "app")
    .slice(0, 5)
    .map((f) => `${f.file}:${f.line}:${f.col}`);

const frameArb: fc.Arbitrary<Frame> = fc.oneof(
  fc.record({
    where: fc.constant<Where>("app"),
    file: fc.constantFrom(...APP_FILES),
    line: fc.integer({ min: 1, max: 400 }),
    col: fc.integer({ min: 1, max: 80 }),
    parens: fc.boolean(),
  }),
  fc.record({
    where: fc.constant<Where>("packages"),
    file: fc.constantFrom("packages/router/src/loader.ts", "packages/server/src/app.ts"),
    line: fc.integer({ min: 1, max: 400 }),
    col: fc.integer({ min: 1, max: 80 }),
    parens: fc.boolean(),
  }),
  fc.record({
    where: fc.constant<Where>("node_modules"),
    file: fc.constantFrom("node_modules/vitest/dist/runner.js", "node_modules/@keel/std-x/index.js"),
    line: fc.integer({ min: 1, max: 400 }),
    col: fc.integer({ min: 1, max: 80 }),
    parens: fc.boolean(),
  }),
  fc.record({
    where: fc.constant<Where>("outside"),
    file: fc.constantFrom("lib/elsewhere.ts", "node/internal/process.js"),
    line: fc.integer({ min: 1, max: 400 }),
    col: fc.integer({ min: 1, max: 80 }),
    parens: fc.boolean(),
  }),
);

const app = (line: number, col: number): Frame => ({ where: "app", file: APP_FILES[0] ?? "", line, col, parens: true });

async function framesLogged(stack: string, mode: "dev" | "production"): Promise<unknown> {
  const lines: string[] = [];
  const thrown = new Error("boom");
  thrown.stack = stack;
  const { app: served } = await build({ show: () => Promise.reject(thrown) }, mode, {
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  await served.fetch(get("/orders/open"));
  const diags = lines
    .map((l): unknown => JSON.parse(l))
    .filter((r) => typeof r === "object" && r !== null && Reflect.get(r, "kind") === "diag");
  expect(diags.length).toBeGreaterThan(0);
  const first = diags[0];
  return typeof first === "object" && first !== null ? Reflect.get(first, "frames") : undefined;
}

describe("k.server: diag frames", () => {
  for (const mode of ["dev", "production"] as const) {
    test(`a loader throwing in \`modules/a/a.server.ts\` logs a \`diag\` whose \`frames\` start at that file, in ${mode}`, async () => {
      const frames = await framesLogged(stackOf([app(12, 5), app(30, 9)]), mode);
      expect(Array.isArray(frames)).toBe(true);
      expect(frames).toEqual(["modules/a/a.server.ts:12:5", "modules/a/a.server.ts:30:9"]);
    });
  }

  test("frames are at most 5", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(frameArb, { minLength: 0, maxLength: 12 }), async (frames) => {
        const logged = await framesLogged(stackOf([app(1, 1), ...frames]), "dev");
        expect(Array.isArray(logged) && logged.length).toBeLessThanOrEqual(5);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("frames hold none under `packages/`, `node_modules/` or outside the working directory: they are the first 5 app frames, relative to the working directory", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(frameArb, { minLength: 0, maxLength: 14 }), async (frames) => {
        const all = [app(7, 3), ...frames];
        const logged = await framesLogged(stackOf(all), "dev");
        expect(logged).toEqual(expectedOf(all));
        for (const f of Array.isArray(logged) ? logged : []) {
          expect(String(f)).not.toMatch(/^(packages\/|node_modules\/|\/)|(^|\/)node_modules\//);
          expect(String(f)).not.toContain(cwd());
          expect(String(f)).toMatch(/:\d+:\d+$/);
        }
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("frames start at the first app frame even when kernel and dependency frames come first", async () => {
    const kernel: Frame = { where: "packages", file: "packages/router/src/loader.ts", line: 9, col: 2, parens: true };
    const dep: Frame = { where: "node_modules", file: "node_modules/x/i.js", line: 3, col: 4, parens: false };
    const frames = await framesLogged(stackOf([kernel, dep, app(21, 8)]), "dev");
    expect(frames).toEqual(["modules/a/a.server.ts:21:8"]);
  });
});
