// Spec: k.mount, Rules "E1580 `identity.ts` whose default export is not `identityMount('<literal>')` of lowercase `/` segments, or with no `identity.server.ts` giving `handle: { path: <its default import>.path }` (a literal there too) · E1581 a module file importing `identity.ts` where a `static` deployable, or a `client` one without `host` or with `shells`, serves the module: no origin serving it mounts `handle` · E1582 a `subpath` `href` refuses (`keel check` for a literal; the call throws) · E1583 a native submit with a file chosen. Fix: none."
// Spec: k.mount, Conformance "E1580, E1581 and E1582 each have a triggering fixture and a clean one; a chosen file is E1583, nothing recorded."
// Spec: k.mount, Declaration "`identity.ts` imports nothing server-only, so a page on any deployable imports it."
// Seed 1337 (fc.assert below). E1583 is a runtime error of a native submit: packages/testing/conformance/mount-form.test.ts. `keel build` reads the same
// rules: packages/cli/conformance/mount-rules-build.test.ts. In-memory project, `check(files, { types: false })`.
// Not stated by the spec and so not asserted: that an `identity.server.ts` whose `handle.path` is a literal beside an `identity.ts` is or is not E1580.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const IDENTITY = (arg: string): string =>
  `import { identityMount } from '@keel/router'\nexport default identityMount(${arg})\n`;
const SERVER = `import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n`;
const NO_HANDLE = `import { identity } from '@keel/server'\nexport default identity({ identify: async () => '' })\n`;
const USES = (call: string): string => `import mount from '../../identity.ts'\nexport const signin = ${call}\n`;

const only = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);

const clean = (): Files => [
  f(
    "topology.ts",
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node' } })\n",
  ),
  f("modules/a/module.ts", MANIFEST("a")),
  f("identity.ts", IDENTITY("'/api/auth'")),
  f("identity.server.ts", SERVER),
  f("modules/a/signin.ts", USES("mount.href('/sign-in/email')")),
];
const replacing = (files: Files, path: string, source: string): Files => [
  ...files.filter((x) => x.path !== path),
  f(path, source),
];

describe("k.mount: E1580 identity.ts and identity.server.ts", () => {
  test("a project with `identityMount('/api/auth')` and an `identity.server.ts` giving `handle: { path: mount.path }` has no E1580 and no E1579", () => {
    expect(only(clean(), "E1580")).toEqual([]);
    expect(only(clean(), "E1579")).toEqual([]);
  });

  test("an `identity.ts` default-exporting `identityMount(p)` with `p` a variable is one E1580", () => {
    const files = replacing(
      clean(),
      "identity.ts",
      `import { identityMount } from '@keel/router'\nconst p = '/api/auth'\nexport default identityMount(p)\n`,
    );
    expect(only(files, "E1580")).toHaveLength(1);
  });

  test("`identityMount('/API')` , `identityMount('api')` and `identityMount('/api/Auth')`, paths that are not lowercase `/` segments are each one E1580", () => {
    for (const bad of ["'/API'", "'api'", "'/api/Auth'"]) {
      expect(only(replacing(clean(), "identity.ts", IDENTITY(bad)), "E1580"), bad).toHaveLength(1);
    }
  });

  test("an `identity.ts` whose default export is not an `identityMount(...)` call is one E1580", () => {
    for (const bad of [
      "export default { path: '/api/auth', href: () => '/api/auth' }\n",
      "export const mount = 1\n",
      "",
    ]) {
      expect(only(replacing(clean(), "identity.ts", bad), "E1580")).toHaveLength(1);
    }
  });

  test("an `identity.ts` with no `identity.server.ts`, or one with no `handle`, is one E1580", () => {
    expect(
      only(
        clean().filter((x) => x.path !== "identity.server.ts"),
        "E1580",
      ),
    ).toHaveLength(1);
    expect(only(replacing(clean(), "identity.server.ts", NO_HANDLE), "E1580")).toHaveLength(1);
  });

  test("an `identityMount` of generated lowercase `/` segments beside `handle: { path: mount.path }` is clean", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/), { minLength: 1, maxLength: 4 }), (segments) => {
        const files = replacing(clean(), "identity.ts", IDENTITY(`'/${segments.join("/")}'`));
        expect(only(files, "E1580")).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("a project with no `identity.ts` has no E1580", () => {
    const files = clean().filter(
      (x) => x.path !== "identity.ts" && x.path !== "identity.server.ts" && x.path !== "modules/a/signin.ts",
    );
    expect(only(files, "E1580")).toEqual([]);
  });
});

const page = USES("mount.href('/sign-in/email')");
const topo = (deployables: string): Files[number] =>
  f("topology.ts", `import { topology } from '@keel/server'\nexport default topology({ ${deployables} })\n`);
const withTopology = (deployables: string, extra: Files = []): Files => [
  ...clean().filter((x) => x.path !== "topology.ts"),
  topo(deployables),
  ...extra,
];
const SHELLS = "shells: { tauri: { id: 'dev.keel.mount', name: 'Mount' } }";

describe("k.mount: E1581 a module importing identity.ts where no origin mounts handle", () => {
  test("a module file importing `identity.ts` served by a `static` deployable is one E1581", () => {
    expect(only(withTopology("web: { modules: ['a'], adapter: 'static' }"), "E1581")).toHaveLength(1);
  });

  test("a module file importing `identity.ts` served by a `client` deployable without `host` is one E1581", () => {
    expect(only(withTopology("web: { modules: ['a'], adapter: 'client' }"), "E1581")).toHaveLength(1);
  });

  test("a module file importing `identity.ts` served by a `client` deployable with `host` and `shells` is one E1581", () => {
    const files = withTopology(
      `api: { modules: ['b'], adapter: 'node' }, web: { modules: ['a'], adapter: 'client', host: 'api', ${SHELLS} }`,
      [f("modules/b/module.ts", MANIFEST("b"))],
    );
    expect(only(files, "E1581")).toHaveLength(1);
  });

  test("the same module on a `node` deployable, and on a `client` deployable with `host` and no `shells`, is clean", () => {
    expect(only(clean(), "E1581")).toEqual([]);
    const hosted = withTopology(
      "api: { modules: ['b'], adapter: 'node' }, web: { modules: ['a'], adapter: 'client', host: 'api' }",
      [f("modules/b/module.ts", MANIFEST("b"))],
    );
    expect(only(hosted, "E1581")).toEqual([]);
  });

  test("a `static` or `client` deployable whose modules do not import `identity.ts` is clean, and one importing it is one E1581 per importing file", () => {
    const bare = [f("modules/a/signin.ts", "export const signin = '/sign-in'\n")];
    for (const adapter of ["static", "client"]) {
      const files = (extra: Files): Files => [
        ...withTopology(`web: { modules: ['a'], adapter: '${adapter}' }`).filter(
          (x) => x.path !== "modules/a/signin.ts",
        ),
        ...extra,
      ];
      expect(only(files(bare), "E1581"), adapter).toEqual([]);
      const two = [
        f("modules/a/one.ts", page.replace("signin", "one")),
        f("modules/a/two.ts", page.replace("signin", "two")),
      ];
      expect(only(files(two), "E1581"), adapter).toHaveLength(2);
    }
  });

  test("a module importing `identity.ts` is not E1004, which `identity.server.ts` would be on a client-reachable path", () => {
    expect(only(clean(), "E1004")).toEqual([]);
  });
});

describe("k.mount: E1582 a subpath that href refuses, at a literal", () => {
  const bad = [
    "'//x.example'",
    "'/../x'",
    "'/a/..'",
    "'/a?b'",
    "'/a#b'",
    "'/a%2f'",
    "'https://x'",
    "'/a\\\\b'",
    "'/a:b'",
  ];

  test("`href` of a refused literal subpath in a module file is one E1582 each", () => {
    for (const subpath of bad) {
      const files = replacing(clean(), "modules/a/signin.ts", USES(`mount.href(${subpath})`));
      expect(only(files, "E1582"), subpath).toHaveLength(1);
    }
  });

  test("`href` of an accepted literal subpath, with or without a search map, and of a non-literal subpath is clean", () => {
    for (const call of [
      "mount.href('/sign-in/email')",
      "mount.href()",
      "mount.href('')",
      "mount.href('/sign-in/email', { next: '/x' })",
      "mount.href(subpath)",
    ]) {
      const source = `import mount from '../../identity.ts'\ndeclare const subpath: string\nexport const signin = ${call}\n`;
      expect(only(replacing(clean(), "modules/a/signin.ts", source), "E1582"), call).toEqual([]);
    }
  });

  test("every generated accepted literal subpath is clean and every generated refused one is one E1582", () => {
    const segment = fc.stringMatching(/^[A-Za-z0-9._~-]{1,6}$/).filter((v) => v !== "." && v !== "..");
    const good = fc.array(segment, { minLength: 1, maxLength: 3 }).map((parts) => `/${parts.join("/")}`);
    const refuse = fc.constantFrom("?", "#", "%", "\\\\", ":", "//");
    fc.assert(
      fc.property(good, refuse, (sub, ch) => {
        const ok = replacing(clean(), "modules/a/signin.ts", USES(`mount.href('${sub}')`));
        expect(only(ok, "E1582")).toEqual([]);
        const broken = replacing(clean(), "modules/a/signin.ts", USES(`mount.href('${sub}${ch}x')`));
        expect(only(broken, "E1582")).toHaveLength(1);
        const dots = replacing(clean(), "modules/a/signin.ts", USES(`mount.href('${sub}/..')`));
        expect(only(dots, "E1582")).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("k.mount: E1580 to E1582 have no fix", () => {
  test("each diagnostic carries no fix", () => {
    const e1580 = only(replacing(clean(), "identity.ts", IDENTITY("'/API'")), "E1580");
    const e1581 = only(withTopology("web: { modules: ['a'], adapter: 'static' }"), "E1581");
    const e1582 = only(replacing(clean(), "modules/a/signin.ts", USES("mount.href('//x')")), "E1582");
    for (const [d] of [e1580, e1581, e1582]) {
      expect(d).toBeDefined();
      expect(d?.fix ?? null).toBeNull();
    }
  });
});
