// The browser-build helpers of the Vite plugin (k.boundary): stubs, handler calls and the E1007 graph walk.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { browserBreach } from "../src/internal/browserBreach.ts";
import { callsHandler } from "../src/internal/callsHandler.ts";
import { exportNames } from "../src/internal/exportNames.ts";
import { stubCode } from "../src/internal/stubCode.ts";

describe("exportNames", () => {
  it("lists value exports, follows export * and drops types", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-exports-"));
    try {
      fs.writeFileSync(path.join(dir, "y.ts"), "export const y = 1\nexport default 2\nexport type Y = 1\n");
      fs.writeFileSync(
        path.join(dir, "x.server.ts"),
        "export const { a, b: [c] } = q\nexport function f() {}\nexport class K {}\nexport enum E { A }\nexport type T = 1\nexport interface I {}\nexport { a as 'odd name', type T as U }\nexport * from './y'\nexport * as ns from './y.ts'\nexport default 1\n",
      );
      expect(exportNames(path.join(dir, "x.server.ts")).sort()).toEqual(
        ["E", "K", "a", "c", "default", "f", "ns", "odd name", "y"].sort(),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("stubCode", () => {
  it("imports only the router and exports one stub per name", () => {
    const code = stubCode("modules/a/x.server.ts", ["load", "default", "odd name"], "/r/internal.ts");
    expect(code.match(/import /g)).toHaveLength(1);
    expect(code).toContain("export { k1 as default };");
    expect(code).toContain('export { k2 as "odd name" };');
  });
});

describe("callsHandler", () => {
  it("is true exactly when a constructor imported from @keel/router is called", () => {
    fc.assert(
      fc.property(fc.constantFrom("loader", "action", "guard"), fc.boolean(), fc.boolean(), (ctor, alias, called) => {
        const local = alias ? "make" : ctor;
        const code = `import { ${alias ? `${ctor} as make` : ctor} } from "@keel/router"\nexport const x = ${called ? `${local}({})` : local}\n`;
        expect(callsHandler(code)).toBe(called);
      }),
      { seed: 1337, numRuns: 30 },
    );
    expect(callsHandler("import type { loader } from '@keel/router'\nloader()")).toBe(false);
    expect(callsHandler("import { loader } from './mine'\nloader()")).toBe(false);
  });
});

describe("browserBreach", () => {
  const graph: Record<string, { isEntry: boolean; importedIds: string[]; dynamicallyImportedIds: string[] }> = {
    e: { isEntry: true, importedIds: ["a", "stub"], dynamicallyImportedIds: ["d"] },
    a: { isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
    stub: { isEntry: false, importedIds: ["hidden"], dynamicallyImportedIds: [] },
    hidden: { isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
    d: { isEntry: false, importedIds: ["bad"], dynamicallyImportedIds: [] },
    bad: { isEntry: false, importedIds: [], dynamicallyImportedIds: [] },
  };
  const info = (id: string) => graph[id] ?? null;
  it("names the chain through dynamic imports and does not enter a stub", () => {
    const why = (id: string) => (id === "bad" || id === "hidden" ? "server-only file" : undefined);
    expect(
      browserBreach(
        Object.keys(graph),
        info,
        why,
        (id) => id.toUpperCase(),
        (id) => id === "stub",
      ),
    ).toBe("server code in browser build: server-only file: E -> D -> BAD");
    expect(
      browserBreach(
        Object.keys(graph),
        info,
        () => undefined,
        (id) => id,
        () => false,
      ),
    ).toBeUndefined();
  });
});
