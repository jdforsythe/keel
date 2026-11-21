// @vitest-environment happy-dom
// k.router Links: a link is followed only when it is an `Href`. In the client router an action's `ok` value that is
// no `Href` is `keel.unexpected` given to the Form (no navigation, no document navigation, no history entry);
// `navigate` of one rejects with E1501 and nothing moves; a `Form` whose `action` is none throws E1501.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { isHref } from "../src/internal/isHref.ts";
import { manifest } from "../src/manifest.ts";
import type { Href } from "../src/types/Href.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const slipped = (v: string): v is Href => v.length >= 0;
const raw = (v: string): Href => {
  if (!slipped(v)) throw new Error("unreachable");
  return v;
};
const HOSTILE = ["//evil.example/x", "/\\evil.example", "https://evil.example/", "javascript:alert(1)", "/a\u0001b"];
const c = contract("al", { "al.page": { path: "/al" }, "al.next": { path: "/al/next" } });
let next: string | null = null;
const routes = manifest(c, {
  "al.page": {
    component: () => {
      const b = document.createElement("button");
      b.type = "submit";
      const f = Form({
        method: "POST",
        action: c.href("al.page"),
        error: (e) => {
          const p = document.createElement("p");
          p.setAttribute("data-x", "error");
          p.textContent = `${e.code} ${e.message}`;
          return p;
        },
        children: () => [b],
      });
      return f;
    },
    POST: action(c, "al.page", { input: s.object({}) }, () => ok(next === null ? null : raw(next))),
  },
  "al.next": { component: () => document.createElement("main") },
});

const open = async () => {
  const left: string[] = [];
  const history = memoryHistory("/al");
  const ctx = createCtx({ mode: "sim" });
  const router = createRouterWith(routes, { ctx, history, leave: (u) => void left.push(u) });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx });
  await settle();
  return {
    left,
    history,
    router,
    host,
    done: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
};

describe("a link that is no Href is never followed", () => {
  it.each(HOSTILE)("an action returning %j shows keel.unexpected in the Form and moves nothing", async (to) => {
    next = to;
    const t = await open();
    t.host.querySelector("form")?.requestSubmit();
    await settle();
    expect(t.left).toEqual([]);
    expect(t.history.entries).toEqual(["/al"]);
    expect(t.router.route.get()).toMatchObject({ id: "al.page", pending: false });
    const shown = t.host.querySelector('[data-x="error"]')?.textContent ?? "";
    expect(shown).toBe("keel.unexpected unexpected");
    t.done();
  });

  it("an action returning an Href still navigates to it", async () => {
    next = c.href("al.next");
    const t = await open();
    t.host.querySelector("form")?.requestSubmit();
    await settle();
    expect([t.router.route.get().id, t.history.entries, t.left]).toEqual(["al.next", ["/al", "/al/next"], []]);
    t.done();
  });

  it.each(HOSTILE)("navigate(%j) rejects with E1501 and nothing moves", async (to) => {
    const t = await open();
    await expect(t.router.navigate(raw(to))).rejects.toMatchObject({ code: "E1501" });
    await settle();
    expect([t.left, t.history.entries, t.router.route.get().id]).toEqual([[], ["/al"], "al.page"]);
    t.done();
  });

  it("navigate reads a `\\` as `/` and drops a hash first: `/al/next#top` navigates, `/a/\\x` leaves on the origin", async () => {
    const t = await open();
    await t.router.navigate(raw("/al/next#top"));
    await settle();
    expect(t.router.route.get().id).toBe("al.next");
    await t.router.navigate(raw("/a/\\x"));
    await expect(t.router.navigate(raw("/\\/x"))).rejects.toMatchObject({ code: "E1501" });
    await expect(t.router.navigate(raw("/\t/evil.example"))).rejects.toMatchObject({ code: "E1501" });
    expect(t.left).toEqual(["/a/\\x"]);
    t.done();
  });

  it.each(HOSTILE)("a Form with action %j throws E1501", (to) => {
    expect(() => Form({ method: "POST", action: raw(to), children: () => [] })).toThrow(
      expect.objectContaining({ code: "E1501" }),
    );
  });

  it("isHref refuses C0, DEL and C1 control characters", () => {
    for (const ch of ["\u0000", "\u001f", "\u007f", "\u0080", "\u0085", "\u009f"])
      expect(isHref(`/a${ch}b`)).toBe(false);
    expect(isHref("/a b")).toBe(true);
  });
});
