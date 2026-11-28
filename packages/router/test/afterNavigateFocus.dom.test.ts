// @vitest-environment happy-dom
// k.head Client: where focus goes after a navigation. To another route: the page's first h1 inside main, else main.
// Within one route: it stays; when the navigation removed the focused element, the element with its id, else the
// page's first role="status" region, else main. The kernel's focus never scrolls.
import { afterEach, describe, expect, it, vi } from "vitest";
import { afterNavigate } from "../src/internal/afterNavigate.ts";

const make = (tag: string, id = ""): HTMLElement => {
  const e = document.createElement(tag);
  if (id !== "") e.id = id;
  return e;
};
/** A root in the document holding `kids`, removed after the test. */
const roots: HTMLElement[] = [];
const page = (...kids: Node[]): HTMLElement => {
  const root = make("div");
  root.append(...kids);
  document.body.append(root);
  roots.push(root);
  return root;
};
const microtasks = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

afterEach(() => {
  for (const r of roots.splice(0)) r.remove();
  vi.restoreAllMocks();
});

describe("afterNavigate to another route", () => {
  it("focuses the first h1 inside main, marked tabindex -1, without scrolling to it", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const outside = make("h1");
    const inside = make("h1");
    const main = make("main");
    main.append(make("p"), inside);
    const focus = vi.spyOn(inside, "focus");
    page(outside, main);
    afterNavigate(roots[0] ?? null, "/x");
    expect(document.activeElement).toBe(inside);
    expect(inside.getAttribute("tabindex")).toBe("-1");
    expect(outside.hasAttribute("tabindex")).toBe(false);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("with no main, focuses the root's first h1; with no h1, main", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const h1 = make("h1");
    const bare = page(make("p"), h1);
    afterNavigate(bare, "/x");
    expect(document.activeElement).toBe(h1);
    const main = make("main");
    const other = page(main);
    afterNavigate(other, "/x");
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute("tabindex")).toBe("-1");
  });
});

describe("afterNavigate within one route", () => {
  it("leaves focus where it is while the focused element is still in the page", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const input = make("input", "q");
    const h1 = make("h1");
    const main = make("main");
    main.append(h1, input);
    const root = page(main);
    input.focus();
    afterNavigate(root, "/x?q=1", input, "/x");
    expect(document.activeElement).toBe(input);
    expect(h1.hasAttribute("tabindex")).toBe(false);
    expect(main.hasAttribute("tabindex")).toBe(false);
    afterNavigate(root, "/x?q=2", null, "/x");
    expect(document.activeElement).toBe(input);
  });

  it("moves to the element with the removed one's id, without marking it", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const old = make("input", "field");
    const main = make("main");
    main.append(old);
    const root = page(main);
    old.focus();
    old.remove();
    const again = make("input", "field");
    main.append(again);
    const focus = vi.spyOn(again, "focus");
    afterNavigate(root, "/x?q=1", old, "/x");
    expect(document.activeElement).toBe(again);
    expect(again.hasAttribute("tabindex")).toBe(false);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("with no element of that id, moves to the first status region inside main, else main, once a widget had its turn", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const old = make("button", "gone");
    const outside = make("p");
    outside.setAttribute("role", "status");
    const status = make("p");
    status.setAttribute("role", "status");
    const main = make("main");
    main.append(old, status);
    const root = page(outside, main);
    old.focus();
    old.remove();
    afterNavigate(root, "/x?q=1", old, "/x");
    expect(document.activeElement).not.toBe(status);
    await microtasks();
    expect(document.activeElement).toBe(status);
    expect(status.getAttribute("tabindex")).toBe("-1");
    expect(outside.hasAttribute("tabindex")).toBe(false);

    const lone = make("button");
    const plain = make("main");
    plain.append(lone);
    const second = page(plain);
    lone.focus();
    lone.remove();
    afterNavigate(second, "/x?q=2", lone, "/x");
    await microtasks();
    expect(document.activeElement).toBe(plain);
    expect(plain.getAttribute("tabindex")).toBe("-1");
  });

  it("leaves focus with a widget that took it before the status region's turn", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const old = make("button", "gone");
    const taker = make("button");
    const status = make("p");
    status.setAttribute("role", "status");
    const main = make("main");
    main.append(old, taker, status);
    const root = page(main);
    old.focus();
    old.remove();
    afterNavigate(root, "/x?q=1", old, "/x");
    taker.focus();
    await microtasks();
    expect(document.activeElement).toBe(taker);
    expect(status.hasAttribute("tabindex")).toBe(false);
  });

  it("keeps scroll for a search-only navigation and scrolls to the top when the path changes", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const root = page(make("main"));
    afterNavigate(root, "/x?q=1", null, "/x");
    afterNavigate(root, "/x?q=1#", null, "/x?q=0");
    expect(scrollTo).not.toHaveBeenCalled();
    afterNavigate(root, "/y?q=1", null, "/x");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
