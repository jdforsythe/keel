// @vitest-environment happy-dom
// Spec: k.aria, Conformance "A `dialog` given `open` true has the `open` attribute and focus on its first `button`; a `cancel` event calls `onDismiss` and leaves it open; `open` false closes it and focuses the element focused before."
// Seed: 1337.
// Behavior extras: the focus fallback, `showModal()` after the commit, platform `close`, a trigger no longer connected.
// `onDismiss` is not in the Roles table's props for `dialog`; the Behavior paragraph names it, so it is passed here.
import { signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";

const SEED = 1337;
type Open = ReturnType<typeof signal<boolean>>;
type Role = "dialog" | "alertdialog";

const hosts: HTMLElement[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const h of hosts.splice(0)) h.remove();
});
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const byId = (host: ParentNode, id: string): HTMLElement => {
  const el = host.querySelector(`[id="${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no element ${id}`);
  return el;
};
const trigger = (): HTMLButtonElement => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = "Open";
  document.body.appendChild(b);
  hosts.push(b);
  return b;
};
const button = (id: string): HTMLButtonElement => {
  const b = document.createElement("button");
  b.id = id;
  b.type = "button";
  b.textContent = id;
  return b;
};

type Setup = { host: HTMLElement; open: Open; dismissed: number[]; off: () => void };
const setup = (role: Role, content: () => Node[], open: Open = signal(false)): Setup => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  hosts.push(host);
  const dismissed: number[] = [];
  const onDismiss = (): void => {
    dismissed.push(1);
  };
  const make = (): Node =>
    role === "dialog"
      ? Part({ id: "dlg", role, labelledBy: "ttl", open, onDismiss, children: content })
      : Part({ id: "dlg", role, labelledBy: "ttl", describedBy: "dsc", open, onDismiss, children: content });
  return { host, open, dismissed, off: mount(make, host) };
};

describe("k.aria: dialog", () => {
  test.skip("A `dialog` given `open` true has the `open` attribute and focus on its first `button`", async () => {
    for (const role of ["dialog", "alertdialog"] as const) {
      const s = setup(role, () => [button("first"), button("second")]);
      await flush();
      expect(byId(s.host, "dlg").hasAttribute("open")).toBe(false);
      s.open.set(true);
      await flush();
      expect(byId(s.host, "dlg").hasAttribute("open")).toBe(true);
      expect(document.activeElement).toBe(byId(s.host, "first"));
      s.off();
    }
  });

  test.skip("a `cancel` event calls `onDismiss` and leaves it open", async () => {
    const s = setup("dialog", () => [button("first")], signal(true));
    await flush();
    const ev = new Event("cancel", { cancelable: true });
    byId(s.host, "dlg").dispatchEvent(ev);
    await flush();
    expect(ev.defaultPrevented).toBe(true);
    expect(s.dismissed).toEqual([1]);
    expect(byId(s.host, "dlg").hasAttribute("open")).toBe(true);
    s.off();
  });

  test.skip("`open` false closes it and focuses the element focused before", async () => {
    const before = trigger();
    before.focus();
    const s = setup("dialog", () => [button("first")]);
    await flush();
    s.open.set(true);
    await flush();
    expect(document.activeElement).toBe(byId(s.host, "first"));
    s.open.set(false);
    await flush();
    expect(byId(s.host, "dlg").hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(before);
    s.off();
  });

  test.skip("`open` true calls `showModal()` after the commit", async () => {
    const spy = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const s = setup("dialog", () => [button("first")]);
    await flush();
    expect(spy).not.toHaveBeenCalled();
    s.open.set(true);
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.contexts[0]).toBe(byId(s.host, "dlg"));
    s.off();
  });

  test.skip("`open` false calls `close()`", async () => {
    const spy = vi.spyOn(HTMLDialogElement.prototype, "close");
    const s = setup("dialog", () => [button("first")], signal(true));
    await flush();
    s.open.set(false);
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    s.off();
  });

  test.skip("focus goes to the first descendant that is a `button`, `input`, `select`, `textarea`, `a[href]` or `tabindex=0`", async () => {
    const makers: Record<string, () => HTMLElement> = {
      button: () => document.createElement("button"),
      input: () => document.createElement("input"),
      select: () => document.createElement("select"),
      textarea: () => document.createElement("textarea"),
      anchor: () => {
        const a = document.createElement("a");
        a.setAttribute("href", "/x");
        return a;
      },
      tabindex: () => {
        const d = document.createElement("div");
        d.setAttribute("tabindex", "0");
        return d;
      },
    };
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...Object.keys(makers)), async (kind) => {
        const make = makers[kind];
        if (make === undefined) throw new Error("fixture");
        const target = make();
        target.id = "target";
        target.setAttribute("aria-label", kind);
        const plain = document.createElement("p");
        plain.textContent = "intro";
        const s = setup("dialog", () => [plain, target], signal(false));
        await flush();
        s.open.set(true);
        await flush();
        expect(document.activeElement).toBe(target);
        s.off();
        s.host.remove();
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test.skip("with no such descendant, focus goes to the dialog, which has `tabindex=-1`", async () => {
    const plain = document.createElement("p");
    plain.textContent = "Nothing to press";
    const s = setup("dialog", () => [plain]);
    await flush();
    s.open.set(true);
    await flush();
    expect(byId(s.host, "dlg").getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(byId(s.host, "dlg"));
    s.off();
  });

  test.skip("a platform `close` while `open` is true calls `onDismiss`", async () => {
    const s = setup("dialog", () => [button("first")], signal(true));
    await flush();
    byId(s.host, "dlg").dispatchEvent(new Event("close"));
    await flush();
    expect(s.dismissed).toEqual([1]);
    s.off();
  });

  test.skip("closing returns focus only to an element that is still connected", async () => {
    const before = trigger();
    before.focus();
    const s = setup("dialog", () => [button("first")]);
    await flush();
    s.open.set(true);
    await flush();
    before.remove();
    s.open.set(false);
    await flush();
    expect(document.activeElement).not.toBe(before);
    expect(byId(s.host, "dlg").hasAttribute("open")).toBe(false);
    s.off();
  });
});
