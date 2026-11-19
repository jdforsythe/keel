// k.check step 1: the only ambient types are Node's; a `/// <reference types>` for another package is a type error.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const ROOT = path.join(import.meta.dirname, "..");
const codes = (source: string): string[] =>
  check([{ path: "src/a.ts", source }], { root: ROOT })
    .diagnostics.filter((d) => d.code === "E1751")
    .map((d) => d.message);

describe("type reference directives", () => {
  it("reports one for vite/client even when the package resolves from the project", () => {
    expect(codes('/// <reference types="vite/client" />\nexport const m: string = import.meta.env.MODE\n')).toEqual([
      expect.stringContaining("TS2688"),
      expect.stringContaining("TS2339"),
    ]);
  });

  it("keeps Node's", () => {
    expect(codes('/// <reference types="node" />\nexport const p: string = process.cwd()\n')).toEqual([]);
  });
});
