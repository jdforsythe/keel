// Spec: k.shell, clause "The `www` entry's drivers call carries `connect: []` with no `origins`; with `origins.connect` declaring `https://api.example` and `KEEL_PEER_API=https://peer.example`, `connect: [\"https://peer.example\", \"https://api.example\"]`, which `build` is given as `connect` too; a declared origin equal to `KEEL_ORIGIN` is left out."
// Seed: 1337 (the declared origins are generated; the project is fixed).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`): the stub's `build` records the `connect` it is given in `build-calls.txt`.
// ASSUMPTIONS: the `www` bundle is minified, so the drivers call is read as the `connect:[...]` array literal next to the origin strings in `www/assets/*.js`;
// a peer deployable `api` (`node`) gives `KEEL_PEER_API`; `origins.connect` is `{ '<origin>': '<reason>' }` as in k.origins.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, buildCalls, cleanup, run, setStub, stubProject } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

const topo = (origins: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }${origins === "" ? "" : `, origins: ${origins}`} },\n  api: { modules: [], adapter: 'node' },\n})\n`;
const declared = (hosts: readonly string[]): string =>
  `{ connect: { ${hosts.map((h) => `'https://${h}.example': 'r'`).join(", ")} } }`;

/** All JavaScript the shell build wrote under `www/`. */
const bundle = (): string => {
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const name of readdirSync(at, { withFileTypes: true })) {
      const p = join(at, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.name.endsWith(".js")) out.push(readFileSync(p, "utf8"));
    }
  };
  const www = join(dir, "dist", "web", "tauri", "www");
  if (existsSync(www)) walk(www);
  return out.join("\n");
};
const connectLiteral = (js: string): readonly string[] | undefined => {
  const m = /connect:\s*\[([^\]]*)\]/.exec(js);
  if (m === null) return undefined;
  return [...(m[1] ?? "").matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1] ?? "");
};
const buildConnect = (): unknown => buildCalls(dir).at(-1)?.connect;
const build = (extra: Record<string, string> = {}, origin?: string) => {
  setStub(dir, {});
  return run(dir, ["build", "--target", "tauri"], origin ?? "https://app.example", "json", extra);
};

/**
 * What the property case bounds: five `keel build --target tauri` runs over the stub, about 2.5 s a build here alone
 * and up to 6 s beside the suite's other builds. The bound is 120 s a build, so a runner ten times slower (scale 0.1)
 * still has 12 s a build, twice the loaded time.
 */
const PROPERTY_BOUND = 5 * 120_000;

describe("k.shell: the drivers' connect list", () => {
  test(
    "the `www` entry's drivers call carries `connect: []` with no `origins`, and `build` is given `connect` as `[]`",
    () => {
      writeFileSync(join(dir, "topology.ts"), topo(""));
      expect(build().status).toBe(0);
      expect(connectLiteral(bundle())).toEqual([]);
      expect(buildConnect()).toEqual([]);
    },
    SLOW,
  );

  test(
    "with `origins.connect` declaring `https://api.example` and `KEEL_PEER_API=https://peer.example`, `connect` is the peer origin then the declared one, in the drivers call and given to `build`",
    () => {
      writeFileSync(join(dir, "topology.ts"), topo(declared(["api"])));
      expect(build({ KEEL_PEER_API: "https://peer.example" }).status).toBe(0);
      expect(connectLiteral(bundle())).toEqual(["https://peer.example", "https://api.example"]);
      expect(buildConnect()).toEqual(["https://peer.example", "https://api.example"]);
    },
    SLOW,
  );

  test(
    "a declared origin equal to `KEEL_ORIGIN` is left out, and each origin appears once",
    () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), { minLength: 1, maxLength: 3 }),
          fc.constantFrom("a", "b", "c", "d"),
          (hosts, self) => {
            writeFileSync(join(dir, "topology.ts"), topo(declared(hosts)));
            expect(build({}, `https://${self}.example`).status).toBe(0);
            const want = hosts.filter((h) => h !== self).map((h) => `https://${h}.example`);
            expect(buildConnect()).toEqual(want);
            expect(connectLiteral(bundle())).toEqual(want);
          },
        ),
        { seed: SEED, numRuns: 5 },
      );
    },
    PROPERTY_BOUND,
  );
});
