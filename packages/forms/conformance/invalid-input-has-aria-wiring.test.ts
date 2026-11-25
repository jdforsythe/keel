// @vitest-environment happy-dom
// Spec: k.forms, clause "An invalid bound input has `aria-invalid=\"true\"` and `aria-describedby` naming an element whose text is its message."
// fast-check seed: 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIELDS, INVALID, RUNS, SEED, VALID, fieldInput, setup } from "./fixtures.ts";

test('an invalid bound input has aria-invalid="true" and aria-describedby naming an element whose text is its message', async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...FIELDS), async (name) => {
      const h = setup();
      try {
        h.fill({ ...VALID, [name]: INVALID[name] });
        h.blur(name);
        await h.submit();
        const input = fieldInput(h.root, name);
        expect(input.getAttribute("aria-invalid")).toBe("true");
        const id = input.getAttribute("aria-describedby");
        expect(id).toBeTruthy();
        const target = document.getElementById(id ?? "");
        const message = h.f.errors()[name];
        expect(message).toBeTruthy();
        expect(target?.textContent?.trim()).toBe(message);
        for (const other of FIELDS.filter((n) => n !== name)) {
          expect(fieldInput(h.root, other).getAttribute("aria-invalid")).not.toBe("true");
        }
      } finally {
        h.dispose();
      }
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
