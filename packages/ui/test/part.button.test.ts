// @vitest-environment happy-dom
// k.aria Roles: `controls` is optional on a `button` part, written as `aria-controls` when given.
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import { expect, test } from "vitest";

test("a button part renders without `controls`, and with it writes `aria-controls`", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(
    () =>
      Part({
        id: "w",
        role: "generic",
        children: () => [
          Part({ id: "a", role: "button", hasPopup: "menu", expanded: false, children: () => "Actions" }),
          Part({ id: "b", role: "button", controls: "p", children: () => "Details" }),
        ],
      }),
    host,
  );
  expect(host.querySelector("#a")?.hasAttribute("aria-controls")).toBe(false);
  expect(host.querySelector("#a")?.getAttribute("aria-haspopup")).toBe("menu");
  expect(host.querySelector("#b")?.getAttribute("aria-controls")).toBe("p");
  off();
  host.remove();
});
