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
    const routes = {
      path: "modules/a/routes.ts",
      source:
        "import { manifest } from '@keel/router'\nexport const routes = manifest({ 'a.x': { path: '/api/auth/x', component: () => null } })\n",
    };
    const files = [...base, { path: "modules/a/module.ts", source: "export default {}\n" }, routes];
    expect(identityDiags(files).map((d) => d.code)).toContain("E1579");
    expect(identityDiags([{ path: "identity.ts", source: "" }], undefined, true).map((d) => d.code)).toEqual(["E1580"]);
  });
});
