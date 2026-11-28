// k.realm One copy: a census module inlined in a bundle names its file by a path, never a folder of the build machine.
// Seed 1337 (no generated input).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { censusSource } from "../src/internal/censusSource.ts";

const project = path.join(path.sep, "build", "machine", "app");
const file = path.join(path.sep, "build", "machine", "packages", "schema", "src", "internal", "records.ts");
const code = 'const first = census("@keel/schema", import.meta.url);';

describe("censusSource", () => {
  it("a browser bundle: the path from the project", () => {
    expect(censusSource(file, code, { project })).toBe(
      'const first = census("@keel/schema", "../packages/schema/src/internal/records.ts");',
    );
  });

  it("a server bundle: the path from its folder, resolved against the bundle's URL when it runs", () => {
    const out = censusSource(file, code, { bundle: path.join(project, "dist", "api") });
    expect(out).toBe(
      'const first = census("@keel/schema", new URL("../../../packages/schema/src/internal/records.ts", import.meta.url).href);',
    );
    expect(out).not.toContain("/build/machine");
    const at = pathToFileURL(path.join(project, "dist", "api", "server.mjs")).href;
    expect(new URL("../../../packages/schema/src/internal/records.ts", at).href).toBe(pathToFileURL(file).href);
  });

  it("evaluated in this process: the file's URL; any other file: undefined", () => {
    expect(censusSource(file, code)).toContain(JSON.stringify(pathToFileURL(file).href));
    expect(censusSource(path.join(project, "src", "a.ts"), code, { project })).toBeUndefined();
  });
});
