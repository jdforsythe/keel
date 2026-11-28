// Spec: k.gamut, clause "With color tokens `card` and `on` `#FFFFFF`, `fontSize` `big` `24px` and `overlay: { scrim: { value: 'color(display-p3 0 0.66 0 / 0.95)', over: ['card'] } }`, `<Text fg=\"on\" bg=\"scrim\" fontSize=\"big\">x</Text>` reports no E1804 (3.07:1 on the sRGB composite `rgb(13 171 17)`, 3.09:1 on the P3 one) and `<Text fg=\"on\" bg=\"scrim\">x</Text>` one with message `fg \"on\" on bg \"scrim\" over \"card\" is 3.07:1 in light (sRGB), needs 4.5:1`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// k.gamut #2, the E1804 of an overlay whose `value` is outside sRGB: composited within each form (`a x c + (1 - a) x b` on each encoded channel of the two colors' forms, times 255 rounded), the lower ratio standing.
// ASSUMPTIONS: as color-gamut-e1804.test.ts; the message is k.a11y-static Message's with ` over "<backdrop>"` after `"<bg>"`.
// Worked numbers: the clause's own `3.07:1` (sRGB composite `rgb(13 171 17)`) and `3.09:1` (P3 composite, channels 13, 173, 13 of 255). One pair beyond them was recomputed from k.gamut's definitions: `oklch(60% 0.3 150 / 0.8)` over `#FFFFFF`: sRGB form `rgb(0 158 54 / 0.8)` composites to `rgb(51 177 94)` (2.77:1 under `#FFFFFF` text); P3 form `color(display-p3 0 0.6376 0.1386 / 0.8)` composites to display-p3 channels 51, 181, 79 of 255 (2.74:1); so one E1804 at `2.74:1 in light (P3)`. The P3 composite's channels are also recomputed in the property below.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { SEED, insideSrgb, looseTokens, one, ratioOf } from "./support.ts";

const view = (jsx: string) =>
  one(`import { Box, Text } from '@keel/ui'\nexport default function C() { return ${jsx} }\n`);
const e1804 = (value: string, jsx: string, extra: Record<string, unknown> = {}) =>
  check(view(jsx), {
    artifacts: {
      tokens: looseTokens({
        color: { card: "#FFFFFF", on: "#FFFFFF" },
        fontSize: { big: "24px" },
        overlay: { scrim: { value, over: ["card"] } },
        ...extra,
      }),
    },
    types: false,
  }).diagnostics.filter((d) => d.code === "E1804");
const SCRIM = "color(display-p3 0 0.66 0 / 0.95)";
const BIG = `<Text fg="on" bg="scrim" fontSize="big">x</Text>`;
const NORMAL = `<Text fg="on" bg="scrim">x</Text>`;

describe("k.gamut #2: an overlay outside sRGB is composited within each form", () => {
  test(
    'With color tokens `card` and `on` `#FFFFFF`, `fontSize` `big` `24px` and `overlay: { scrim: { value: \'color(display-p3 0 0.66 0 / 0.95)\', over: [\'card\'] } }`, `<Text fg="on" bg="scrim" fontSize="big">x</Text>` reports no E1804 (3.07:1 on the sRGB composite `rgb(13 171 17)`, 3.09:1 on the P3 one)',
    () => {
      expect(e1804(SCRIM, BIG)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    'and `<Text fg="on" bg="scrim">x</Text>` one with message `fg "on" on bg "scrim" over "card" is 3.07:1 in light (sRGB), needs 4.5:1`',
    () => {
      const d = e1804(SCRIM, NORMAL);
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('fg "on" on bg "scrim" over "card" is 3.07:1 in light (sRGB), needs 4.5:1');
    },
    CHECK_CASE_BOUND,
  );

  test(
    "the composites' own ratios: `rgb(13 171 17)` under `#FFFFFF` is 3.07:1 and display-p3 channels 13, 173, 13 of 255 is 3.09:1",
    () => {
      expect(ratioOf("rgb(13 171 17)", "#FFFFFF")).toBe("3.07");
      expect(ratioOf("color(display-p3 0.05098 0.67843 0.05098)", "#FFFFFF")).toBe("3.09");
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`oklch(60% 0.3 150 / 0.8)` over `#FFFFFF`, composites `rgb(51 177 94)` (2.77:1) and display-p3 channels 51, 181, 79 of 255 (2.74:1), is one E1804 at `2.74:1 in light (P3)`",
    () => {
      expect(ratioOf("rgb(51 177 94)", "#FFFFFF")).toBe("2.77");
      expect(ratioOf("color(display-p3 0.2 0.70980 0.30980)", "#FFFFFF")).toBe("2.74");
      const d = e1804("oklch(60% 0.3 150 / 0.8)", `<Text fg="on" bg="scrim" fontSize="big">x</Text>`);
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('fg "on" on bg "scrim" over "card" is 2.74:1 in light (P3), needs 3:1');
    },
    CHECK_CASE_BOUND,
  );

  test(
    "an overlay inside sRGB names no form: `rgb(26 25 30 / 0.4)` over `#FFFFFF` under `#FFFFFF` text, one E1804, ends `in light, needs 4.5:1`",
    () => {
      const d = e1804("rgb(26 25 30 / 0.4)", NORMAL);
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toMatch(/ in light, needs 4\.5:1$/);
      expect(d[0]?.message).not.toMatch(/\((sRGB|P3)\)/);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "whatever the display-p3 overlay color and alpha over `#FFFFFF`, the ratio a message shows is no higher than the P3 composite's, `a x c + (1 - a) x b` on each channel, times 255 rounded",
    () => {
      const u = fc.integer({ min: 0, max: 100 });
      const alpha = fc.integer({ min: 40, max: 99 });
      fc.assert(
        fc.property(u, u, u, alpha, (r, g, b, a) => {
          const color = `color(display-p3 ${r / 100} ${g / 100} ${b / 100})`;
          fc.pre(!insideSrgb(color));
          const comp = [r, g, b].map((c) => Math.round(((a / 100) * (c / 100) + (1 - a / 100)) * 255) / 255);
          const p3 = Number(ratioOf(`color(display-p3 ${comp.join(" ")})`, "#FFFFFF"));
          const d = e1804(`color(display-p3 ${r / 100} ${g / 100} ${b / 100} / ${a / 100})`, NORMAL);
          fc.pre(d.length === 1);
          const m = /is (\d+\.\d\d):1 in light \((sRGB|P3)\), needs 4\.5:1$/.exec(d[0]?.message ?? "");
          expect(m).not.toBeNull();
          expect(Number(m?.[1])).toBeLessThanOrEqual(p3 + 0.011);
          if (m?.[2] === "P3") expect(Math.abs(Number(m?.[1]) - p3)).toBeLessThanOrEqual(0.011);
        }),
        { seed: SEED, numRuns: 20 },
      );
    },
    CHECK_CASE_BOUND,
  );
});
