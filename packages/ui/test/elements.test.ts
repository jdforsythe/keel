// @vitest-environment happy-dom
// Base elements: dynamic classes (signals and getter props), ids, a11y attributes, URL safety. Seed 1337.
import { scope, signal } from "@keel/reactive";
import type { Signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Select, Text, TextArea, styles } from "@keel/ui";
import type { Href } from "@keel/ui";
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
    const { host, dispose } = render(() => Box({ p: { base: "2", md: s.value }, hover: { bg: s.value }, class: "x" }));
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
    expect(host.innerHTML).toBe('<p class="k-fg-fg k-fontSize-lg">t</p>');
    dispose();
  });

  it("styles() yields the same atomic classes as style props", () => {
    const css = styles({ card: { p: "3", radius: "1", hover: { bg: "accent" } }, empty: {} });
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

  it("derived ids are pure functions of the label", () => {
    fc.assert(
      fc.property(fc.string(), (label) => {
        const a = render(() => Input({ label }));
        const b = render(() => Input({ label }));
        const id = a.host.querySelector("input")?.id ?? "";
        expect(id).toBe(b.host.querySelector("input")?.id);
        expect(id).toMatch(/^k-input-[a-z0-9-]+$/);
        a.dispose();
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
    expect(a.host.innerHTML).toBe('<button type="button" aria-label="Close">x</button>');
    const b = render(() => Button({ type: "submit", label: "Save" }));
    expect(b.host.innerHTML).toBe('<button type="submit">Save</button>');
    a.dispose();
    b.dispose();
  });

  it("Image decorative renders alt='' and role=presentation", () => {
    const { host, dispose } = render(() => Image({ decorative: true }));
    expect(host.innerHTML).toBe('<img alt="" role="presentation">');
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

  it("Heading rejects levels outside 1..6 with E1802", () => {
    expect(() => Heading({ level: 7, children: "x" })).toThrow(expect.objectContaining({ code: "E1802" }));
  });

  it("text children become text nodes, never markup", () => {
    const { host, dispose } = render(() => Text({ children: ['<img src=x onerror="1">', 2] }));
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe('<img src=x onerror="1">2');
    dispose();
  });
});
