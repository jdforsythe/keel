import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

it("a changed node_modules file (new mtime) invalidates the cached type check", () => {
  const root = mkdtempSync(join(tmpdir(), "keel-check-root-"));
  try {
    const dep = join(root, "node_modules", "dep");
    mkdirSync(dep, { recursive: true });
    writeFileSync(join(dep, "package.json"), '{ "name": "dep", "types": "index.d.ts" }');
    const write = (type: string, mtime: number): void => {
      writeFileSync(join(dep, "index.d.ts"), `export declare const x: ${type};\n`);
      utimesSync(join(dep, "index.d.ts"), mtime, mtime);
    };
    const files = [{ path: "a.ts", source: 'import { x } from "dep";\nexport const a: string = x;\n' }];
    const codes = (): string[] => check(files, { root }).diagnostics.map((d) => d.code);
    write("number", 1_000_000);
    expect(codes()).toEqual(["E1751"]);
    expect(codes()).toEqual(["E1751"]);
    write("string", 2_000_000);
    expect(codes()).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
