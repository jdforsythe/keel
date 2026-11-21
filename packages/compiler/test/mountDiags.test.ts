// k.mount Rules read statically: mountSource reads identity.ts, mountDiags reports E1580-E1582 and identityDiags
// resolves `handle.path` through `mount.path`. Seed 1337 for the property.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { identityDiags } from "../src/hosting/identityDiags.ts";
import { mountDiags } from "../src/hosting/mountDiags.ts";
import { mountSource } from "../src/hosting/mountSource.ts";

const MOUNT = "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n";
const SERVER =
  "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n";
const USE = (call: string) => `import mount from '../../identity'\nexport const x = ${call}\n`;
const codes = (files: { path: string; source: string }[]) => mountDiags(files).map((d) => d.code);
const base = [
  { path: "identity.ts", source: MOUNT },
  { path: "identity.server.ts", source: SERVER },
];

describe("mountSource and mountDiags", () => {
  it("reads the literal path, and refuses anything but identityMount of lowercase segments", () => {
    expect(mountSource(MOUNT)).toEqual({ path: "/api/auth" });
    for (const bad of ["export default identityMount('/A')", "export default 1", "", "export default f('/a')"])
      expect(mountSource(bad).problem).toBeDefined();
  });

  it("E1580 accepts { links: [...] } and {} as the second argument, and nothing else there or after it", () => {
    const with2 = (second: string) => [
      { path: "identity.ts", source: MOUNT.replace("('/api/auth')", `('/api/auth', ${second})`) },
      base[1] ?? { path: "", source: "" },
    ];
    for (const ok of ["{ links: ['/verify'] }", "{ links: [] }", "{}"]) expect(codes(with2(ok)), ok).toEqual([]);
    for (const bad of ["o", "{ links }", "{ links: v }", "{ links: [], x: 1 }", "{ ['links']: [] }", "{}, 1"])
      expect(codes(with2(bad)), bad).toEqual(["E1580"]);
  });

  it("E1584 at each bad links entry: not a string literal, '', not a subpath, or repeated", () => {
    const source = MOUNT.replace("('/api/auth')", "('/api/auth', { links: ['/a', v, '', 'b', '/a', `/c`] })");
    const diags = mountDiags([{ path: "identity.ts", source }, base[1] ?? { path: "", source: "" }]);
    expect(diags.map((d) => [d.code, d.line, d.col])).toEqual([59, 62, 66, 71, 77].map((col) => ["E1584", 2, col]));
  });

  it("E1580 for a literal handle.path or none; clean with mount.path; nothing without identity.ts", () => {
    expect(codes(base)).toEqual([]);
    const literal = SERVER.replace("mount.path", "'/api/auth'");
    expect(
      codes([
        { path: "identity.ts", source: MOUNT },
        { path: "identity.server.ts", source: literal },
      ]),
    ).toEqual(["E1580"]);
    expect(codes([{ path: "identity.server.ts", source: literal }])).toEqual([]);
  });

  it("E1581 per importing module file on a static deployable, by an extensionless import too", () => {
    const top = (a: string) => ({
      path: "topology.ts",
      source: `import { topology } from '@keel/server'\nexport default topology({ w: { modules: ['a'], adapter: '${a}' } })\n`,
    });
    const page = { path: "modules/a/p.ts", source: USE("mount.href('/x')") };
    expect(codes([...base, top("static"), page])).toEqual(["E1581"]);
    expect(codes([...base, top("node"), page])).toEqual([]);
  });

  it("E1581 for a client deployable without servedBy; none with servedBy, with or without shells", () => {
    const top = (client: string) => ({
      path: "topology.ts",
      source: `import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['b'], adapter: 'node' }, w: { modules: ['a'], adapter: 'client'${client} } })\n`,
    });
    const page = { path: "modules/a/p.ts", source: USE("mount.href('/x')") };
    const shells = ", shells: [{ kind: 'tauri', id: 'dev.keel.app', name: 'App' }]";
    expect(codes([...base, top(""), page])).toEqual(["E1581"]);
    expect(codes([...base, top(shells), page])).toEqual(["E1581"]);
    expect(codes([...base, top(", servedBy: 'api'"), page])).toEqual([]);
    expect(codes([...base, top(`, servedBy: 'api'${shells}`), page])).toEqual([]);
  });

  it("E1582 for every literal subpath with a refused character, none for accepted ones", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\/[a-z]{1,4}$/), fc.constantFrom("?", "#", "%", ":", "//", "/.."), (sub, bad) => {
        expect(codes([...base, { path: "modules/a/p.ts", source: USE(`mount.href('${sub}')`) }])).toEqual([]);
        expect(codes([...base, { path: "modules/a/p.ts", source: USE(`mount.href('${sub}${bad}')`) }])).toEqual([
          "E1582",
        ]);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("identityDiags reads handle.path through mount.path for E1579 and adds the mount rules locally", () => {
    const routes = [
      {
        path: "modules/a/a.contract.ts",
        source:
          "import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.x': { path: '/api/auth/x' } })\n",
      },
      {
        path: "modules/a/routes.ts",
        source:
          "import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nexport const routes = manifest(a, { 'a.x': { component: () => null } })\n",
      },
    ];
    const files = [...base, { path: "modules/a/module.ts", source: "export default {}\n" }, ...routes];
    expect(identityDiags(files).map((d) => d.code)).toContain("E1579");
    expect(identityDiags([{ path: "identity.ts", source: "" }], undefined, true).map((d) => d.code)).toEqual(["E1580"]);
  });
});
