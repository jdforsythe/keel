// Spec: std.headless, clause "A Dialog's trigger click opens the dialog with focus on its first button; Escape closes it and focuses the trigger; an `alert` Dialog renders `alertdialog` with `aria-describedby`."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: Escape is fired at the part `<id>.dialog`; "open" is the `open` attribute of the `<dialog>` element, read by id;
// `aria-describedby` is read by id because `find(id)` does not return it; `alert.description` renders in the part `<id>.description`.
import { Dialog } from "@keel/std-headless";
import { render } from "@keel/testing";
import { Button } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, el, page, simCtx } from "./fixtures.ts";

const mount = (alert?: string) =>
  render(
    page((c) =>
      Dialog(
        {
          id: "dlg",
          title: "Settings",
          trigger: () => "Open settings",
          content: (close) => [
            Button({ id: "dlg.save", children: "Save", onClick: close }),
            Button({ id: "dlg.cancel", children: "Cancel", onClick: close }),
          ],
          ...(alert === undefined ? {} : { alert: { description: alert } }),
        },
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );

const isOpen = (id: string): boolean => el(id)?.hasAttribute("open") === true;

describe("std.headless: Dialog", () => {
  test("A Dialog's trigger click opens the dialog with focus on its first button", async () => {
    const t = mount();
    expect(isOpen("dlg.dialog")).toBe(false);
    expect(t.find("dlg.trigger").role).toBe("button");
    await t.fire("dlg.trigger", { type: "click" });
    expect(isOpen("dlg.dialog")).toBe(true);
    expect(t.find("dlg.dialog").role).toBe("dialog");
    expect(t.find("dlg.save").state.focused).toBe(true);
    expect(t.find("dlg.cancel").state.focused).not.toBe(true);
    t.dispose();
  });

  test("Escape closes the dialog and focuses the trigger", async () => {
    const t = mount();
    await t.fire("dlg.trigger", { type: "focus" });
    await t.fire("dlg.trigger", { type: "click" });
    expect(isOpen("dlg.dialog")).toBe(true);
    await t.fire("dlg.dialog", { type: "keydown", key: "Escape" });
    expect(isOpen("dlg.dialog")).toBe(false);
    expect(t.find("dlg.trigger").state.focused).toBe(true);
    t.dispose();
  });

  test("a click, Enter or Space on the trigger opens, and the dialog is named by its title (property over the opening key)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("click", "Enter", " "), async (how) => {
        const t = mount();
        if (how === "click") await t.fire("dlg.trigger", { type: "click" });
        else await t.fire("dlg.trigger", { type: "keydown", key: how });
        expect(isOpen("dlg.dialog")).toBe(true);
        expect(t.find("dlg.dialog").name).toBe("Settings");
        t.dispose();
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  test("an `alert` Dialog renders `alertdialog` with `aria-describedby`", async () => {
    const t = mount("This cannot be undone.");
    expect(t.find("dlg.dialog").role).toBe("alertdialog");
    expect(el("dlg.dialog")?.getAttribute("aria-describedby")).toBe("dlg.description");
    expect(t.find("dlg.description").text).toBe("This cannot be undone.");
    expect(el("dlg.dialog")?.getAttribute("aria-labelledby")).toBe("dlg.title");
    t.dispose();
    const plain = mount();
    expect(plain.find("dlg.dialog").role).toBe("dialog");
    expect(el("dlg.dialog")?.hasAttribute("aria-describedby")).toBe(false);
    plain.dispose();
  });
});
