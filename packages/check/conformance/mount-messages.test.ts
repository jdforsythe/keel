// Spec: k.mount, Messages "E1580: `identity.ts's default export is not identityMount('<literal>') of lowercase / segments` (86 units) or `identity.server.ts gives no handle: { path: <identity.ts default import>.path }` (79). E1589: `<name> (static) serves no router, so with identity.ts its pages never learn the reader` (`site`: 84) or `<name> (client) has no servedBy: no origin of it mounts the identity handle` (`web`: 72). What to do instead is `keel explain`'s. E1589's fix, for a `client` deployable when `topology.ts` has exactly one `node` deployable, adds `servedBy: '<its name>'` to the entry; otherwise none."
// Seed 1337 (the property). In-memory project, `check(files, { types: false })`.
// ASSUMPTION: E1580's first form is the `identity.ts` default export written with a non-literal argument, its second an `identity.server.ts` with no `handle`; E1589's messages are asserted whole in mount-e1589.test.ts, their lengths here.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const HEAD = "import { identityMount } from '@keel/router'\n";
const SERVER =
  "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n";
const NO_HANDLE = "import { identity } from '@keel/server'\nexport default identity({ identify: async () => '' })\n";
const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const topo = (deployables: readonly string[]): Files[number] =>
  f("topology.ts", `import { topology } from '@keel/server'\nexport default topology({ ${deployables.join(", ")} })\n`);
const messages = (files: Files, code: string): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => d.message);

describe("k.mount: Messages", () => {
  test("a default export that is not `identityMount('<literal>')` is E1580 `identity.ts's default export is not identityMount('<literal>') of lowercase / segments`, 86 units", () => {
    const m = messages(
      [
        f("identity.ts", `${HEAD}const p = '/api/auth'\nexport default identityMount(p)\n`),
        f("identity.server.ts", SERVER),
      ],
      "E1580",
    );
    expect(m).toEqual(["identity.ts's default export is not identityMount('<literal>') of lowercase / segments"]);
    expect(m[0]?.length).toBe(86);
  });

  test("an `identity.server.ts` with no `handle` is E1580 `identity.server.ts gives no handle: { path: <identity.ts default import>.path }`, 79 units", () => {
    const m = messages(
      [f("identity.ts", `${HEAD}export default identityMount('/api/auth')\n`), f("identity.server.ts", NO_HANDLE)],
      "E1580",
    );
    expect(m).toEqual(["identity.server.ts gives no handle: { path: <identity.ts default import>.path }"]);
    expect(m[0]?.length).toBe(79);
  });

  test("E1589's messages for `site` (static) and `web` (client) are 84 and 72 units", () => {
    const base = [
      f("modules/a/module.ts", MANIFEST("a")),
      f("identity.ts", `${HEAD}export default identityMount('/api/auth')\n`),
      f("identity.server.ts", SERVER),
    ];
    const site = messages([topo(["site: { modules: ['a'], adapter: 'static' }"]), ...base], "E1589");
    const web = messages([topo(["web: { modules: ['a'], adapter: 'client' }"]), ...base], "E1589");
    expect(site).toEqual(["site (static) serves no router, so with identity.ts its pages never learn the reader"]);
    expect(site[0]?.length).toBe(84);
    expect(web).toEqual(["web (client) has no servedBy: no origin of it mounts the identity handle"]);
    expect(web[0]?.length).toBe(72);
  });

  test("whatever the deployable's name, E1589's messages are `<name> (client) has no servedBy: no origin of it mounts the identity handle` and the static twin, at most 89 units", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/), (name) => {
        const base = [
          f("modules/a/module.ts", MANIFEST("a")),
          f("identity.ts", `${HEAD}export default identityMount('/api/auth')\n`),
          f("identity.server.ts", SERVER),
        ];
        const c = messages([topo([`'${name}': { modules: ['a'], adapter: 'client' }`]), ...base], "E1589");
        const s = messages([topo([`'${name}': { modules: ['a'], adapter: 'static' }`]), ...base], "E1589");
        expect(c).toEqual([`${name} (client) has no servedBy: no origin of it mounts the identity handle`]);
        expect(s).toEqual([`${name} (static) serves no router, so with identity.ts its pages never learn the reader`]);
        expect(Math.max(c[0]?.length ?? 0, s[0]?.length ?? 0)).toBeLessThanOrEqual(89);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
