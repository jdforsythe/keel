// Spec: k.origins, Conformance "With no `origins`, and with `origins: {}`, a fixture's production and dev documents, `csp.txt` and shell policies are byte-equal to k.security's."
// Spec: k.origins, Declaration "No `origins`, `origins: {}` and an empty directive are the same declaration: none."
// Seed 1337 (no generated input: one fixture, spawned builds). This file: `csp.txt` and the Tauri `tauri.conf.json`. Documents: packages/server/conformance/origins-none-byte-equal.test.ts.
// The Capacitor meta policy is in origins-shells.test.ts. "byte-equal to k.security's" is read as equal to the build with no `origins`, whose directives are k.security's `client` policy.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { SLOW, build, cspTxt, directivesOf, tauriConf, tree } from "./origins-support.ts";

const TAURI = "shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }";
const topo = (origins: string): string =>
  `{ a: { modules: ['a'], adapter: 'node' }, w: { modules: ['c'], adapter: 'client', ${TAURI}${origins} } }`;
const VARIANTS: Record<string, string> = {
  none: "",
  empty: ", origins: {}",
  "empty directives": ", origins: { img: {}, media: {}, font: {}, connect: {}, frame: {} }",
};
const dirs: Record<string, string> = {};

beforeAll(() => {
  for (const [name, origins] of Object.entries(VARIANTS)) {
    dirs[name] = materialize(tree(topo(origins), { "@keel/std-tauri": "workspace:*" }));
    expect(build(dirs[name] ?? "")).toBe(0);
  }
}, SLOW);
afterAll(() => {
  for (const d of Object.values(dirs)) cleanup(d);
});

describe("k.origins: no declaration leaves csp.txt and the shell policy as k.security's", () => {
  test("with no `origins`, `csp.txt` is the k.security `client` policy and has no `media-src` or `frame-src`", () => {
    const ds = directivesOf(cspTxt(dirs["none"] ?? "", "w"));
    for (const d of [
      "default-src 'none'",
      "script-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
    ])
      expect(ds).toContain(d);
    expect(ds.some((d) => d.startsWith("media-src") || d.startsWith("frame-src"))).toBe(false);
  });

  test("with `origins: {}`, and with empty directives, `csp.txt` is byte-equal to the build with no `origins`", () => {
    const plain = cspTxt(dirs["none"] ?? "", "w");
    expect(cspTxt(dirs["empty"] ?? "", "w")).toBe(plain);
    expect(cspTxt(dirs["empty directives"] ?? "", "w")).toBe(plain);
  });

  test("with `origins: {}`, and with empty directives, `tauri.conf.json` is byte-equal to the build with no `origins`", () => {
    const plain = tauriConf(dirs["none"] ?? "", "w");
    expect(tauriConf(dirs["empty"] ?? "", "w")).toBe(plain);
    expect(tauriConf(dirs["empty directives"] ?? "", "w")).toBe(plain);
  });
});
