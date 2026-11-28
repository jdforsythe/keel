// The browser-build helpers of the Vite plugin (k.boundary, k.bundle): stubs, handler bindings, miscased specifiers,
// `new URL` literals and the E1007 graph walk. Seed 1337.
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { browserBreach } from "../src/internal/browserBreach.ts";
import { exportNames } from "../src/internal/exportNames.ts";
import { miscasedImports } from "../src/internal/miscasedImports.ts";
import { projectHandlerUses } from "../src/internal/projectHandlerUses.ts";
import { stubCode } from "../src/internal/stubCode.ts";
import { urlLiterals } from "../src/internal/urlLiterals.ts";

describe("exportNames", () => {
  it("lists value exports, follows export * and drops types", () => {
    const dir = tempDir("keel-exports-");
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

describe("projectHandlerUses", () => {
  /** The router's specifier, quoted, for the fixtures' dynamic `import()`. */
  const ROUTER = JSON.stringify(["@keel", "router"].join("/"));
  const uses = (files: Record<string, string>): Record<string, string[][]> => {
    const parsed = Object.entries(files).map(([p, code]) => ({ path: p, program: parseSync(p, code).program }));
    const out: Record<string, string[][]> = {};
    for (const [p, list] of projectHandlerUses(parsed)) out[p] = list.map((u) => [...u.kinds].sort());
    return out;
  };

  it("finds a handler by binding: any local name, a namespace member, a call or a value read", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("loader", "action", "guard"),
        fc.constantFrom("named", "alias", "namespace", "bracket", "dynamic"),
        fc.boolean(),
        (ctor, how, called) => {
          const head =
            how === "named"
              ? `import { ${ctor} } from "@keel/router"\n`
              : how === "alias"
                ? `import { ${ctor} as make } from "@keel/router"\n`
                : how === "dynamic"
                  ? ""
                  : `import * as R from "@keel/router"\n`;
          const ref =
            how === "named"
              ? ctor
              : how === "alias"
                ? "make"
                : how === "namespace"
                  ? `R.${ctor}`
                  : how === "bracket"
                    ? `R["${ctor}"]`
                    : `(await import(${ROUTER})).${ctor}`;
          const code = `${head}export const x = ${called ? `${ref}({})` : ref}\n`;
          expect(uses({ "a.ts": code })["a.ts"]).toEqual([[ctor]]);
        },
      ),
      { seed: 1337, numRuns: 60 },
    );
  });

  it("follows re-exports through project files and counts a namespace read as all three", () => {
    const got = uses({
      "lib/r.ts": 'export { loader } from "@keel/router"\n',
      "lib/all.ts": 'export * from "./r.ts"\n',
      "a.ts": 'import { loader as l } from "./lib/all.ts"\nexport const p = l({})\n',
      "b.ts": 'import * as R from "@keel/router"\nexport const n = Object.keys(R)\n',
    });
    expect(got["lib/r.ts"]).toEqual([["loader"]]);
    expect(got["lib/all.ts"]).toEqual([["loader"]]);
    expect(got["a.ts"]).toEqual([["loader"]]);
    expect(got["b.ts"]).toEqual([["action", "guard", "loader"]]);
  });

  it("finds none in a type position, a type-only import, another package or a file's own function", () => {
    const got = uses({
      "a.ts": 'import type { loader } from "@keel/router"\nexport type L = typeof loader\n',
      "b.ts": 'import { loader } from "./mine.ts"\nexport const x = loader()\n',
      "c.ts": "const loader = () => 1\nexport const y = loader()\n",
      "d.ts": 'import * as R from "@keel/router"\nexport const m = R.manifest\n',
    });
    expect(Object.values(got).flat()).toEqual([]);
  });
});

describe("miscasedImports", () => {
  it("is one hit exactly when a relative specifier differs from a project file's name in case", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 13, maxLength: 13 }), (mask) => {
        const disk = "notes.server.ts";
        const spelled = [...disk].map((c, i) => (mask[i] === true ? c.toUpperCase() : c)).join("");
        const files = [
          { path: `lib/${disk}`, program: parseSync("n.ts", "export const n = 1\n").program },
          { path: "lib/a.ts", program: parseSync("a.ts", `import { n } from './${spelled}'\n`).program },
        ];
        expect(miscasedImports(files).map((m) => m.disk)).toEqual(spelled === disk ? [] : [`lib/${disk}`]);
      }),
      { seed: 1337, numRuns: 60 },
    );
  });
});

describe("urlLiterals", () => {
  it("lists `new URL(<literal>, import.meta.url)` only", () => {
    const code =
      "new URL('./w.ts', import.meta.url)\nnew URL(`./t.ts`, import.meta.url)\nnew URL(x, import.meta.url)\nnew URL('./n.ts', base)\n";
    expect(urlLiterals(parseSync("a.ts", code).program).map((u) => u.source)).toEqual(["./w.ts", "./t.ts"]);
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
