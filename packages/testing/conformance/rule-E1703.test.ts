// @vitest-environment happy-dom
// Spec: k.testing Rules, E1703 axe violation in a harness render. Seed: 1337.
import { render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { BadImg, Button, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

describe("k.testing: E1703 axe violation in a harness render", () => {
  it("E1703 rendering an img without alt text fails with E1703", async () => {
    const e = await thrown(() => render(BadImg, { props: {}, ctx: simCtx() }));
    expect(codeOf(e)).toBe("E1703");
    expect(messageOf(e)).toContain("E1703");
  });

  it("E1703 a render with no axe violations does not throw", () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    t.dispose();
    expect(true).toBe(true);
  });
});
