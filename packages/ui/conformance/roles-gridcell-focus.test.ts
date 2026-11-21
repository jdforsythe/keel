// @vitest-environment happy-dom
// Spec: k.roles, Conformance "A `gridcell` with `tabIndex` and `focus` from a signal: moving the signal from one cell to another focuses the second and leaves one cell with `tabindex="0"`."
// Seed: 1337.
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { SEED, byId, cleanup, computed, flush, render, signal } from "./roles-support.ts";

afterEach(cleanup);

describe("k.roles: roving focus over gridcells", () => {
  test('moving the signal from one cell to another focuses the second and leaves one cell with `tabindex="0"`', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 6 }),
        fc.array(fc.nat({ max: 5 }), { minLength: 1, maxLength: 6 }),
        async (n, moves) => {
          const active = signal(0);
          const { host, off } = render(() =>
            Part({
              id: "g",
              role: "grid",
              label: "G",
              children: () => [
                Part({
                  id: "g.b",
                  role: "rowgroup",
                  children: () => [
                    Part({
                      id: "g.r",
                      role: "row",
                      children: () =>
                        Array.from({ length: n }, (_, i) =>
                          Part({
                            id: `g.c${i}`,
                            role: "gridcell",
                            tabIndex: computed(() => (active.get() === i ? 0 : -1)),
                            focus: computed(() => active.get() === i),
                            children: () => String(i),
                          }),
                        ),
                    }),
                  ],
                }),
              ],
            }),
          );
          await flush();
          let at = 0;
          for (const m of moves) {
            // Always a different cell: `focus` does not fire at first render, only when it turns true.
            const to = (at + 1 + (m % (n - 1))) % n;
            at = to;
            active.set(to);
            await flush();
            expect(document.activeElement).toBe(byId(host, `g.c${to}`));
            const stops = Array.from({ length: n }, (_, i) => byId(host, `g.c${i}`)).filter(
              (el) => el.getAttribute("tabindex") === "0",
            );
            expect(stops).toEqual([byId(host, `g.c${to}`)]);
          }
          off();
        },
      ),
      { seed: SEED, numRuns: 10 },
    );
  });
});
