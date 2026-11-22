// Spec: k.ui, Conformance "With tokens `base.page { fg: 'fg', bg: 'bg' }` and no style props on the page, `body`'s computed color and background are the tokens'; a `fg` at a use wins."
// Spec: k.ui, Base paragraph clauses asserted here: each `base` set sits on its role in the `keel.base` layer, its `states` under the role selector, atomic rules are unlayered, base elements carry their role class, tokens with no `base` give no role rules.
// Seed: 1337 (property over the role names).
// Not built yet: the cases are `test.skip`; the builder changes `test.skip` to `test` in each, except the last (live: tokens with no `base` give no role rules).
// Assumed: `compileStyles({ tokens, usages })` returns the whole compiled CSS file in `css`, `keel.base` included, written `@layer keel.base{...}`.
// The computed colors are Chromium's and are not asserted here; the layer order and the unlayered atomic rule are what they follow from.
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, norm } from "./fixtures.ts";
import { ROLES, ROLE_CLASS, baseLayer, compileWith, outsideBaseLayer, ruleBody } from "./base-support.ts";

const PAGE = { page: { fg: "fg", bg: "bg" } };
const roles = Object.keys(ROLES) as (keyof typeof ROLES)[];

describe("k.ui: base.page and the role sets compile into the keel.base layer", () => {
  test.skip("`base.page { fg: 'fg', bg: 'bg' }` puts the tokens' color and background on `body`, in the `keel.base` layer", () => {
    const { css } = compileWith({ base: PAGE }, []);
    const layer = baseLayer(css);
    expect(layer).not.toBeNull();
    const body = ruleBody(layer ?? "", "body") ?? "";
    expect(body).toMatch(/(^|;)color:var\(--k-color-fg\)/);
    expect(body).toMatch(/background(-color)?:var\(--k-color-bg\)/);
  });

  test.skip("the layer comes after the custom properties and holds `[hidden]{display:none!important}`", () => {
    const { css } = compileWith({ base: PAGE }, []);
    const n = norm(css);
    expect(n.indexOf(":root{")).toBeGreaterThanOrEqual(0);
    expect(n.indexOf("@layer keel.base{")).toBeGreaterThan(n.indexOf(":root{"));
    expect(baseLayer(css)).toContain("[hidden]{display:none!important}");
  });

  test.skip("a `fg` at a use wins: its atomic rule is outside the layer, the page's color rule inside it", () => {
    const { classes, css } = compileWith({ base: PAGE }, [{ props: { fg: "accent" } }]);
    const fg = (classes[0] ?? []).find((c) => c.startsWith("k-fg-"));
    expect(fg).toBe("k-fg-accent");
    expect(baseLayer(css)).not.toContain(".k-fg-accent");
    expect(outsideBaseLayer(css)).toContain(".k-fg-accent{");
    expect(outsideBaseLayer(css)).not.toContain("body{");
  });

  test.skip("each `base` set is on its role's selector in the layer (heading, link, button, control, label, fieldError, summary)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...roles), (role) => {
        const { css } = compileWith({ base: { [role]: ROLES[role] } }, []);
        const selector = ROLE_CLASS[role] ?? "";
        const body = ruleBody(baseLayer(css) ?? "", selector);
        expect(body, selector).not.toBeNull();
        expect((body ?? "").length).toBeGreaterThan(0);
        expect(outsideBaseLayer(css)).not.toContain(`${selector}{`);
      }),
      { seed: SEED, numRuns: 14 },
    );
  });

  test.skip("a role's `states` sit under the role selector (`.k-button:hover`)", () => {
    const { css } = compileWith({ base: { button: ROLES.button } }, []);
    const layer = baseLayer(css) ?? "";
    const hover = ruleBody(layer, ".k-button:hover") ?? "";
    expect(hover).toMatch(/background(-color)?:var\(--k-color-accent\)/);
  });

  test.skip("`page` is on `body` and the roles are not (`body` holds no `.k-*` selector)", () => {
    const { css } = compileWith({ base: { page: ROLES.label } }, []);
    const layer = baseLayer(css) ?? "";
    expect(ruleBody(layer, "body")).not.toBeNull();
    expect(layer).not.toContain(".k-heading");
  });

  test("tokens with no `base` give no role rules", () => {
    const { css } = compileWith({}, []);
    for (const selector of Object.values(ROLE_CLASS)) expect(norm(css)).not.toContain(`${selector}{`);
  });
});
