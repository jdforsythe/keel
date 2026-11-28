// k.compiler Build: a build serves `@keel/ui`'s `USES_*` flag modules from the app's style usages, `true` only when a
// usage writes what the flag names, so an app that writes no break prop, `media` or `Box scheme` ships none of their code.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { usesFlagCode } from "../src/internal/usesFlagCode.ts";

const ui = path.resolve(import.meta.dirname, "../../ui");
const flag = (name: string, ext = "ts"): string => path.join(ui, "src", "internal", `USES_${name}.${ext}`);

describe("usesFlagCode", () => {
  it("is false for each flag when no usage writes it", () => {
    const usages = [{ props: { p: "2" } }, { props: {}, look: "card" }];
    for (const n of ["BREAKS", "MEDIA", "SCHEME"])
      expect(usesFlagCode(flag(n), usages)).toBe(`export const USES_${n} = false;\n`);
  });

  it("is true for the flag a usage writes, and only that one", () => {
    expect(usesFlagCode(flag("BREAKS"), [{ props: { breakInside: "avoid" }, breakpoint: "print" }])).toBe(
      "export const USES_BREAKS = true;\n",
    );
    expect(usesFlagCode(flag("MEDIA"), [{ props: { media: "print" } }])).toBe("export const USES_MEDIA = true;\n");
    expect(usesFlagCode(flag("SCHEME"), [{ props: { scheme: "dark" } }])).toBe("export const USES_SCHEME = true;\n");
    expect(usesFlagCode(flag("SCHEME"), [{ props: { media: "print" } }])).toBe("export const USES_SCHEME = false;\n");
  });

  it("serves no other module: another file, a query, a package that is not @keel/ui", () => {
    expect(usesFlagCode(path.join(ui, "src", "internal", "styleProps.ts"), [])).toBeNull();
    expect(usesFlagCode(`${flag("MEDIA")}?v=1`, [])).toBe("export const USES_MEDIA = false;\n");
    const other = path.resolve(import.meta.dirname, "..", "src", "internal", "USES_MEDIA.ts");
    expect(usesFlagCode(other, [])).toBeNull();
    expect(usesFlagCode(path.join(ui, "dist", "src", "internal", "USES_MEDIA.js"), [])).toBe(
      "export const USES_MEDIA = false;\n",
    );
  });
});
