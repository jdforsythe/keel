// @vitest-environment happy-dom
// Examples (k.mount Form, Navigation): a Form no router matches validates its handle, then lets the browser post, a
// chosen file throws E1583, a back-forward cache restore clears pending; a router leaves for a path its table lacks
// (`navigate`, `ok(href)`, a link click) and keeps the 404 for a pop. No generated inputs (seed 1337 unused).
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { identityMount } from "../src/identityMount.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { formHandle } from "../src/internal/formHandle.ts";
import { manifest } from "../src/manifest.ts";
import type { FormHandle } from "../src/types/FormHandle.ts";
import { memoryHistory } from "./memoryHistory.ts";

const ctx = createCtx({ mode: "sim", seed: 1337 });
const auth = identityMount("/auth");
const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const handleOf = (log: string[], valid: () => boolean): FormHandle => ({
  [formHandle]: {
    setPending: (v) => void log.push(`pending:${String(v)}`),
    onResult: () => void log.push("result"),
    validate: () => {
      log.push("validate");
      return valid() ? ok(null) : err({ code: "schema.invalid", message: "x", data: { issues: [] } });
    },
  },
});
const submit = (f: Element | null): Event => {
  const e = new Event("submit", { bubbles: true, cancelable: true });
  f?.dispatchEvent(e);
  return e;
};

/** Mounts `view` (no router), returning the host and `unmount`. */
function host(view: () => Node) {
  const h = document.createElement("div");
  document.body.append(h);
  const unmount = mount(view, h, { ctx });
  return {
    h,
    stop: () => {
      unmount();
      h.remove();
    },
  };
}

describe("a Form no router matches posts natively", () => {
  it("validates first: invalid prevents the submit; valid lets it through with pending true", () => {
    const log: string[] = [];
    let valid = false;
    const t = host(() => Form({ method: "POST", action: auth.href("/in"), form: handleOf(log, () => valid) }));
    const form = t.h.querySelector("form");
    expect(submit(form).defaultPrevented).toBe(true);
    expect(log).toEqual(["validate"]);
    valid = true;
    expect(submit(form).defaultPrevented).toBe(false);
    expect(log).toEqual(["validate", "validate", "pending:true"]);
    expect(form?.querySelector('input[name="_method"]')).toBeNull();
    t.stop();
  });

  it("a back-forward cache `pageshow` clears pending; a plain one and one before any submit do not", () => {
    const log: string[] = [];
    const t = host(() => Form({ method: "POST", action: auth.href(), form: handleOf(log, () => true) }));
    const show = (persisted: boolean): void => {
      const e = new Event("pageshow");
      Object.defineProperty(e, "persisted", { value: persisted });
      window.dispatchEvent(e);
    };
    show(true);
    expect(log).toEqual([]);
    submit(t.h.querySelector("form"));
    show(false);
    show(true);
    expect(log).toEqual(["validate", "pending:true", "pending:false"]);
    t.stop();
    show(true);
    expect(log).toHaveLength(3);
  });

  it("a chosen file prevents the submit and throws E1583 before validation; none chosen does not", () => {
    const log: string[] = [];
    const file = document.createElement("input");
    file.type = "file";
    const t = host(() =>
      Form({ method: "POST", action: auth.href("/up"), form: handleOf(log, () => true), children: () => file }),
    );
    const form = t.h.querySelector("form");
    expect(submit(form).defaultPrevented).toBe(false);
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "a.txt"));
    file.files = transfer.files;
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent): void => {
      errors.push(e.error);
      e.preventDefault();
    };
    window.addEventListener("error", onError);
    try {
      form?.dispatchEvent(ev);
    } catch (e) {
      errors.push(e);
    }
    window.removeEventListener("error", onError);
    expect(errors.map((e) => (e instanceof Error && "code" in e ? e.code : e))).toEqual(["E1583"]);
    expect(ev.defaultPrevented).toBe(true);
    expect(log).toEqual(["validate", "pending:true"]);
    t.stop();
  });
});

describe("a router keeps client-side only the pages its table matches", () => {
  const page = (): Node => document.createElement("main");
  const nf = contract("nf", { "nf.home": { path: "/" }, "nf.act": { path: "/act" } });
  const act = action(nf, "nf.act", { input: s.object({}) }, async () => ok(auth.href("/done")));
  const poster = (): Node => Form({ method: "POST", action: nf.href("nf.act") });
  const routes = manifest(nf, { "nf.home": { component: page }, "nf.act": { component: poster, POST: act } });

  function start(url: string) {
    const left: [string, boolean][] = [];
    const history = memoryHistory(url);
    const router = createRouterWith(routes, { ctx, history, leave: (u, r) => void left.push([u, r]) });
    const t = host(router.App);
    return { left, history, router, t };
  }

  it("`navigate` and `replace` to an unmatched path leave by assign and replace and keep the page", async () => {
    const r = start("/");
    await settle();
    await r.router.navigate(auth.href("/x"));
    await r.router.navigate(auth.href("/y"), { replace: true });
    expect(r.left).toEqual([
      ["/auth/x", false],
      ["/auth/y", true],
    ]);
    expect(r.router.route.get()).toMatchObject({ id: "nf.home", pending: false });
    expect(r.history.entries).toEqual(["/"]);
    r.t.stop();
    r.router.dispose();
  });

  it("an action's ok(href) to an unmatched path leaves; the page stays", async () => {
    const r = start("/act");
    await settle();
    const form = r.t.h.querySelector("form");
    submit(form);
    await settle();
    expect(r.left).toEqual([["/auth/done", false]]);
    expect(r.router.route.get()).toMatchObject({ id: "nf.act", pending: false });
    r.t.stop();
    r.router.dispose();
  });

  it("an initial load of an unmatched path renders the 404 and leaves nothing", async () => {
    const r = start("/auth/in");
    await settle();
    expect(r.left).toEqual([]);
    expect(r.router.route.get().id).toBeNull();
    r.t.stop();
    r.router.dispose();
  });

  it("a click on a link to an unmatched path is left to the browser; one to a page is taken", async () => {
    const r = start("/");
    await settle();
    let seen: boolean | null = null;
    const click = (href: string): boolean | null => {
      const a = document.createElement("a");
      a.setAttribute("href", href);
      r.t.h.append(a);
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      a.remove();
      return seen;
    };
    const stop = (e: Event): void => {
      seen = e.defaultPrevented;
      e.preventDefault();
    };
    window.addEventListener("click", stop);
    expect(click("/auth/login")).toBe(false);
    expect(click("/act")).toBe(true);
    window.removeEventListener("click", stop);
    await settle();
    expect(r.router.route.get().id).toBe("nf.act");
    r.t.stop();
    r.router.dispose();
  });
});
