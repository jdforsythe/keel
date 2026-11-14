// E1822 edges (k.aria): template-literal import(), paths into the package's aria source, the root anchor of the
// exemption, and `unsafe/` files that re-export the entry.
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";

const n = (path: string, source: string): number =>
  check([{ path, source }], { types: false }).diagnostics.filter((d) => d.code === "E1822").length;

describe("E1822 edges", () => {
  test("a template-literal import() and require() with no substitutions", () => {
    expect(n("modules/a/x.ts", "export const x = () => import(`@keel/ui/aria`)\n")).toBe(1);
    expect(n("modules/a/x.ts", "export const x = require(`@keel/ui/aria`)\n")).toBe(1);
  });

  test("a relative path into the package's aria source, and a deep entry path", () => {
    expect(
      n(
        "modules/a/x.ts",
        "import { Part } from '../../node_modules/@keel/ui/src/aria/Part.ts'\nexport const x = Part\n",
      ),
    ).toBe(1);
    expect(n("modules/a/x.ts", "import { Part } from '@keel/ui/aria/index.ts'\nexport const x = Part\n")).toBe(1);
    expect(n("modules/a/x.ts", "import { Box } from '@keel/ui'\nexport const x = Box\n")).toBe(0);
    expect(n("modules/a/x.ts", "import { x as y } from './aria.ts'\nexport const x = y\n")).toBe(0);
  });

  test("the exemption is the project root's packages/, node_modules/ and .keel/", () => {
    const src = "import { Part } from '@keel/ui/aria'\nexport const x = Part\n";
    expect(n("apps/web/packages/ui/x.ts", src)).toBe(1);
    expect(n("modules/a/node_modules/x.ts", src)).toBe(1);
    expect(n("packages/std-x/src/x.ts", src)).toBe(0);
  });

  test("a file under unsafe/ may import the entry but not re-export it", () => {
    expect(n("modules/a/unsafe/aria.ts", "import { Part } from '@keel/ui/aria'\nexport const aria = Part\n")).toBe(0);
    expect(n("modules/a/unsafe/aria.ts", "export { Part } from '@keel/ui/aria'\n")).toBe(1);
    expect(n("modules/a/unsafe/aria.ts", "export * from '@keel/ui/aria'\n")).toBe(1);
  });
});
