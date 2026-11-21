// Spec: k.mount, clause "`identityMount('/api/auth', { links: ['/verify'] })` is clean, its `links` `['/verify']`; entries `''`, `'verify'`, `'/a?b'`, `'/../x'`, a second `'/verify'` and a variable each give one E1584 under `keel check`, and the call throws E1584 for each literal." (the `keel check` half; the run-time half: packages/router/conformance/mount-links-e1584.test.ts)
// Spec: k.mount, Rules "E1580 ... optionally with `{ links: [...] }` ..." (E1580 accepts the second argument).
// Seed 1337 (fc.assert below). In-memory project, `check(files, { types: false })`.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const IDENTITY = (second: string): string =>
  `import { identityMount } from '@keel/router'\nconst v = '/verify'\nexport default identityMount('/api/auth', ${second})\n`;
const SERVER = `import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n`;

const project = (second: string): Files => [
  f(
    "topology.ts",
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node' } })\n",
  ),
  f("modules/a/module.ts", MANIFEST("a")),
  f("identity.ts", IDENTITY(second)),
  f("identity.server.ts", SERVER),
];
const only = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);

describe("k.mount: E1584 a links entry that is not a literal subpath", () => {
  test("`identityMount('/api/auth', { links: ['/verify'] })` is clean: no E1584 and no E1580", () => {
    const files = project("{ links: ['/verify'] }");
    expect(only(files, "E1584")).toEqual([]);
    expect(only(files, "E1580")).toEqual([]);
  });

  test("entries '', 'verify', '/a?b' and '/../x' each give one E1584", () => {
    for (const bad of ["''", "'verify'", "'/a?b'", "'/../x'"]) {
      expect(only(project(`{ links: [${bad}] }`), "E1584"), bad).toHaveLength(1);
    }
  });

  test("a second '/verify' gives one E1584", () => {
    expect(only(project("{ links: ['/verify', '/verify'] }"), "E1584")).toHaveLength(1);
  });

  test("a variable entry gives one E1584", () => {
    expect(only(project("{ links: [v] }"), "E1584")).toHaveLength(1);
  });

  test("for any generated bad entry (a missing leading '/', a '?', '#', '%' or '..' segment), one E1584", () => {
    const bad = fc.oneof(
      fc.stringMatching(/^[a-z]{1,6}$/),
      fc.stringMatching(/^[a-z]{1,6}$/).map((v) => `/${v}?x`),
      fc.stringMatching(/^[a-z]{1,6}$/).map((v) => `/${v}#x`),
      fc.stringMatching(/^[a-z]{1,6}$/).map((v) => `/${v}%2f`),
      fc.stringMatching(/^[a-z]{1,6}$/).map((v) => `/${v}/..`),
    );
    fc.assert(
      fc.property(bad, (entry) => {
        expect(only(project(`{ links: ['${entry}'] }`), "E1584")).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});
