// Spec: k.mount, Rules "E1589 with `identity.ts`, a `static` deployable, or a `client` one without `servedBy` (shells or not), its key in `topology.ts`: no origin of it answers the router's `/__keel/user` read (k.guards Client); none when a module file it serves is E1581."
// Spec: k.mount, Conformance "With `identity.ts` and `identity.server.ts`, no module file importing `identity.ts`: `{ web: client }`, `{ web: client, shells }` and `{ site: static, api: node }` each give one E1589 at that deployable's key in `keel check` and `keel build`; `{ web: client, servedBy: 'api', api: node }` with or without `shells`, `{ api: node }` and the same topologies without `identity.ts` give none; a file of `web` importing `identity.ts` gives one E1581 and no E1589."
// Spec: k.mount, Messages "E1580: `identity.ts's default export is not identityMount('<literal>') of lowercase / segments` (86 units) or `identity.server.ts gives no handle: { path: <identity.ts default import>.path }` (79). E1589: `<name> (static) serves no router, so with identity.ts its pages never learn the reader` (`site`: 84) or `<name> (client) has no servedBy: no origin of it mounts the identity handle` (`web`: 72). What to do instead is `keel explain`'s. E1589's fix, for a `client` deployable when `topology.ts` has exactly one `node` deployable, adds `servedBy: '<its name>'` to the entry; otherwise none."
// Spec: RFC 0186 D8 and Proposal: the `keel explain E1589` text asserted below is the RFC's, verbatim.
// Seed 1337 (fc.assert below). `keel build` is packages/cli/conformance/mount-e1589-build.test.ts. In-memory project, `check(files, { types: false })`.
// Expected red until E1589 is built.
import { check } from "@keel/check";
import { explain } from "@keel/check/explain";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const IDENTITY = `import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n`;
const SERVER = `import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n`;
const IMPORTS = `import mount from '../../identity.ts'\nexport const signin = mount.href('/sign-in/email')\n`;
const SHELLS = "shells: { tauri: { id: 'dev.keel.mount', name: 'Mount' } }";

/** `topology.ts` with one deployable per line, each key indented two columns. */
const topo = (deployables: readonly string[]): Files[number] =>
  f(
    "topology.ts",
    `import { topology } from '@keel/server'\nexport default topology({\n${deployables.map((d) => `  ${d},`).join("\n")}\n})\n`,
  );
const project = (deployables: readonly string[], opts: { identity?: boolean; importing?: boolean } = {}): Files => [
  topo(deployables),
  f("modules/a/module.ts", MANIFEST("a")),
  f("modules/b/module.ts", MANIFEST("b")),
  ...(opts.identity === false ? [] : [f("identity.ts", IDENTITY), f("identity.server.ts", SERVER)]),
  ...(opts.importing === true ? [f("modules/a/signin.ts", IMPORTS)] : []),
];
const only = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);
const keyAt = (files: Files, key: string): { line: number; col: number } => {
  const lines = (files.find((x) => x.path === "topology.ts")?.source ?? "").split("\n");
  const line = lines.findIndex((l) => l.startsWith(`  ${key}:`));
  return { line: line + 1, col: 3 };
};

const WEB = (extra = ""): string => `web: { modules: ['a'], adapter: 'client'${extra} }`;
const API = "api: { modules: ['b'], adapter: 'node' }";
const clientMsg = (name: string): string =>
  `${name} (client) has no servedBy: no origin of it mounts the identity handle`;
const staticMsg = (name: string): string =>
  `${name} (static) serves no router, so with identity.ts its pages never learn the reader`;

describe("k.mount: E1589 identity.ts beside a deployable no origin of which answers /__keel/user", () => {
  test("`{ web: client }` with `identity.ts` and `identity.server.ts` is one E1589 at `web`'s key in `topology.ts`, with the client message", () => {
    const files = project([WEB()]);
    const d = only(files, "E1589");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: "topology.ts", ...keyAt(files, "web"), message: clientMsg("web") });
  });

  test("`{ web: client, shells }`, a shell build with no `servedBy`, is one E1589 at `web`'s key", () => {
    const files = project([WEB(`, ${SHELLS}`)]);
    const d = only(files, "E1589");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: "topology.ts", ...keyAt(files, "web"), message: clientMsg("web") });
  });

  test("`{ site: static, api: node }` is one E1589 at `site`'s key, with the static message, and none for `api`", () => {
    const files = project(["site: { modules: ['a'], adapter: 'static' }", API]);
    const d = only(files, "E1589");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ path: "topology.ts", ...keyAt(files, "site"), message: staticMsg("site") });
  });

  test("any deployable key of a `client` one without `servedBy` is the key, and the one the message names", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/), (key) => {
        fc.pre(key !== "api" && key !== "shells");
        const files = project([`${key}: { modules: ['a'], adapter: 'client' }`, API]);
        const d = only(files, "E1589");
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({ path: "topology.ts", ...keyAt(files, key), message: clientMsg(key) });
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("two deployables with no answering origin are one E1589 each, at their own keys", () => {
    const files = project([WEB(), "site: { modules: ['b'], adapter: 'static' }"]);
    const d = only(files, "E1589");
    expect(d.map((x) => x.line).sort()).toEqual([keyAt(files, "web").line, keyAt(files, "site").line].sort());
  });

  test("`{ web: client, servedBy: 'api', api: node }`, with or without `shells`, is no E1589", () => {
    expect(only(project([WEB(", servedBy: 'api'"), API]), "E1589")).toEqual([]);
    expect(only(project([WEB(`, servedBy: 'api', ${SHELLS}`), API]), "E1589")).toEqual([]);
  });

  test("`{ api: node }` alone is no E1589", () => {
    expect(only(project([API]), "E1589")).toEqual([]);
  });

  test("the topologies that give E1589 give none in a project with no identity files", () => {
    for (const d of [[WEB()], [WEB(`, ${SHELLS}`)], ["site: { modules: ['a'], adapter: 'static' }", API]]) {
      expect(only(project(d, { identity: false }), "E1589")).toEqual([]);
    }
  });

  test("a file of `web` importing `identity.ts` is one E1581 and no E1589, for a `client` and a `static` deployable", () => {
    for (const adapter of ["client", "static"]) {
      const files = project([`web: { modules: ['a'], adapter: '${adapter}' }`], { importing: true });
      expect(only(files, "E1581"), adapter).toHaveLength(1);
      expect(only(files, "E1589"), adapter).toEqual([]);
    }
  });

  test("a `client` deployable `servedBy` a `node` one whose module imports `identity.ts` is neither E1581 nor E1589", () => {
    const files = project([WEB(", servedBy: 'api'"), API], { importing: true });
    expect(only(files, "E1581")).toEqual([]);
    expect(only(files, "E1589")).toEqual([]);
  });

  test("`keel explain E1589` names the shapes and gives the fix", () => {
    const text = explain("E1589");
    expect(text).toContain(
      "identity.ts beside a static deployable, or a client one without servedBy: no origin of it answers /__keel/user",
    );
    expect(text).toContain("adapter: 'client' -> adapter: 'client', servedBy: 'api'");
  });
});
