// The dev entry of one `node` deployable (k.server Build): `/@keel/entry.ts?d=<name>` is the resume entry over
// `/@keel/islands.ts?d=<name>`, the islands of that deployable's modules, beside a `client` deployable whose mount
// entry keeps `/@keel/entry.ts`. Seed 1337.
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENTRY_PATH } from "../src/entry/ENTRY_PATH.ts";
import { ISLANDS_PATH } from "../src/entry/ISLANDS_PATH.ts";
import { RESUME_ENTRY } from "../src/entry/RESUME_ENTRY.ts";
import { resumeEntry } from "../src/entry/resumeEntry.ts";

describe("resumeEntry", () => {
  it("without a deployable is RESUME_ENTRY; with one it imports that deployable's islands and parses", () => {
    expect(resumeEntry()).toBe(RESUME_ENTRY);
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (name) => {
        const code = resumeEntry(name);
        expect(code).toContain(
          `import { components } from ${JSON.stringify(`${ISLANDS_PATH}?d=${encodeURIComponent(name)}`)};`,
        );
        expect(code).toContain("resume(document.body, components,");
        expect(parseSync("entry.js", code, { sourceType: "module" }).errors).toEqual([]);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});

describe("keyed dev entries in the Vite plugin", () => {
  let root = "";
  const write = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  const saved = process.env.KEEL_DEPLOYABLE;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-dev-entry-"));
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
  });
  afterEach(() => {
    if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    else process.env.KEEL_DEPLOYABLE = saved;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("serves each node deployable's resume entry and islands by `?d=`, and the client's entry without it", async () => {
    write(
      "topology.ts",
      `export default { api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client" } };\n`,
    );
    write(
      "modules/a/routes.ts",
      `import Page from "./Page.tsx";\nexport const routes = manifest({ "a.page": { path: "/", component: Page } });\n`,
    );
    write(
      "modules/w/routes.ts",
      `import W from "./W.tsx";\nexport const routes = manifest({ "w.page": { path: "/", component: W } });\n`,
    );
    const p = keel();
    p.configResolved({ root });
    const entry = `${ENTRY_PATH}?d=api`;
    const islands = `${ISLANDS_PATH}?d=api`;
    expect(p.resolveId(entry)).toBe(entry);
    expect(p.resolveId(islands)).toBe(islands);
    expect(p.resolveId("/@keel/other.ts?d=api")).toBeNull();
    expect(await p.load(entry)).toBe(resumeEntry("api", "dev"));
    expect(await p.load(islands)).toBe(
      'import __keelIsland0 from "/modules/a/Page.tsx";\nexport const components = { "a.page": __keelIsland0 };\n',
    );
    const mount = await p.load(ENTRY_PATH);
    expect(mount).not.toBe(RESUME_ENTRY);
    expect(String(mount)).toContain("/modules/w/routes.ts");
  });
});
