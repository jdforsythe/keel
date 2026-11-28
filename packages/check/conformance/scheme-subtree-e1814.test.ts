// Spec: k.aria, clause "With color tokens `fg` `{ light: '#111111', dark: '#eeeeee' }` and `bg` `{ light: '#ffffff', dark: '#111111' }`, `<Box id=\"side\" scheme=\"dark\">` renders `data-k-scheme=\"dark\"` on its element in server and client output and the CSS holds `:root [data-k-scheme=\"dark\"]` declaring `color-scheme:dark` and `--k-color-fg:#eeeeee` under `@media screen`; with no `scheme` written, the CSS holds no ` [data-k-scheme=`; `compileStyles({ tokens, usages: [{ props: { scheme: 'dark' } }] })` gives `classes` `[[]]` and CSS holding `:root [data-k-scheme=\"light\"]` and `:root [data-k-scheme=\"dark\"]` under `@media screen`; with `brandTokens`, `<Box scheme=\"dark\">` is one E1814 at the attribute with message `scheme=\"dark\" needs schemes light and dark; the tokens have light only`."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// Only the E1814 half of the k.aria clause is asserted here (its CSS and render half is packages/ui/conformance/themes-css.test.ts); k.schemes Checks and Rules give the message and the empty fix ("a `Box` writing `scheme` (k.aria), at the attribute"; fix: none).
// ASSUMPTIONS (as schemes-contrast.test.ts): tokens reach `check()` as `artifacts: { tokens }` beside a `tokens.ts` source; "at the attribute" is a position on `scheme="dark"` (the name, or its opening quote).
import { check } from "@keel/check";
import { defineTokens } from "@keel/ui/tokens";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { BRAND_ONLY, atText } from "./library-looks-support.ts";
import { SEED, one } from "./support.ts";

const page = (value: string, tag = "Box"): ReturnType<typeof one> =>
  one(
    `import { ${tag} } from '@keel/ui'\nexport default function C() { return <${tag} id="side" scheme="${value}" /> }\n`,
  );
const run = (files: ReturnType<typeof one>, tokens: unknown) =>
  check([...files, { path: "tokens.ts", source: BRAND_ONLY }], {
    artifacts: { tokens },
    types: false,
  }).diagnostics.filter((d) => d.code === "E1814");

describe("k.aria: Scheme in an app with one scheme", () => {
  test(
    'With `brandTokens`, `<Box scheme="dark">` is one E1814 at the attribute with message `scheme="dark" needs schemes light and dark; the tokens have light only`',
    () => {
      const files = page("dark");
      const d = run(files, brandTokens);
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe('scheme="dark" needs schemes light and dark; the tokens have light only');
      expect(d[0]?.path).toBe("C.tsx");
      expect(atText(files[0]?.source ?? "", 'scheme="dark"', d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
      expect(d[0]?.fix).toBeUndefined();
    },
    CHECK_CASE_BOUND,
  );

  test(
    "the message names the value written and the one scheme the tokens have, whatever the pair",
    () => {
      fc.assert(
        fc.property(fc.constantFrom("light", "dark"), fc.constantFrom("light", "dark"), (value, only) => {
          const t = defineTokens({ ...brandTokens, schemes: [only] });
          expect(run(page(value), t).map((d) => d.message)).toEqual([
            `scheme="${value}" needs schemes light and dark; the tokens have ${only} only`,
          ]);
        }),
        { seed: SEED, numRuns: 8 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "with both schemes, declared or implied by an own color pair, `scheme` gives no E1814, and a page writing no `scheme` gives none whatever the tokens",
    () => {
      const both = defineTokens({ ...brandTokens, schemes: ["light", "dark"] });
      const implied = defineTokens({
        ...brandTokens,
        color: { ...brandTokens.color, mine: { light: "#111111", dark: "#eeeeee" } },
      });
      expect(run(page("dark"), both)).toEqual([]);
      expect(run(page("dark"), implied)).toEqual([]);
      const plain = one(`import { Box } from '@keel/ui'\nexport default function C() { return <Box id="side" /> }\n`);
      expect(run(plain, brandTokens)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a `scheme` on a `Box` that is not `@keel/ui`'s is not judged",
    () => {
      const own = one(
        `import { Box } from './Box.tsx'\nexport default function C() { return <Box id="side" scheme="dark" /> }\n`,
      );
      const files = [
        ...own,
        { path: "Box.tsx", source: "export function Box(props: { id: string; scheme: string }) { return props.id }\n" },
      ];
      expect(run(files, brandTokens)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );
});
