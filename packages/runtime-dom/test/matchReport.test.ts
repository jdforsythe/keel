// @vitest-environment happy-dom
// match: resource state reports to ctx observers, a throwing discriminant reaches the Boundary, unknown tags render nothing.
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { inspect, resource, scope } from "@keel/reactive";
import type { Resource, Settled } from "@keel/reactive";
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { clone, match, template } from "../src/ops/index.ts";
import { rootSignal } from "./support.ts";
import { testCtx } from "./testCtx.ts";

const T = template('<div id="d"><!----></div>');
const I = template("<i></i>");
const anchorOf = (el: Element): Node => {
  const a = el.lastChild;
  if (a === null) throw new Error("no anchor");
  return a;
};
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const watched = (): { ctx: ReturnType<typeof createCtx>; events: CtxEvent[] } => {
  const ctx = createCtx({ seed: 1, mode: "sim" });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  return { ctx, events };
};
const label = (s: string) => (): Node => {
  const i = clone(I);
  i.textContent = s;
  return i;
};
const cases = { loading: label("L"), ready: label("R"), error: label("E") };
const made = <T>(fetcher: () => Promise<T>): Resource<Settled<T>> => {
  const box: { r: Resource<Settled<T>> | null } = { r: null };
  scope(() => {
    box.r = resource(fetcher);
  });
  if (box.r === null) throw new Error("scope did not run");
  return box.r;
};
const resourceId = (): string => {
  const ids = inspect().nodes.filter((n) => n.kind === "resource");
  const last = ids[ids.length - 1];
  if (last === undefined) throw new Error("no resource");
  return String(last.id);
};

describe("match over a resource", () => {
  it("reports each rendered state with the resource's inspect id: loading then ready", async () => {
    const { ctx, events } = watched();
    const res = made(() => Promise.resolve(1));
    const id = resourceId();
    const host = document.createElement("div");
    const dispose = mount(
      () => {
        const d = clone(T);
        match(anchorOf(d), () => res.get(), "state", cases);
        return d;
      },
      host,
      { ctx },
    );
    expect(host.textContent).toBe("L");
    await tick();
    expect(host.textContent).toBe("R");
    expect(events.filter((e) => e.kind === "resource")).toEqual([
      { kind: "resource", id, state: "loading" },
      { kind: "resource", id, state: "ready" },
    ]);
    dispose();
  });

  it("reports the error state", async () => {
    const { ctx, events } = watched();
    const res = made<number>(() => Promise.reject(new Error("no")));
    const id = resourceId();
    const host = document.createElement("div");
    const dispose = mount(
      () => {
        const d = clone(T);
        match(anchorOf(d), () => res.get(), "state", cases);
        return d;
      },
      host,
      { ctx },
    );
    await tick();
    expect(host.textContent).toBe("E");
    expect(events.filter((e) => e.kind === "resource").map((e) => (e.kind === "resource" ? e.state : ""))).toEqual([
      "loading",
      "error",
    ]);
    expect(events.filter((e) => e.kind === "resource").every((e) => e.kind === "resource" && e.id === id)).toBe(true);
    dispose();
  });

  it("reports nothing for another key, for a plain value, or when the tag is not a resource state", async () => {
    const { ctx, events } = watched();
    const res = made(() => Promise.resolve(1));
    const plain = rootSignal<{ state: string }>({ state: "ready" });
    const host = document.createElement("div");
    const dispose = mount(
      () => {
        const d = clone(T);
        match(anchorOf(d), () => ({ kind: res.get().state }), "kind", cases);
        const e = clone(T);
        match(anchorOf(e), () => plain.get(), "state", { ...cases, odd: label("O") });
        d.appendChild(e);
        return d;
      },
      host,
      { ctx },
    );
    await tick();
    plain.set({ state: "odd" });
    expect(host.textContent).toContain("O");
    expect(events.filter((e) => e.kind === "resource")).toEqual([]);
    dispose();
  });

  it("reports nothing when no observer is attached", async () => {
    const ctx = createCtx({ seed: 1, mode: "sim" });
    const res = made(() => Promise.resolve(1));
    const host = document.createElement("div");
    const dispose = mount(
      () => {
        const d = clone(T);
        match(anchorOf(d), () => res.get(), "state", cases);
        return d;
      },
      host,
      { ctx },
    );
    await tick();
    expect(host.textContent).toBe("R");
    dispose();
  });
});

describe("match: tags and errors", () => {
  it("renders nothing for a tag with no case, own properties only", () => {
    const tag = rootSignal<{ tag: string }>({ tag: "a" });
    const host = document.createElement("div");
    const dispose = mount(
      () => {
        const d = clone(T);
        match(anchorOf(d), () => tag.get(), "tag", { a: label("A") });
        return d;
      },
      host,
      { ctx: testCtx },
    );
    expect(host.textContent).toBe("A");
    for (const t of ["zzz", "constructor", "toString", "__proto__"]) {
      tag.set({ tag: t });
      expect(host.textContent).toBe("");
    }
    tag.set({ tag: "a" });
    expect(host.textContent).toBe("A");
    dispose();
  });

  it("a discriminant that throws reaches the root Boundary and is reported once", () => {
    const boom = rootSignal(0);
    const seen: unknown[] = [];
    const host = document.createElement("div");
    const dispose = mount(
      () => {
        const d = clone(T);
        match(
          anchorOf(d),
          () => {
            if (boom.get() > 0) throw new Error("bad on");
            return { tag: "a" };
          },
          "tag",
          { a: label("A") },
        );
        return d;
      },
      host,
      { ctx: testCtx, onError: (e) => seen.push(e), mode: "dev" },
    );
    expect(host.textContent).toBe("A");
    boom.set(1);
    expect(seen).toHaveLength(1);
    expect(host.querySelector("[data-k-error]")?.textContent).toBe("bad on");
    dispose();
  });

  it("outside a render, naming the op", () => {
    expect(() => match(document.createComment(""), () => ({ tag: "a" }), "tag", {})).toThrow(
      "k.runtime: match() called outside a mount or resume render",
    );
  });
});
