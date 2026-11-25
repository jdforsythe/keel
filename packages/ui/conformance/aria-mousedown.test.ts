// @vitest-environment happy-dom
// Spec: k.aria, clause "A `mousedown` on an `option` is default-prevented."
// Seed: 1337.
// Behavior extras: the same for `menuitem` and `menuitemcheckbox`, so a click leaves focus where it was; not for other roles.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import { afterEach, describe, expect, test } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});
const render = (make: () => Node): { host: HTMLElement; off: () => void } => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  hosts.push(host);
  return { host, off: mount(make, host, { ctx: simCtx }) };
};
const byId = (host: HTMLElement, id: string): Element => {
  const el = host.querySelector(`[id="${id}"]`);
  if (el === null) throw new Error(`no element ${id}`);
  return el;
};
const mousedown = (el: Element): MouseEvent => {
  const ev = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
};

describe("k.aria: mousedown", () => {
  test("A `mousedown` on an `option` is default-prevented", () => {
    const { host, off } = render(() => Part({ id: "o", role: "option", selected: false, children: () => "One" }));
    expect(mousedown(byId(host, "o")).defaultPrevented).toBe(true);
    off();
  });

  test("a `mousedown` on a `menuitem` and on a `menuitemcheckbox` is default-prevented", () => {
    const a = render(() => Part({ id: "m", role: "menuitem", children: () => "Open" }));
    expect(mousedown(byId(a.host, "m")).defaultPrevented).toBe(true);
    const b = render(() => Part({ id: "c", role: "menuitemcheckbox", checked: false, children: () => "Wrap" }));
    expect(mousedown(byId(b.host, "c")).defaultPrevented).toBe(true);
    a.off();
    b.off();
  });

  test("a click on an `option` leaves focus where it was", () => {
    const outside = document.createElement("input");
    outside.setAttribute("aria-label", "outside");
    document.body.appendChild(outside);
    hosts.push(outside);
    outside.focus();
    const { host, off } = render(() => Part({ id: "o", role: "option", selected: false, children: () => "One" }));
    mousedown(byId(host, "o"));
    byId(host, "o").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(outside);
    off();
  });

  test("a `mousedown` on a `button` is not default-prevented", () => {
    const { host, off } = render(() => Part({ id: "b", role: "button", controls: "p", children: () => "Go" }));
    expect(mousedown(byId(host, "b")).defaultPrevented).toBe(false);
    off();
  });
});
