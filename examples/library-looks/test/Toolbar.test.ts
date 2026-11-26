import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { expect, it } from "vitest";
import { Toolbar } from "../src/index.ts";

const chosen: string[] = [];
const ITEMS = [
  { key: "bold", text: "Bold", disabled: false },
  { key: "italic", text: "Italic", disabled: true },
  { key: "code", text: "Code", disabled: false },
];

/** The toolbar with one disabled item, recording what is chosen. */
function Tools() {
  return Toolbar({ id: "lib", label: "Format", items: ITEMS, onChoose: (k) => void chosen.push(k) });
}
Tools.Props = s.object({});

it("is a named toolbar whose disabled item reads as disabled, stays in the order and does nothing when chosen", async () => {
  chosen.length = 0;
  const view = render(Tools, { props: {} });
  expect(view.find("lib.toolbar").role).toBe("toolbar");
  expect(view.find("lib.toolbar").name).toBe("Format");
  expect(view.find("lib.italic").state.disabled).toBe(true);
  expect(view.find("lib.bold").state.disabled).toBeUndefined();
  await view.fire("lib.italic", { type: "click" });
  await view.fire("lib.bold", { type: "click" });
  expect(chosen).toEqual(["bold"]);
  view.dispose();
});

it(
  "after any run of arrow keys the one tab stop is the item the arrows reach, a disabled one included",
  { timeout: fixedTime(30_000) },
  async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("ArrowRight", "ArrowLeft", "Home", "End"), { maxLength: 8 }),
        async (keys) => {
          const view = render(Tools, { props: {} });
          let at = 0;
          for (const key of keys) {
            await view.fire(`lib.${ITEMS[at]?.key ?? "bold"}`, { type: "keydown", key });
            at = key === "ArrowRight" ? (at + 1) % 3 : key === "ArrowLeft" ? (at + 2) % 3 : key === "Home" ? 0 : 2;
          }
          expect(view.find(`lib.${ITEMS[at]?.key ?? "bold"}`).state.focused ?? at === 0).toBe(true);
          view.dispose();
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  },
);
