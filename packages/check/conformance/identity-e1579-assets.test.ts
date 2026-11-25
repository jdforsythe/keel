// Spec: k.user, Rules "E1579 `identity.server.ts` without a default `identity(...)` export, or a `handle.path` (a literal, or `identity.ts`'s through `.path`) not of lowercase `/` segments, or at or under `/assets`, where a built client's files are served (k.deploy), or with a route of any deployable at or under it (`keel check`, `keel build`; `createApp` throws it). The `/assets` one is at `identity.server.ts`'s first line: `handle.path <p> is at or under /assets (built files)`, `<p>` the first 40 units of the path's JSON text, quotes included, no ellipsis (89 at the bound); `createApp` throws each `handle.path` case as `E1579 identity handle.path: lowercase / segments, not /assets, no route under it` (the text after the code: 74)"
// Spec: k.user, Conformance "For every `handle.path` `p` of lowercase `/` segments and no route at or under it, `keel check`, `keel build` and `createApp` each report E1579 exactly when `p` is `/assets` or begins `/assets/`: `/assets` and `/assets/auth` give one each, `/assetsx` and `/api/assets` none; the same holds for `p` given as `identity.ts`'s `.path`."
// Seed 1337 (fc.assert below). In-memory project, `check(files, { types: false })`. `keel build` is packages/cli/conformance/identity-e1579-assets-build.test.ts; `createApp` throwing it is packages/server/conformance/identity-e1579-assets.test.ts.
// ASSUMPTIONS: "the first 40 units" is `slice(0, 40)` of `JSON.stringify(p)` (quotes included), no ellipsis, as k.check's clip leaves a message of at most 89 units whole; "at `identity.server.ts`'s first line" is the diagnostic's `path` `identity.server.ts` and `line` 1. The Rules sentence's other forms (no default export, a path not of lowercase segments, a route under it) are identity-source-e1579.test.ts.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const SERVER_HEAD = "import { identity } from '@keel/server'\n";
const literal = (p: string): Files => [
  f(
    "identity.server.ts",
    `${SERVER_HEAD}export default identity({ identify: async () => '', handle: { path: '${p}', fn: () => new Response('') } })\n`,
  ),
];
const mounted = (p: string): Files => [
  f("identity.ts", `import { identityMount } from '@keel/router'\nexport default identityMount('${p}')\n`),
  f(
    "identity.server.ts",
    `${SERVER_HEAD}import mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n`,
  ),
];
const e1579 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1579");
const message = (p: string): string =>
  `handle.path ${JSON.stringify(p).slice(0, 40)} is at or under /assets (built files)`;
const refused = (p: string): boolean => p === "/assets" || p.startsWith("/assets/");

describe("k.user: E1579 refuses a handle.path at or under /assets", () => {
  for (const [form, make] of [
    ["a literal", literal],
    ["identity.ts's `.path`", mounted],
  ] as const) {
    test(`with handle.path given as ${form}, /assets and /assets/auth give one E1579 each, /assetsx and /api/assets none`, () => {
      expect(e1579(make("/assets"))).toHaveLength(1);
      expect(e1579(make("/assets/auth"))).toHaveLength(1);
      expect(e1579(make("/assetsx"))).toEqual([]);
      expect(e1579(make("/api/assets"))).toEqual([]);
    });

    test(`with handle.path given as ${form}, the E1579 is at identity.server.ts's first line, its message \`handle.path <p> is at or under /assets (built files)\``, () => {
      const [d] = e1579(make("/assets/auth"));
      expect(d?.path).toBe("identity.server.ts");
      expect(d?.line).toBe(1);
      expect(d?.message).toBe('handle.path "/assets/auth" is at or under /assets (built files)');
    });

    test(`with handle.path given as ${form}, for every handle.path p of lowercase / segments and no route at or under it, keel check reports E1579 exactly when p is /assets or begins /assets/`, () => {
      const seg = fc.stringMatching(/^[a-z][a-z0-9-]{0,6}$/);
      const path = fc
        .tuple(fc.constantFrom("assets", "assetsx", "api", "my-assets", "assets2"), fc.array(seg, { maxLength: 3 }))
        .map(([head, tail]) => `/${[head, ...tail].join("/")}`);
      fc.assert(
        fc.property(path, (p) => {
          expect(e1579(make(p)).length, p).toBe(refused(p) ? 1 : 0);
        }),
        { seed: SEED, numRuns: 60 },
      );
    });
  }

  test("the message is `handle.path <p> is at or under /assets (built files)`, <p> the path's JSON text cut to 40 units, 89 units whole at its bound", () => {
    const long = `/assets/${"a".repeat(60)}`;
    for (const make of [literal, mounted]) {
      const [d] = e1579(make(long));
      expect(d?.message).toBe(message(long));
      expect(d?.message.length).toBe(89);
      expect(d?.message.endsWith("...")).toBe(false);
    }
  });

  test("<p> is the first 40 units of the path's JSON text, quotes included, no ellipsis: exact at 39, 40 and 41 units", () => {
    for (const units of [39, 40, 41]) {
      const p = `/assets/${"a".repeat(units - 2 - "/assets/".length)}`;
      expect(JSON.stringify(p)).toHaveLength(units);
      for (const make of [literal, mounted]) {
        const [d] = e1579(make(p));
        const shown = JSON.stringify(p).slice(0, 40);
        expect(d?.message).toBe(`handle.path ${shown} is at or under /assets (built files)`);
        expect(shown.endsWith('"')).toBe(units <= 40);
        expect(d?.message.includes("...")).toBe(false);
      }
    }
  });

  test("for every path under /assets the message is the JSON text cut to 40 units and at most 89 units", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/), { maxLength: 5 }), (tail) => {
        const p = `/${["assets", ...tail].join("/")}`;
        const [d] = e1579(literal(p));
        expect(d?.message).toBe(message(p));
        expect(d?.message.length).toBeLessThanOrEqual(89);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("E1579 for /assets has no fix", () => {
    const [d] = e1579(literal("/assets"));
    expect(d?.fix ?? null).toBeNull();
  });
});
