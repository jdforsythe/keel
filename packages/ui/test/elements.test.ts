// @vitest-environment happy-dom
// Base elements: dynamic classes (signals and getter props), ids, a11y attributes, URL safety. Seed 1337.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import type { Href } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, Text, TextArea, styles } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};
const scoped = <T>(make: () => T): { value: T; dispose: () => void } => {
  const box: { value?: T } = {};
  const sc = scope(() => {
    box.value = make();
  });
  if (box.value === undefined) throw new Error("scoped: no value");
  return { value: box.value, dispose: () => sc.dispose() };
};
const render = (make: () => Node): { host: HTMLElement; dispose: () => void } => {
  const host = document.createElement("div");
  return { host, dispose: mount(make, host) };
};
const first = (host: Element): Element => {
  const e = host.firstElementChild;
  if (e === null) throw new Error("no element");
  return e;
};

describe("dynamic style props", () => {
  it("a signal switches only the class list, keeping node identity (k.ui C5, signal in scope)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom("0", "1", "2", "3"), { minLength: 1, maxLength: 6 }), async (seq) => {
        const s = scoped(() => signal<string>("0"));
        const { host, dispose } = render(() => Box({ p: s.value, children: "x" }));
        const box = first(host);
        const others = (): string[] => box.getAttributeNames().filter((n) => n !== "class");
        const before = others();
        for (const v of seq) {
          s.value.set(v);
          await flush();
          expect(first(host)).toBe(box);
          expect(others()).toEqual(before);
          expect(box.className).toBe(`k-p-${v}`);
          expect(box.hasAttribute("style")).toBe(false);
        }
        dispose();
        s.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("responsive and state values may be signals; static classes stay", async () => {
    const s = scoped(() => signal<string>("1"));
    const { host, dispose } = render(() =>
      Box({ p: { base: "2", md: s.value }, states: { hover: { bg: s.value } }, class: "x" }),
    );
    const box = first(host);
    expect(box.className).toBe("k-p-2 k-md-p-1 k-hover-bg-1 x");
    s.value.set("3");
    await flush();
    expect(box.className).toBe("k-p-2 k-md-p-3 k-hover-bg-3 x");
    dispose();
    s.dispose();
  });

  it("a getter prop (compiled dynamic expression) is tracked like a signal", async () => {
    const s = scoped(() => signal<"1" | "2">("1"));
    const props = {
      get p(): "1" | "2" {
        return s.value.get();
      },
    };
    const { host, dispose } = render(() => Box(props));
    const box = first(host);
    expect(box.className).toBe("k-p-1");
    s.value.set("2");
    await flush();
    expect(box.className).toBe("k-p-2");
    dispose();
    s.dispose();
  });

  it("after dispose a signal write changes nothing", async () => {
    const s = scoped(() => signal<string>("1"));
    const { host, dispose } = render(() => Box({ p: s.value }));
    const box = first(host);
    dispose();
    s.value.set("3");
    await flush();
    expect(box.className).toBe("k-p-1");
    s.dispose();
  });

  it("static props set classes once and never a style attribute", () => {
    const { host, dispose } = render(() => Text({ fg: "fg", fontSize: "lg", as: "p", children: "t" }));
    expect(first(host).outerHTML).toBe('<p class="k-fg-fg k-fontSize-lg">t</p>');
    dispose();
  });

  it("styles() yields the same atomic classes as style props", () => {
    const css = styles({ card: { p: "3", radius: "1", states: { hover: { bg: "accent" } } }, empty: {} });
    expect(css).toEqual({ card: "k-p-3 k-radius-1 k-hover-bg-accent", empty: "" });
    const { host, dispose } = render(() => Box({ class: css.card }));
    expect(first(host).className).toBe(css.card);
    dispose();
  });
});

describe("base elements", () => {
  it("controls get a stable id from the label, or the given id, and a label for it", () => {
    const { host, dispose } = render(() =>
      Box({
        children: [
          Input({ label: "Full name" }),
          TextArea({ label: "Notes", id: "order.notes" }),
          Select({ label: "Kind", options: [{ value: "a", label: "A" }], value: "a" }),
          Checkbox({ label: "Agree!", checked: true }),
        ],
      }),
    );
    const ids = Array.from(host.querySelectorAll("input, textarea, select")).map((e) => e.id);
    expect(ids).toEqual(["k-input-full-name", "order.notes", "k-select-kind", "k-checkbox-agree"]);
    for (const id of ids) expect(host.querySelector(`label[for="${id}"]`)).not.toBeNull();
    expect(host.querySelector("select")?.value).toBe("a");
    expect(host.querySelector<HTMLInputElement>("input[type=checkbox]")?.checked).toBe(true);
    dispose();
  });

  it("equal labels get distinct ids, each label pointing at its own control", () => {
    const { host, dispose } = render(() =>
      Box({ children: [Input({ label: "Name" }), Input({ label: "Name" }), Input({ label: "Name" })] }),
    );
    const ids = Array.from(host.querySelectorAll("input")).map((e) => e.id);
    expect(ids).toEqual(["k-input-name", "k-input-name-2", "k-input-name-3"]);
    for (const id of ids) expect(host.querySelectorAll(`label[for="${id}"]`)).toHaveLength(1);
    dispose();
  });

  it("an id already in the document is skipped; the same render order gives the same ids", async () => {
    const run = async (): Promise<string[]> => {
      const pre = document.createElement("input");
      pre.id = "k-input-email";
      document.body.append(pre);
      await flush();
      const host = document.createElement("div");
      document.body.append(host);
      const dispose = mount(() => Box({ children: [Input({ label: "Email" }), Input({ label: "Email" })] }), host);
      const ids = Array.from(host.querySelectorAll("input")).map((e) => e.id);
      dispose();
      host.remove();
      pre.remove();
      await flush();
      return ids;
    };
    const a = await run();
    expect(a).toEqual(["k-input-email-2", "k-input-email-3"]);
    expect(await run()).toEqual(a);
  });

  it("derived ids are pure functions of the label", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (label) => {
        const a = render(() => Input({ label }));
        const id = a.host.querySelector("input")?.id ?? "";
        a.dispose();
        expect(id).toMatch(/^k-input-[a-z0-9-]+$/);
        await flush();
        const b = render(() => Input({ label }));
        expect(b.host.querySelector("input")?.id).toBe(id);
        b.dispose();
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("a reactive input value binds the value property", async () => {
    const s = scoped((): Signal<string> => signal("a"));
    const { host, dispose } = render(() => Input({ label: "N", value: s.value }));
    const input = host.querySelector("input");
    expect(input?.value).toBe("a");
    s.value.set("b");
    await flush();
    expect(input?.value).toBe("b");
    dispose();
    s.dispose();
  });

  it("Button: children with label sets aria-label; label alone is the text; type defaults to button", () => {
    const a = render(() => Button({ children: "x", label: "Close" }));
    expect(first(a.host).outerHTML).toBe('<button type="button" aria-label="Close">x</button>');
    const b = render(() => Button({ type: "submit", label: "Save" }));
    expect(first(b.host).outerHTML).toBe('<button type="submit">Save</button>');
    a.dispose();
    b.dispose();
  });

  it("disabled sets the attribute on Button and controls, and binds when reactive", async () => {
    const d = scoped((): Signal<boolean> => signal(false));
    const { host, dispose } = render(() =>
      Box({
        children: [
          Button({ label: "Go", disabled: true }),
          Input({ label: "A", disabled: true }),
          TextArea({ label: "B", disabled: d.value }),
          Select({ label: "C" }),
          Checkbox({ label: "D", disabled: true }),
        ],
      }),
    );
    const dis = (): string[] => Array.from(host.querySelectorAll("[disabled]")).map((e) => e.tagName.toLowerCase());
    expect(dis()).toEqual(["button", "input", "input"]);
    d.value.set(true);
    await flush();
    expect(host.querySelector("textarea")?.disabled).toBe(true);
    dispose();
    d.dispose();
  });

  it("Image decorative renders alt='' and role=presentation", () => {
    const { host, dispose } = render(() => Image({ decorative: true }));
    expect(first(host).outerHTML).toBe('<img alt="" role="presentation">');
    dispose();
  });

  it("Link and Image URLs with a disallowed scheme render about:blank", () => {
    // Href forbids this at the type level; the guard models a value that slipped past it at runtime.
    const slipped = (x: string): x is Href => x.length > 0;
    const evil = "javascript:alert(1)";
    if (!slipped(evil)) throw new Error("unreachable");
    const { host, dispose } = render(() =>
      Box({ children: [Link({ to: evil, children: "l" }), Image({ alt: "i", src: evil })] }),
    );
    expect(host.querySelector("a")?.getAttribute("href")).toBe("about:blank");
    expect(host.querySelector("img")?.getAttribute("src")).toBe("about:blank");
    dispose();
  });

  it("text children become text nodes, never markup", () => {
    const { host, dispose } = render(() => Text({ children: ['<img src=x onerror="1">', 2] }));
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe('<img src=x onerror="1">2');
    dispose();
  });
});
