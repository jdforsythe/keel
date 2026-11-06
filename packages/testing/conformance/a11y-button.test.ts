// @vitest-environment happy-dom
// Spec: k.testing, clause "`a11y()` for `<Button label=\"Save\" disabled />` contains `{ role: 'button', name: 'Save', state: { disabled: true } }`." Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Button, SEED, flatten, simCtx } from "./fixtures.ts";

describe("k.testing: a11y() for <Button label=Save disabled /> contains { role: button, name: Save, state: { disabled: true } }", () => {
  it("a11y() contains a button node named Save with state.disabled true", () => {
    const t = render(Button, { props: { label: "Save", disabled: true }, ctx: simCtx() });
    const node = flatten(t.a11y()).find((n) => n.id === "save");
    expect(node).toMatchObject({ role: "button", name: "Save", state: { disabled: true } });
    t.dispose();
  });

  it("for any non-blank label the button's name is the label, and disabled false is not reported as disabled", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((x) => x.trim() === x && x !== ""),
        fc.boolean(),
        (label, disabled) => {
          const t = render(Button, { props: { label, disabled }, ctx: simCtx() });
          const node = flatten(t.a11y()).find((n) => n.id === "save");
          expect(node).toMatchObject({ role: "button", name: label });
          expect(node?.state).toMatchObject(disabled ? { disabled: true } : {});
          if (!disabled) expect(node?.state).not.toMatchObject({ disabled: true });
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });
});
