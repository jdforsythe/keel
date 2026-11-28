// k.a11y, Order and focus: "`brandTokens` sets `focus: 'text'`, Charcoal `#1a191e`: 16.60:1 on `surface`, 15.75:1 on `surfaceLow`, 17.47:1 on `card`."
// k.ui, Tokens: "`base` holds optional style sets `page`, `heading`, `link`, `button`, `control`, `label`, `fieldError`, `summary` ... and `focus`, a color token. `look` maps a name to such a set" (docs/BRAND.md 4: `brandTokens` carries both; `look` names `primary`, `control`, `secondary`).
// Seed: 1337 (property over the three surfaces).
// Not built yet: the cases about `brandTokens.base` and `brandTokens.look` are `test.skip`; the builder changes `test.skip` to `test` in each. The contrast ratios are live: they are the existing palette's.
// `brandTokens.base` and `.look` are read with `Reflect.get` so the file type-checks before `Tokens` names the groups.
import { TokenSchema } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, ratio } from "./fixtures.ts";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const group = (name: string): Record<string, unknown> => {
  const g: unknown = Reflect.get(brandTokens, name);
  return isRecord(g) ? g : {};
};
const round2 = (n: number): number => Math.round(n * 100) / 100;

describe("k.a11y and k.ui: brandTokens carries base and look, and its focus ring clears the contrast", () => {
  test("Charcoal measures 16.60:1 on surface, 15.75:1 on surfaceLow and 17.47:1 on card", () => {
    const text = brandTokens.color.text;
    expect(text).toBe("#1a191e");
    const expected = { surface: 16.6, surfaceLow: 15.75, card: 17.47 } as const;
    for (const [name, want] of Object.entries(expected)) {
      const bg = Reflect.get(brandTokens.color, name);
      expect(typeof bg).toBe("string");
      expect(round2(ratio("#1a191e", String(bg)))).toBe(want);
    }
  });

  test("the focus color clears 3:1 against every surface (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom("surface", "surfaceLow", "card"), (name) => {
        expect(ratio("#1a191e", String(Reflect.get(brandTokens.color, name)))).toBeGreaterThanOrEqual(3);
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  test("`brandTokens.base.focus` is `text`", () => {
    expect(group("base")["focus"]).toBe("text");
  });

  test("`brandTokens.base` holds a set for each of page, heading, link, button, control, label, fieldError and summary", () => {
    const base = group("base");
    for (const role of ["page", "heading", "link", "button", "control", "label", "fieldError", "summary"]) {
      expect(isRecord(base[role]), role).toBe(true);
    }
  });

  test("`brandTokens.look` names `primary`, `control` and `secondary`", () => {
    expect(Object.keys(group("look")).sort()).toEqual(["control", "primary", "secondary"]);
  });

  test("`brandTokens` passes `TokenSchema` with both groups", () => {
    expect(TokenSchema.parse(brandTokens).ok).toBe(true);
  });
});
