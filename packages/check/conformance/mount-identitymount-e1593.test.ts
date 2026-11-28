// k.mount, Declaration "The mount is that default export only: the build passes its `path` to the router and its `path` and `links` to a shell (k.return), and no other `identityMount` call's `path` or `links` reaches either."
// k.mount, Declaration "Another call throws nothing at run; in a project file other than a test file it is E1593."
// k.mount, Rules "E1593 an `identityMount` call from `@keel/router` (any local name) in a code file of the project that is not a test file (k.testing), but the call that is `identity.ts`'s `export default` expression: no router or shell reads its mount, and the call alone puts the `/__keel/user` read in the bundle (`keel check`, at the call). Fix: none, but E1589's below."
// k.mount, Messages "E1580: `identity.ts's default export is not identityMount('<literal>') of lowercase / segments` (86 units) or `identity.server.ts gives no handle: { path: <identity.ts default import>.path }` (79). E1589: `<name> (static) serves no router, so with identity.ts its pages never learn the reader` (`site`: 84) or `<name> (client) has no servedBy: no origin of it mounts the identity handle` (`web`: 72). E1593: `identityMount is for identity.ts's default export; import that file instead` (75). What to do instead is `keel explain`'s. E1589's fix, for a `client` deployable when `topology.ts` has exactly one `node` deployable, adds `servedBy: '<its name>'` to the entry; otherwise none."
// Spec: k.mount, clause "With `identity.ts` default-exporting `identityMount('/api/auth')`, each of `identityMount('/x', { links: ['/v'] })` in `modules/a/extra.ts`, and `const m = identityMount('/y')` in `identity.ts` beside that default export, gives one E1593 at the call under `keel check`; the call in `modules/a/extra.test.ts` gives none; in a project without `identity.ts` the call in `modules/a/extra.ts` gives one E1593."
// Seed 1337 (fc.assert below). In-memory project, `check(files, { types: false })`. The by-code fixture is fixtures-by-code.ts (E1593).
// ASSUMPTIONS: "at the call" is the line and 1-based column where the call expression begins (the callee, as the RFC says: the same position); "a test file" is a `*.test.ts` file (k.testing); "any local name" is an import alias of `identityMount` from `@keel/router`.
// Untestable under `check`: "throws nothing at run" (a run-time property of the call) and "no other call's `path` or `links` reaches" the router or a shell (the build's entry; asserted in packages/testing/conformance/mount-stray-links.test.ts).
import { check } from "@keel/check";
import { explain } from "@keel/check/explain";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED, approxTokens } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const HEAD = "import { identityMount } from '@keel/router'\n";
const SERVER =
  "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n";
const TOPOLOGY = f(
  "topology.ts",
  "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node' } })\n",
);
const IDENTITY = (identityTs = `${HEAD}export default identityMount('/api/auth')\n`): Files => [
  f("identity.ts", identityTs),
  f("identity.server.ts", SERVER),
];
const project = (identity: Files, ...more: Files): Files => [
  TOPOLOGY,
  f("modules/a/module.ts", MANIFEST("a")),
  ...identity,
  ...more,
];
const e1593 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1593");
const MESSAGE = "identityMount is for identity.ts's default export; import that file instead";
const STRAY = "identityMount('/x', { links: ['/v'] })";
const EXTRA = f("modules/a/extra.ts", `${HEAD}export const extra = ${STRAY}\n`);

/** The 1-based line and column where `needle` first occurs in `source`. */
const where = (source: string, needle: string): { line: number; col: number } => {
  const lines = source.split("\n");
  const line = lines.findIndex((l) => l.includes(needle));
  return { line: line + 1, col: (lines[line] ?? "").indexOf(needle) + 1 };
};

describe("k.mount: E1593 an identityMount call that is not identity.ts's default export", () => {
  test("with identity.ts default-exporting identityMount('/api/auth'), identityMount('/x', { links: ['/v'] }) in modules/a/extra.ts gives one E1593 at the call under keel check", () => {
    const found = e1593(project(IDENTITY(), EXTRA));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("modules/a/extra.ts");
    expect({ line: found[0]?.line, col: found[0]?.col }).toEqual(where(EXTRA.source, STRAY));
  });

  test("with identity.ts default-exporting identityMount('/api/auth'), const m = identityMount('/y') in identity.ts beside that default export gives one E1593 at the call", () => {
    const source = `${HEAD}export default identityMount('/api/auth')\nconst m = identityMount('/y')\nexport const other = m\n`;
    const found = e1593(project(IDENTITY(source)));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("identity.ts");
    expect({ line: found[0]?.line, col: found[0]?.col }).toEqual(where(source, "identityMount('/y')"));
  });

  test("the identityMount call in modules/a/extra.test.ts gives none", () => {
    const test = f("modules/a/extra.test.ts", EXTRA.source);
    expect(e1593(project(IDENTITY(), test))).toEqual([]);
  });

  test("in a project without identity.ts the call in modules/a/extra.ts gives one E1593", () => {
    const found = e1593(project([], EXTRA));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("modules/a/extra.ts");
  });

  test("the identityMount call that is identity.ts's export default expression gives none", () => {
    expect(e1593(project(IDENTITY()))).toEqual([]);
  });

  test("E1593 is `identityMount is for identity.ts's default export; import that file instead`, 75 units", () => {
    const [d] = e1593(project(IDENTITY(), EXTRA));
    expect(d?.message).toBe(MESSAGE);
    expect(d?.message.length).toBe(75);
  });

  test("E1593 has no fix", () => {
    const [d] = e1593(project(IDENTITY(), EXTRA));
    expect(d?.fix ?? null).toBeNull();
  });

  test("an `export default m` after `const m = identityMount(...)` in identity.ts is one E1593 at the call, beside E1580", () => {
    const source = `${HEAD}const m = identityMount('/api/auth')\nexport default m\n`;
    const files = project(IDENTITY(source));
    const found = e1593(files);
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(where(source, "identityMount('/api/auth')").line);
    expect(check(files, { types: false }).diagnostics.some((d) => d.code === "E1580")).toBe(true);
  });

  test("an identityMount not imported from @keel/router gives no E1593", () => {
    const source = "declare function identityMount(p: string): unknown\nexport const extra = identityMount('/x')\n";
    expect(e1593(project(IDENTITY(), f("modules/a/extra.ts", source)))).toEqual([]);
  });

  test("for every local name of the import, every non-test code path and every number of calls, each call outside identity.ts's default export is one E1593, and in a test file none", () => {
    const name = fc.stringMatching(/^[a-z][A-Za-z0-9]{0,8}$/).filter((n) => n !== "identityMount");
    const dir = fc.array(fc.constantFrom("a", "util", "deep"), { minLength: 0, maxLength: 2 });
    const stem = fc.constantFrom("extra", "helpers", "page");
    fc.assert(
      fc.property(
        name,
        dir,
        stem,
        fc.integer({ min: 1, max: 3 }),
        fc.boolean(),
        fc.constantFrom("/x", "/y/z", "/a-b"),
        (local, dirs, base, n, withIdentity, p) => {
          const body = Array.from({ length: n }, (_, i) => `export const c${i} = ${local}('${p}')\n`).join("");
          const source = `import { identityMount as ${local} } from '@keel/router'\n${body}`;
          const path = ["modules", "a", ...dirs, `${base}.ts`].join("/");
          const testPath = ["modules", "a", ...dirs, `${base}.test.ts`].join("/");
          const identity = withIdentity ? IDENTITY() : [];
          expect(e1593(project(identity, f(path, source)))).toHaveLength(n);
          expect(e1593(project(identity, f(testPath, source)))).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("explain E1593 has an entry naming the code and identity.ts, at most 300 tokens", () => {
    const text = explain("E1593");
    expect(text).toContain("E1593");
    expect(text).toContain("identity.ts");
    expect(approxTokens(text)).toBeLessThanOrEqual(300);
    expect(text.replaceAll("E1593", "#")).not.toBe(explain("E9998").replaceAll("E9998", "#"));
  });
});
