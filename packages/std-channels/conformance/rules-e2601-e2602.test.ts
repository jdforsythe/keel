// Spec: std.channels, clause "`channel` throws E2602 for a message schema with a nested `s.secret`; `keel check` reports E2601 and E2602 on fixtures and nothing on their clean twins."
// Spec: std.channels, rules E2601 (`channelRoute` outside a `*.server.ts` file) and E2602 (a channel `message` schema holding an `s.secret`).
// Seed 1337
// Assumption: as for std.jobs E2501, `check()` imports nothing, so the rules register by importing `@keel/std-channels/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` listing `deps`.
import { check } from "@keel/check";
import { s } from "@keel/schema";
import type { Schema } from "@keel/schema";
import { channel } from "@keel/std-channels";
import "@keel/std-channels/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const found = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);

const base: Files = [
  {
    path: "modules/chan/module.ts",
    source: `import { module } from "@keel/compiler"\nexport default module({ id: "chan", deps: ["@keel/std-channels"], capabilities: ["clock", "net", "observe"] })\n`,
  },
  {
    path: "topology.ts",
    source: `import { topology } from "@keel/server"\nexport default topology({ web: { modules: ["chan"], adapter: "node" } })\n`,
  },
];
const channelFile = (message: string): Files[number] => ({
  path: "modules/chan/boardChannel.ts",
  source: `import { channel } from "@keel/std-channels"\nimport { s } from "@keel/schema"\nexport const boardChannel = channel("chan.board", { path: "/api/board/events", params: s.object({}), message: ${message} })\n`,
});
const routeSource = `import { channelRoute } from "@keel/std-channels/server"\nimport { boardChannel } from "./boardChannel.ts"\nexport const boardEvents = channelRoute(boardChannel, { id: "chan.boardEvents", stores: () => ({}), member: () => true })\n`;

const wrap = (inner: string, depth: number, kind: "object" | "array"): string => {
  let out = inner;
  for (let i = 0; i < depth; i++) out = kind === "object" ? `s.object({ k: ${out} })` : `s.array(${out})`;
  return out;
};
const wrapSchema = (inner: Schema<unknown>, depth: number, kind: "object" | "array"): Schema<unknown> => {
  let out: Schema<unknown> = inner;
  for (let i = 0; i < depth; i++)
    out =
      kind === "object" ? Reflect.apply(s.object, undefined, [{ k: out }]) : Reflect.apply(s.array, undefined, [out]);
  return out;
};

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  return null;
};

test("`channel` throws E2602 for a message schema with a nested `s.secret`.", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 3 }),
      fc.constantFrom<"object" | "array">("object", "array"),
      (depth, kind) => {
        const bad = wrapSchema(s.secret(s.string()), depth, kind);
        const make = (message: unknown) => () =>
          Reflect.apply(channel, undefined, [
            "chan.board",
            { path: "/api/board/events", params: s.object({}), message },
          ]);
        expect(codeOf(make(s.object({ token: bad })))).toBe("E2602");
        expect(codeOf(make(s.object({ token: wrapSchema(s.string(), depth, kind) })))).toBeNull();
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});

test("`channel` without a `message` schema does not throw.", () => {
  expect(codeOf(() => channel("chan.board", { path: "/api/board/events", params: s.object({}) }))).toBeNull();
});

test("E2601 `channelRoute` outside a `*.server.ts` file fires on a fixture and not on its clean twin.", () => {
  const withRoute = (path: string): Files => [
    ...base,
    channelFile("s.object({ text: s.string() })"),
    { path, source: routeSource },
  ];
  expect(found(withRoute("modules/chan/boardEvents.ts"), "E2601").length).toBe(1);
  expect(found(withRoute("modules/chan/boardEvents.server.ts"), "E2601").length).toBe(0);
});

test("E2602 a channel `message` schema holding an `s.secret` fires on a fixture and not on its clean twin.", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 3 }),
      fc.constantFrom<"object" | "array">("object", "array"),
      (depth, kind) => {
        const bad = `s.object({ token: ${wrap("s.secret(s.string())", depth, kind)} })`;
        const clean = `s.object({ token: ${wrap("s.string()", depth, kind)} })`;
        expect(found([...base, channelFile(bad)], "E2602").length).toBe(1);
        expect(found([...base, channelFile(clean)], "E2602").length).toBe(0);
      },
    ),
    { seed: 1337, numRuns: 12 },
  );
});
