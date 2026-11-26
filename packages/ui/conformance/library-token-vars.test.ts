// Spec: k.looks, clause "With `border: { 'acme.edge': '1px solid var(--k-color-acme-accent)' }` shipped and composed, the CSS declares `--k-color-acme-accent` and `--k-border-acme-edge:1px solid var(--k-color-acme-accent)`, and a `border=\"acme.edge\"` element's rule is `border:var(--k-border-acme-edge)`."
// k.looks, Names "A name's custom property is `--k-<group>-<id>-<name>` when `<id>` and `<name>` are alphanumeric (`--k-color-acme-accent`), so a `border` value can name it."
// Seed: 1337 (fc.assert below).
// ASSUMPTIONS: the declaration and the rule are read after `norm` (whitespace around `:`, `;`, `{`, `}`, `,` and parentheses removed); a class rule is the declarations between its braces.
// A dotted name outside the alphanumeric form (an `_` or `-` in `<id>` or `<name>`) keeps the hashed form (RFC 0243 Problem); the spec states no hashed shape, so only that it is not the plain form is asserted.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { compileWith } from "./base-support.ts";
import { SEED, countRules, cssEscape, norm } from "./fixtures.ts";

const EDGE = "1px solid var(--k-color-acme-accent)";
const build = (color: Record<string, unknown>, border: Record<string, string>) =>
  compileWith({ color, border }, [{ props: { border: "acme.edge" } }]);

describe("k.looks: a library's custom property names", () => {
  test("with `border: { 'acme.edge': '1px solid var(--k-color-acme-accent)' }` shipped and composed, the CSS declares `--k-color-acme-accent` and `--k-border-acme-edge:1px solid var(--k-color-acme-accent)`, and a `border=\"acme.edge\"` element's rule is `border:var(--k-border-acme-edge)`", () => {
    const { classes, css } = build({ "acme.accent": "#0B5CAD", fg: "#111111", bg: "#ffffff" }, { "acme.edge": EDGE });
    const out = norm(css);
    expect(out).toContain("--k-color-acme-accent:#0B5CAD");
    const used = classes[0] ?? [];
    expect(used.length).toBeGreaterThan(0);
    for (const c of used) expect(countRules(css, c)).toBe(1);
    expect(out).toContain(`--k-border-acme-edge:${EDGE}`);
    const rules = used.map((c) => new RegExp(`\\.${cssEscape(c)}\\{([^}]*)\\}`).exec(out)?.[1] ?? "").join(";");
    expect(rules).toBe("border:var(--k-border-acme-edge)");
  });

  test("any alphanumeric `<id>` and `<name>` give `--k-color-<id>-<name>`, declared once with the token's value", () => {
    const part = fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);
    fc.assert(
      fc.property(part, part, (id, name) => {
        const { css } = compileWith({ color: { [`${id}.${name}`]: "#0B5CAD", fg: "#111111", bg: "#ffffff" } }, []);
        const decls = norm(css).split(`--k-color-${id}-${name}:`).length - 1;
        expect(decls).toBe(1);
        expect(norm(css)).toContain(`--k-color-${id}-${name}:#0B5CAD`);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("a name with no `.` keeps `--k-<group>-<name>`", () => {
    const { css } = compileWith({ color: { accent: "#0B5CAD", fg: "#111111", bg: "#ffffff" } }, []);
    expect(norm(css)).toContain("--k-color-accent:#0B5CAD");
  });

  test("a library's name whose `<name>` holds an underscore is not written as `--k-<group>-<id>-<name>`", () => {
    const { css } = compileWith({ color: { "acme.a_b": "#0B5CAD", fg: "#111111", bg: "#ffffff" } }, []);
    expect(norm(css)).not.toContain("--k-color-acme-a_b:");
    expect(norm(css)).toContain("#0B5CAD");
  });
});
