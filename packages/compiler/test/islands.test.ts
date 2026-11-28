import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENTRY_PATH } from "../src/entry/ENTRY_PATH.ts";
import { ISLANDS_PATH } from "../src/entry/ISLANDS_PATH.ts";
import { RESUME_ENTRY } from "../src/entry/RESUME_ENTRY.ts";
import { resumeEntry } from "../src/entry/resumeEntry.ts";
import { islandsCode } from "../src/internal/islandsCode.ts";

// RFC 0046: the resume entry of a server-rendered deployable and its island component map.
const ROUTES = `import { manifest } from "@keel/router";
import Shell from "./Shell.tsx";
import { Page as P, Other } from "../shared/pages.tsx";
import type { T } from "./T.ts";
import { type U } from "./U.ts";
import { loadIt } from "./load.server.ts";
import Ext from "pkg/ext";
const Inline = () => null;
export const routes = manifest(c, {
  "m.shell": { component: Shell },
  "m.page": { component: (P), loader: loadIt, layout: "m.shell" },
  "m.other": { component: Other as never },
  "m.ext": { component: Ext },
  "m.inline": { component: Inline },
  "m.arrow": { component: () => null },
  "m.none": {},
  ["m.computed"]: { component: Shell },
  m_ident: { component: U },
});
`;

describe("islandsCode", () => {
  it("maps each literal route id to its imported component, root-relative and sorted", () => {
    const code = islandsCode([{ path: "modules/m/routes.ts", source: ROUTES }]);
    expect(code).toBe(
      [
        'import __keelIsland0 from "pkg/ext";',
        'import { Other as __keelIsland1 } from "/modules/shared/pages.tsx";',
        'import { Page as __keelIsland2 } from "/modules/shared/pages.tsx";',
        'import __keelIsland3 from "/modules/m/Shell.tsx";',
        'export const components = { "m.ext": __keelIsland0, "m.other": __keelIsland1, "m.page": __keelIsland2, "m.shell": __keelIsland3 };',
        "",
      ].join("\n"),
    );
    expect(parseSync("islands.js", code, { sourceType: "module" }).errors).toEqual([]);
  });

  it("reads `export default manifest(c, ...)` and `const` bindings; skips files that do not parse", () => {
    const a = `import A from "./A.tsx";\nexport default manifest(c, { "a.x": { component: A } });\n`;
    const b = `import B from "./B.tsx";\nconst routes = manifest(c, { "b.x": { component: B } }) satisfies object;\n`;
    const broken = `import C from "./C.tsx";\nexport const routes = manifest(c, { "c.x": { component: C } `;
    const code = islandsCode([
      { path: "modules/a/routes.ts", source: a },
      { path: "modules/b/routes.ts", source: b },
      { path: "modules/c/routes.ts", source: broken },
    ]);
    expect(code).toContain('import __keelIsland0 from "/modules/a/A.tsx";');
    expect(code).toContain('import __keelIsland1 from "/modules/b/B.tsx";');
    expect(code).not.toContain("C.tsx");
    expect(code).toContain('export const components = { "a.x": __keelIsland0, "b.x": __keelIsland1 };');
  });

  it("quotes a string-named import and ignores calls other than manifest", () => {
    const src = `import { "odd-name" as Odd } from "./o.tsx";\nexport const routes = manifest(c, { "o.x": { component: Odd } });\nexport const other = make({ "z.x": { component: Odd } });\n`;
    const code = islandsCode([{ path: "modules/o/routes.ts", source: src }]);
    expect(code).toContain('import { "odd-name" as __keelIsland0 } from "/modules/o/o.tsx";');
    expect(code).not.toContain("z.x");
  });

  it("no routes files: an empty map", () => {
    expect(islandsCode([])).toBe("export const components = {  };\n");
  });

  it("property: every route with an imported component appears once, under its id, and the module parses", () => {
    const id = fc.stringMatching(/^[a-z]{1,6}\.[a-z]{1,6}$/);
    fc.assert(
      fc.property(fc.uniqueArray(id, { minLength: 1, maxLength: 6 }), (ids) => {
        const imports = ids.map((r, i) => `import C${i} from "./C${i}.tsx";`).join("\n");
        const body = ids.map((r, i) => `${JSON.stringify(r)}: { component: C${i} }`).join(", ");
        const code = islandsCode([
          { path: "modules/g/routes.ts", source: `${imports}\nexport const routes = manifest(c, { ${body} });\n` },
        ]);
        expect(parseSync("islands.js", code, { sourceType: "module" }).errors).toEqual([]);
        for (const [i, r] of ids.entries()) {
          expect(code.split(`${JSON.stringify(r)}: `)).toHaveLength(2);
          expect(code).toContain(`"/modules/g/C${i}.tsx"`);
        }
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});

describe("vite plugin: resume entry (RFC 0046)", () => {
  let root = "";
  const write = (rel: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  const saved = process.env.KEEL_DEPLOYABLE;
  beforeEach(() => {
    root = tempDir(".tmp-islands-", import.meta.dirname);
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
  });
  afterEach(() => {
    if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    else process.env.KEEL_DEPLOYABLE = saved;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("a node deployable gets the resume entry and the islands of its own modules", async () => {
    write(
      "topology.ts",
      `export default { api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client" } };\n`,
    );
    write(
      "modules/a/routes.ts",
      `import Page from "./Page.tsx";\nexport const routes = manifest(c, { "a.page": { component: Page } });\n`,
    );
    write(
      "modules/w/routes.ts",
      `import W from "./W.tsx";\nexport const routes = manifest(c, { "w.page": { component: W } });\n`,
    );
    process.env.KEEL_DEPLOYABLE = "api";
    const p = keel();
    p.configResolved({ root, command: "serve" });
    expect(p.resolveId(ENTRY_PATH)).toBe(ENTRY_PATH);
    expect(p.resolveId(ISLANDS_PATH)).toBe(ISLANDS_PATH);
    expect(await p.load(ENTRY_PATH)).toBe(resumeEntry(undefined, "dev", "virtual:keel.css"));
    expect(await p.load(ISLANDS_PATH)).toBe(
      'import __keelIsland0 from "/modules/a/Page.tsx";\nexport const components = { "a.page": __keelIsland0 };\n',
    );
  });

  it("the resume entry imports the islands map and calls resume with a real ctx and the stores", () => {
    expect(RESUME_ENTRY).toContain(`import { components } from "${ISLANDS_PATH}";`);
    expect(RESUME_ENTRY).toContain('import { resume } from "@keel/runtime-dom/ops";');
    expect(RESUME_ENTRY).toContain('const ctx = createCtx({ mode: "real" });');
    expect(RESUME_ENTRY).toContain('const mode = "production";');
    expect(resumeEntry(undefined, "dev", "virtual:keel.css")).toContain('const mode = "dev";');
    expect(RESUME_ENTRY).not.toContain("import.meta.env");
    expect(RESUME_ENTRY).toContain(
      "  warnings = resume(document.body, components, { ctx, stores: Object.fromEntries(stores()), mode }).warnings;",
    );
    expect(parseSync("entry.js", RESUME_ENTRY, { sourceType: "module" }).errors).toEqual([]);
  });
});
