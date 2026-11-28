// Spec: k.shell, clause "`shells` on a `node` deployable is one E1573; `id: 'golden'` is one E1573."
// k.shell, Rules "E1573 `shells` on a deployable that is not `client`, or an `id` that is not reverse-DNS"
// Seed: 1337.
// ASSUMPTION: `check` reads `topology.ts` from the file list, as the other topology rules do (E1509); `package.json` lists the shell packages so E1572 does not enter.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Files, SEED } from "./support.ts";

const MANIFEST = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const PACKAGE = `${JSON.stringify({
  name: "fx",
  private: true,
  version: "1.0.0",
  dependencies: {
    "@keel/std-tauri": "workspace:*",
    "@keel/std-capacitor": "workspace:*",
    "@keel/std-db": "workspace:*",
  },
})}\n`;

const project = (adapter: "node" | "static" | "client", shells: string): Files => [
  { path: "package.json", source: PACKAGE },
  {
    path: "topology.ts",
    source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app'], adapter: '${adapter}', shells: ${shells} } })\n`,
  },
  { path: "modules/app/module.ts", source: MANIFEST("app") },
];
const e1573 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1573");

const tauri = (id: string): string => `{ tauri: { id: '${id}', name: 'Golden' } }`;
const capacitor = (id: string): string => `{ capacitor: { id: '${id}', name: 'Golden' } }`;

const label = fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/);
const reverseDns = fc
  .tuple(label, label, fc.array(label, { maxLength: 2 }))
  .map(([a, b, rest]) => [a, b, ...rest].join("."));
const notReverseDns = fc.oneof(
  label, // one segment
  fc.constantFrom("golden", "dev..golden", ".dev.golden", "dev.golden.", "dev keel.golden", ""),
);

describe("k.shell: E1573", () => {
  test("`shells` on a `node` deployable is one E1573; `id: 'golden'` is one E1573.", () => {
    expect(e1573(project("node", tauri("dev.keel.golden")))).toHaveLength(1);
    expect(e1573(project("client", tauri("golden")))).toHaveLength(1);
    expect(e1573(project("client", tauri("dev.keel.golden")))).toEqual([]);
  });

  test("E1573 `shells` on a deployable that is not `client`, or an `id` that is not reverse-DNS", () => {
    fc.assert(
      fc.property(fc.constantFrom<"node" | "static">("node", "static"), reverseDns, (adapter, id) => {
        expect(e1573(project(adapter, tauri(id)))).toHaveLength(1);
        expect(e1573(project(adapter, capacitor(id)))).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
    fc.assert(
      fc.property(reverseDns, (id) => {
        expect(e1573(project("client", tauri(id)))).toEqual([]);
        expect(e1573(project("client", capacitor(id)))).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
    fc.assert(
      fc.property(notReverseDns, (id) => {
        expect(e1573(project("client", tauri(id)))).toHaveLength(1);
        expect(e1573(project("client", capacitor(id)))).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
