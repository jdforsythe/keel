// @vitest-environment happy-dom
// k.testing, Rules "E1701 DOM selector or DOM query in a test (`querySelector`, `getByRole`, `container`)"
// Seed: 1337.
import { fixedTime } from "@keel/tooling/test-time";
import { check } from "@keel/check";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Button, SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

describe("k.testing: E1701 DOM selector or DOM query in a test", () => {
  it("E1701 find with a selector string rejects/throws with E1701", async () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("#save", ".y", "div", "button[disabled]", "> p"), async (sel) => {
        const e = await thrown(() => t.find(sel));
        expect(codeOf(e)).toBe("E1701");
        expect(messageOf(e)).toContain("E1701");
      }),
      { seed: SEED, numRuns: 25 },
    );
    t.dispose();
  });

  it("E1701 fire with a selector string rejects with E1701", async () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    expect(codeOf(await thrown(() => t.fire("#save", { type: "click" })))).toBe("E1701");
    t.dispose();
  });

  it("E1701 a11y(id) with a selector string rejects/throws with E1701", async () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    expect(codeOf(await thrown(() => t.a11y("#save")))).toBe("E1701");
    t.dispose();
  });

  it(
    "E1701 static form: querySelector, getByRole and container in a test file are reported, find(id) is not",
    async () => {
      const run = async (body: string) => {
        const source = `import { render } from "@keel/testing"\nimport { expect, it } from "vitest"\nit("x", () => {\n  const t = render(C, { props: {} })\n  ${body}\n})\n`;
        const r = await check([{ path: "modules/orders/x.test.ts", source }], { types: false });
        return r.diagnostics.filter((d) => d.code === "E1701");
      };
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'expect(document.querySelector("#save")).toBeNull()',
            'expect(screen.getByRole("button")).toBeDefined()',
            "expect(t.container.firstChild).toBeNull()",
          ),
          async (body) => {
            expect((await run(body)).length).toBeGreaterThan(0);
          },
        ),
        { seed: SEED, numRuns: 30 },
      );
      expect(await run('expect(t.find("save").name).toBe("Save")')).toEqual([]);
    },
    fixedTime(30_000),
  );

  it(
    "E1701 static form: the testing-library idiom `const { container } = render(...)` is reported",
    async () => {
      const source = `import { render } from "@keel/testing"\nit("x", () => {\n  const { container } = render(C, { props: {} })\n  expect(container).toBeDefined()\n})\n`;
      const r = await check([{ path: "modules/orders/x.test.ts", source }], { types: false });
      expect(r.diagnostics.filter((d) => d.code === "E1701").length).toBeGreaterThan(0);
    },
    fixedTime(30_000),
  );
});
