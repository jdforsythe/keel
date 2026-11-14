// @vitest-environment happy-dom
// A key a part's `onKey` handles (returns true) does not reach an ancestor part's `onKey`; an unhandled one does.
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import { expect, test } from "vitest";

test("a handled key stops at the part that handled it", () => {
  const seen: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(
    () =>
      Part({
        id: "outer",
        role: "group",
        label: "Outer",
        onKey: (k) => {
          seen.push(`outer ${k.key}`);
          return true;
        },
        children: () => [
          Part({
            id: "m",
            role: "menu",
            label: "Menu",
            onKey: (k) => {
              seen.push(`menu ${k.key}`);
              return k.key === "Escape";
            },
            children: () => [Part({ id: "i", role: "menuitem", children: () => "Open" })],
          }),
        ],
      }),
    host,
  );
  const m = host.querySelector("#m");
  for (const key of ["Escape", "a"])
    m?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  expect(seen).toEqual(["menu Escape", "menu a", "outer a"]);
  off();
  host.remove();
});
