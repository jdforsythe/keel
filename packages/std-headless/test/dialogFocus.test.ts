// @vitest-environment happy-dom
// Escape closes only the innermost widget; a closed Dialog returns focus to its trigger, or to `main` when the
// trigger is gone.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { If } from "@keel/runtime-dom";
import { render } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import { expect, test } from "vitest";
import { el, fruit, page, simCtx } from "../conformance/fixtures.ts";
import { Combobox } from "../src/Combobox.ts";
import { Dialog } from "../src/Dialog.ts";
import { Menu } from "../src/Menu.ts";

const flag = (start: boolean): Signal<boolean> => {
  const made: Signal<boolean>[] = [];
  scope(() => void made.push(signal(start)));
  const [s] = made;
  if (s === undefined) throw new Error("no signal");
  return s;
};
const isOpen = (id: string): boolean => el(id)?.hasAttribute("open") === true;
const focused = (): string => document.activeElement?.id ?? "";

test("Escape in a Menu inside a Dialog closes the menu only and focuses its trigger", async () => {
  const t = render(
    page((c) =>
      Dialog(
        {
          id: "d",
          title: "Edit",
          trigger: () => "Edit",
          content: () => Menu({ id: "m", trigger: () => "More", items: () => fruit, onSelect: () => {} }, undefined, c),
        },
        undefined,
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("d.trigger", { type: "click" });
  await t.fire("m.trigger", { type: "keydown", key: "Enter" });
  expect(t.find("m.trigger").state.expanded).toBe(true);
  await t.fire("m.menu", { type: "keydown", key: "Escape" });
  expect(t.find("m.trigger").state.expanded).toBe(false);
  expect(isOpen("d.dialog")).toBe(true);
  expect(focused()).toBe("m.trigger");
  await t.fire("m.trigger", { type: "keydown", key: "Escape" });
  expect(isOpen("d.dialog")).toBe(false);
  t.dispose();
});

test("Escape in an open Combobox inside a Dialog closes the list only and keeps focus on the input", async () => {
  const t = render(
    page((c) =>
      Dialog(
        {
          id: "d",
          title: "Find",
          trigger: () => "Find",
          content: () =>
            Combobox(
              { id: "c", label: "Fruit", text: () => "", onInput: () => {}, options: () => fruit, onChange: () => {} },
              undefined,
              c,
            ),
        },
        undefined,
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("d.trigger", { type: "click" });
  await t.fire("c.input", { type: "focus" });
  await t.fire("c.input", { type: "keydown", key: "ArrowDown" });
  await t.fire("c.input", { type: "keydown", key: "Escape" });
  expect(t.find("c.input").state.expanded).toBe(false);
  expect(isOpen("d.dialog")).toBe(true);
  expect(focused()).toBe("c.input");
  t.dispose();
});

test("Escape in a Dialog inside a Dialog closes the inner one and focuses its trigger", async () => {
  const t = render(
    page((c) =>
      Dialog(
        {
          id: "outer",
          title: "Settings",
          trigger: () => "Settings",
          content: () =>
            Dialog({ id: "inner", title: "Reset", trigger: () => "Reset", content: () => "Sure?" }, undefined, c),
        },
        undefined,
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("outer.trigger", { type: "click" });
  await t.fire("inner.trigger", { type: "click" });
  expect(isOpen("inner.dialog")).toBe(true);
  await t.fire("inner.dialog", { type: "keydown", key: "Escape" });
  expect(isOpen("inner.dialog")).toBe(false);
  expect(isOpen("outer.dialog")).toBe(true);
  expect(focused()).toBe("inner.trigger");
  t.dispose();
});

test("a click that left focus on body returns focus to the trigger at close", async () => {
  const t = render(
    page((c) => Dialog({ id: "d", title: "Edit", trigger: () => "Edit", content: () => "Body" }, undefined, c)),
    { props: {}, ctx: simCtx() },
  );
  expect(focused()).toBe("");
  await t.fire("d.trigger", { type: "click" });
  expect(isOpen("d.dialog")).toBe(true);
  await t.fire("d.dialog", { type: "keydown", key: "Escape" });
  expect(focused()).toBe("d.trigger");
  t.dispose();
});

// The Dialog's trigger and dialog go together, so a confirm that deletes its own row removes the open dialog: this
// passes once `Part` applies its close fallback to a dialog removed while open.
test.skip("a Dialog whose trigger is gone at close returns focus to `main`", async () => {
  const row = flag(true);
  const t = render(
    page((c) =>
      Box({
        as: "main",
        id: "page",
        children: () =>
          If({
            get when() {
              return row.get();
            },
            children: () =>
              Dialog(
                {
                  id: "d",
                  title: "Delete",
                  trigger: () => "Delete",
                  content: (close) =>
                    Button({
                      id: "d.yes",
                      children: "Delete row",
                      onClick: () => {
                        close();
                        row.set(false);
                      },
                    }),
                },
                undefined,
                c,
              ),
          }),
      }),
    ),
    { props: {}, ctx: simCtx() },
  );
  await t.fire("d.trigger", { type: "click" });
  await t.fire("d.yes", { type: "click" });
  await t.settle();
  expect(el("d.trigger")).toBeNull();
  expect(focused()).toBe("page");
  t.dispose();
});
