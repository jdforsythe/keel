// Spec: k.shell, clause "With `web` alone declaring `origins.connect` `https://api.example`, the drivers call is `{ connect: [\"https://api.example\"] }`, which `build` is given as `connect`."
// k.shell, Without a server "`connect` is then the declared `origins.connect` origins alone, as no `keel-peer` origin exists."
// Seed: 1337 (the declared origins are generated; the project is fixed).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`), a topology of `web` alone and no `KEEL_ORIGIN`. `origins.connect` is `{ '<origin>': '<reason>' }` as in k.origins.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  SEED,
  SLOW,
  UNSET,
  buildCalls,
  cleanup,
  driversArg,
  run,
  setStub,
  stubProject,
  wwwText,
} from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject({}, false);
}, SLOW);
afterAll(() => cleanup(dir));

const topo = (hosts: readonly string[]): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' } }, origins: { connect: { ${hosts.map((h) => `'https://${h}.example': 'r'`).join(", ")} } } },\n})\n`;

describe("k.shell: connect with no node deployable", () => {
  test(
    'with `web` alone declaring `origins.connect` `https://api.example`, the drivers call is `{ connect: ["https://api.example"] }`, which `build` is given as `connect`',
    () => {
      writeFileSync(join(dir, "topology.ts"), topo(["api"]));
      setStub(dir, {});
      const r = run(dir, ["build", "--target", "tauri"], UNSET, "json");
      expect(r.status, r.out).toBe(0);
      expect(driversArg(wwwText(dir))).toBe('{connect:["https://api.example"]}');
      expect(buildCalls(dir).at(-1)?.connect).toEqual(["https://api.example"]);
    },
    SLOW,
  );

  test(
    "with `web` alone, `connect` is the declared origins alone, once each in order, whatever `KEEL_PEER_API` holds",
    () => {
      fc.assert(
        fc.property(fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), { minLength: 1, maxLength: 3 }), (hosts) => {
          writeFileSync(join(dir, "topology.ts"), topo(hosts));
          setStub(dir, {});
          const r = run(dir, ["build", "--target", "tauri"], UNSET, "json", { KEEL_PEER_API: "https://peer.example" });
          expect(r.status, r.out).toBe(0);
          const want = hosts.map((h) => `https://${h}.example`);
          expect(buildCalls(dir).at(-1)?.connect).toEqual(want);
          expect(driversArg(wwwText(dir))).toBe(`{connect:${JSON.stringify(want)}}`);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    SLOW,
  );
});
