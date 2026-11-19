// Inspector hooks under `keel dev` (k.cli Inspector hooks, k.topology Local topology): a module that registers a
// section at its top level and is evaluated again replaces that section, while two registrations of one id within
// one load still throw E1057.
import fs from "node:fs";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspector } from "../src/inspect/inspector.ts";
import { inspectorSections } from "../src/inspect/inspectorSections.ts";
import { inspectors } from "../src/inspect/inspectors.ts";
import { inspectorsReload } from "../src/inspect/inspectorsReload.ts";
import { devEntryCode } from "../src/internal/devEntryCode.ts";

const Count = s.object({ n: s.int({ min: 0 }) });
const ctx = createCtx({ mode: "sim", seed: 1 });
const values = (): unknown => inspectorSections(ctx).sections;

let root = "";
beforeEach(() => {
  inspectors.clear();
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-inspector-reload-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("inspectorsReload", () => {
  it("a section registered again after a reload replaces the carried one, in its place", () => {
    inspector({ id: "a.first", schema: Count, read: () => ({ n: 1 }) });
    inspector({ id: "a.second", schema: Count, read: () => ({ n: 2 }) });
    inspectorsReload();
    inspector({ id: "a.first", schema: Count, read: () => ({ n: 10 }) });
    expect(values()).toEqual({
      "a.first": { doc: Count.doc(), value: { n: 10 } },
      "a.second": { doc: Count.doc(), value: { n: 2 } },
    });
    expect([...inspectors.keys()]).toEqual(["a.first", "a.second"]);
  });

  it("two registrations of one id within one load throw E1057, before a reload and after it", () => {
    const def = { id: "a.twice", schema: Count, read: () => ({ n: 1 }) };
    inspector(def);
    expect(() => inspector(def)).toThrow("E1057 inspector section a.twice registered twice");
    inspectorsReload();
    inspector(def);
    expect(() => inspector(def)).toThrow("E1057 inspector section a.twice registered twice");
    inspectorsReload();
    inspectorsReload();
    inspector(def);
    expect(() => inspector(def)).toThrow("E1057 inspector section a.twice registered twice");
  });

  it("a module evaluated again after a reload registers its top-level section again", async () => {
    const file = path.join(root, "tally.server.ts");
    const source = (n: number): string =>
      [
        `import { s } from "@keel/schema";`,
        `import { inspector } from ${JSON.stringify(path.resolve(import.meta.dirname, "../src/inspect/inspector.ts"))};`,
        `inspector({ id: "kitchen.box", schema: s.object({ n: s.int() }), read: () => ({ n: ${n} }) });`,
        "",
      ].join("\n");
    fs.writeFileSync(file, source(1));
    await import(/* @vite-ignore */ `${file}?load=1`);
    expect(values()).toMatchObject({ "kitchen.box": { value: { n: 1 } } });
    fs.writeFileSync(file, source(2));
    await expect(import(/* @vite-ignore */ `${file}?load=2`)).rejects.toThrow("E1057");
    inspectorsReload();
    await import(/* @vite-ignore */ `${file}?load=3`);
    expect(values()).toMatchObject({ "kitchen.box": { value: { n: 2 } } });
  });
});

describe("devEntryCode", () => {
  it("marks the registered sections as carried before it loads any module of the app", () => {
    fs.mkdirSync(path.join(root, "modules/a"), { recursive: true });
    fs.writeFileSync(path.join(root, "modules/a/routes.ts"), "export const routes = { routes: {} };\n");
    fs.writeFileSync(path.join(root, "identity.server.ts"), "export default {};\n");
    const code = devEntryCode(root, { api: { modules: ["a"], adapter: "node" } });
    const reload = code.indexOf("\ninspectorsReload();\n");
    expect(code).toContain('import { inspectorsReload } from "@keel/compiler/inspect/inspectorsReload";');
    expect(reload).toBeGreaterThan(-1);
    for (const loaded of ["topology.ts", "identity.server.ts", "modules/a/routes.ts"])
      expect(code.indexOf(loaded)).toBeGreaterThan(reload);
  });
});
