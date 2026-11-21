// Spec: k.origins, Conformance "A Tauri shell of a deployable declaring `connect` has `connect-src 'self' <origins> ipc: http://ipc.localhost`; `csp.txt`, a Capacitor meta policy's source before any tool runs, holds a declared `frame-src`."
// Spec: k.origins, Policy "Tauri's `tauri.conf.json` (`ipc: http://ipc.localhost` last in `connect-src`), Capacitor's meta policy (`csp.txt` less what a meta tag ignores)."
// Seed 1337 (no generated input: spawned builds).
// ASSUMPTION: `keel build` writes `deploy/w/tauri/tauri.conf.json` with `app.security.csp` as one string (k.shell, as scaffold's tauri-conf test reads it).
// The Capacitor case reads `dist/w/csp.txt` after a plain `keel build`: no JDK, Android SDK or platform build runs.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { SLOW, build, cspTxt, directivesOf, tauriPolicy, tree } from "./origins-support.ts";

const topo = (shell: string, origins: string): string =>
  `{ a: { modules: ['a'], adapter: 'node' }, w: { modules: ['c'], adapter: 'client', shells: { ${shell}: { id: 'dev.keel.golden', name: 'Golden' } }, origins: ${origins} } }`;
let tauri = "";
let capacitor = "";
beforeAll(() => {
  tauri = materialize(
    tree(topo("tauri", "{ connect: { 'https://c.example': 'r', 'https://d.example': 'r' } }"), {
      "@keel/std-tauri": "workspace:*",
    }),
  );
  capacitor = materialize(
    tree(topo("capacitor", "{ frame: { 'https://v.example': 'r' } }"), { "@keel/std-capacitor": "workspace:*" }),
  );
}, SLOW);
afterAll(() => {
  cleanup(tauri);
  cleanup(capacitor);
});

describe("k.origins: shells", () => {
  test(
    "A Tauri shell of a deployable declaring `connect` has `connect-src 'self' <origins> ipc: http://ipc.localhost`",
    () => {
      expect(build(tauri, { KEEL_PEER_A: "https://api.test" })).toBe(0);
      const ds = directivesOf(tauriPolicy(tauri, "w"));
      expect(ds).toContain("connect-src 'self' https://c.example https://d.example ipc: http://ipc.localhost");
    },
    SLOW,
  );

  test(
    "a Tauri shell's policy has no `keel-peer` origin and no other change from the `client` policy",
    () => {
      const ds = directivesOf(tauriPolicy(tauri, "w"));
      expect(ds.join(";")).not.toContain("api.test");
      expect(ds.some((d) => d.startsWith("media-src") || d.startsWith("frame-src"))).toBe(false);
      expect(ds).toContain("img-src 'self'");
    },
    SLOW,
  );

  test(
    "`csp.txt`, a Capacitor meta policy's source before any tool runs, holds a declared `frame-src`",
    () => {
      expect(build(capacitor, { KEEL_ORIGIN: "https://golden.example" })).toBe(0);
      expect(directivesOf(cspTxt(capacitor, "w"))).toContain("frame-src https://v.example");
    },
    SLOW,
  );
});
