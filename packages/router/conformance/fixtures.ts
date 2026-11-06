// Shared fixtures for k.router conformance. Property seed: 1337.
// ASSUMPTIONS (the spec names no router-instance API; a human should confirm or amend):
//  - createRouter(routes, { ctx, history }) from @keel/router returns { navigate, route, dispose, App };
//    route is a reactive computed read with route.get(); App is a no-prop root component for mount(App, el).
//  - history is in-memory { push(url), replace(url), current(), onPop(fn(url)) }; this file adds test-only
//    back(), forward() and external(url) (a URL change from outside the router, delivered through onPop).
//  - loader/action/guard/manifest/href/Form/createRouter all come from @keel/router.
//  - components are (props) => Node; a layout receives { children: Node }; errorElement receives { error };
//    Form is called as a function with props and a single Node as children.
import { createCtx } from "@keel/ctx";
import { Form, action, createRouter, guard, href, loader, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { type Infer, err, ok, s } from "@keel/schema";

export const SEED = 1337;
export const RUNS = 100;

export type Verb = "POST" | "PUT" | "PATCH" | "DELETE";
export const VERBS: readonly Verb[] = ["POST", "PUT", "PATCH", "DELETE"];

// ---- schemas
export const OrderId = s.id("Order");
export const OrderParams = s.object({ id: OrderId });
export const LineParams = s.object({ id: OrderId, line: s.int({ min: 0, max: 1000 }) });
export const ShowSearch = s.object({ tab: s.enum(["items", "history"]).optional() });
export const ListSearch = s.object({
  page: s.int({ min: 0, max: 1000 }).optional(),
  q: s.string({ min: 1, max: 8 }).optional(),
  sort: s.enum(["asc", "desc"]).optional(),
});
export const LoginSearch = s.object({ next: s.string().optional() });
export const OrderEdit = s.object({ note: s.string({ min: 0, max: 20 }) });
const Title = s.object({ title: s.string() });
const Empty = s.object({});

export const Locked = s.error("orders.locked", s.object({}));
export const Broken = s.error("orders.broken", s.object({}));
export const Denied = s.error("keel.denied", s.object({}));

// Ids that survive a URL path segment: non-empty and not a dot segment (URL parsing normalises those).
export const usableId = (v: string): boolean => v.length > 0 && v !== "." && v !== "..";
export const idOf = (raw: string): Infer<typeof OrderId> => {
  const r = OrderId.parse(raw);
  if (!r.ok) throw new Error("fixture: id rejected");
  return r.value;
};

// ---- observation: counters, ordered log, and knobs
export type Control = {
  gate: boolean;
  show: "ok" | "err";
  outcome: "null" | "href";
  verb: Verb;
  hold: Promise<void> | null;
  lastInput: unknown;
};
export const control: Control = { gate: true, show: "ok", outcome: "null", verb: "POST", hold: null, lastInput: null };
const counts = new Map<string, number>();
export const log: string[] = [];
const bump = (name: string): void => {
  counts.set(name, (counts.get(name) ?? 0) + 1);
  log.push(name);
};
export const count = (name: string): number => counts.get(name) ?? 0;
export const total = (prefix: string): number => {
  let n = 0;
  for (const [k, v] of counts) if (k.startsWith(prefix)) n += v;
  return n;
};
export const resetObservations = (): void => {
  counts.clear();
  log.length = 0;
  control.gate = true;
  control.show = "ok";
  control.outcome = "null";
  control.verb = "POST";
  control.hold = null;
  control.lastInput = null;
};
export const defer = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
// Microtask-only quiescence (no timers).
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};

// ---- components (hand-built DOM)
export const el = (tag: string, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElement => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};
type Props = { params: unknown; search: unknown; data: unknown };
const page =
  (id: string) =>
  (_: Props): Node => {
    bump(`render:${id}`);
    return el("section", { "data-page": id }, id);
  };
const errorElement =
  (id: string) =>
  (p: { error: { code: string } }): Node => {
    bump(`error:${id}`);
    return el("p", { "data-error": id, "data-code": p.error.code }, p.error.code);
  };
const AppShell = (p: { children: Node }): Node => el("div", { "data-layout": "app.shell" }, el("main", {}, p.children));
const OrdersShell = (p: { children: Node }): Node => el("div", { "data-layout": "orders.shell" }, p.children);
const GuardedShell = (p: { children: Node }): Node => el("div", { "data-layout": "guarded.shell" }, p.children);
const OrderPage = (p: { params: Infer<typeof OrderParams>; search: unknown; data: unknown }): Node => {
  bump("render:orders.show");
  const fields = el(
    "div",
    {},
    el("input", { name: "note", id: "note", value: "hello" }),
    el("button", { type: "submit" }, "Save"),
  );
  return el(
    "section",
    { "data-page": "orders.show" },
    Form({ method: control.verb, action: "orders.show", params: p.params, children: fields }),
  );
};

// ---- loaders, actions, guards (server functions run in the browser for a client-only app)
const load = (name: string) =>
  loader(Empty, async () => {
    bump(`loader:${name}`);
    return ok({});
  });
const loadShell = loader(Title, async () => {
  bump("loader:orders.shell");
  return ok({ title: "shell" });
});
const loadShow = loader(Title, async () => {
  bump("loader:orders.show");
  return control.show === "err" ? err(Locked.make({})) : ok({ title: "order" });
});
const loadBare = loader(Empty, async () => {
  bump("loader:orders.bare");
  return err(Broken.make({}));
});
const loadSlow = loader(Empty, async () => {
  bump("loader:slow.page");
  await control.hold;
  return ok({});
});
const act = (verb: Verb) =>
  action(OrderEdit, async (input) => {
    bump(`action:${verb}`);
    control.lastInput = input;
    return control.outcome === "href" ? ok(href("orders.list")) : ok(null);
  });
guard("auth", { redirect: "app.login" }, async () => {
  bump("guard:auth");
  return control.gate ? ok(null) : err(Denied.make({}));
});
guard("g.outer", { redirect: "app.login" }, async () => {
  bump("guard:g.outer");
  return ok(null);
});
guard("g.inner", { redirect: "app.login" }, async () => {
  bump("guard:g.inner");
  return ok(null);
});

export const routes = manifest({
  "app.shell": { component: AppShell },
  "orders.shell": {
    component: OrdersShell,
    layout: "app.shell",
    loader: loadShell,
    errorElement: errorElement("orders.shell"),
  },
  "guarded.shell": { component: GuardedShell, layout: "app.shell", guard: "g.outer" },
  "app.home": { path: "/", component: page("app.home"), layout: "app.shell" },
  "app.login": { path: "/login", search: LoginSearch, component: page("app.login"), layout: "app.shell" },
  "orders.list": { path: "/orders", search: ListSearch, component: page("orders.list"), layout: "orders.shell" },
  "orders.new": { path: "/orders/new", component: page("orders.new"), layout: "orders.shell" },
  "orders.bare": { path: "/orders/bare", component: page("orders.bare"), layout: "orders.shell", loader: loadBare },
  "orders.show": {
    path: "/orders/:id",
    params: OrderParams,
    search: ShowSearch,
    loader: loadShow,
    actions: { POST: act("POST"), PUT: act("PUT"), PATCH: act("PATCH"), DELETE: act("DELETE") },
    component: OrderPage,
    layout: "orders.shell",
    errorElement: errorElement("orders.show"),
  },
  "orders.line": {
    path: "/orders/:id/lines/:line",
    params: LineParams,
    loader: load("orders.line"),
    component: page("orders.line"),
    layout: "orders.shell",
    errorElement: errorElement("orders.line"),
  },
  "secret.show": {
    path: "/secret/:id",
    params: OrderParams,
    loader: load("secret.show"),
    component: page("secret.show"),
    layout: "app.shell",
    guard: "auth",
  },
  "guarded.page": {
    path: "/guarded",
    loader: load("guarded.page"),
    component: page("guarded.page"),
    layout: "guarded.shell",
    guard: "g.inner",
  },
  "slow.page": { path: "/slow", loader: loadSlow, component: page("slow.page"), layout: "app.shell" },
});

// ---- in-memory history
export type MemoryHistory = {
  push(url: string): void;
  replace(url: string): void;
  current(): string;
  onPop(fn: (url: string) => void): void;
  back(): void;
  forward(): void;
  external(url: string): void;
};
export function memoryHistory(start: string): MemoryHistory {
  const entries: string[] = [start];
  let at = 0;
  const subs: ((url: string) => void)[] = [];
  const current = (): string => entries[at] ?? start;
  const pop = (): void => {
    for (const fn of subs) fn(current());
  };
  const push = (url: string): void => {
    entries.splice(at + 1);
    entries.push(url);
    at += 1;
  };
  return {
    push,
    replace: (url) => {
      entries[at] = url;
    },
    current,
    onPop: (fn) => {
      subs.push(fn);
    },
    back: () => {
      if (at > 0) at -= 1;
      pop();
    },
    forward: () => {
      if (at < entries.length - 1) at += 1;
      pop();
    },
    external: (url) => {
      push(url);
      pop();
    },
  };
}

// ---- app harness
export type Router = ReturnType<typeof createRouter>;
export type Started = { router: Router; history: MemoryHistory; host: HTMLElement; stop: () => void };
export async function start(at: string, opts: { render?: boolean } = {}): Promise<Started> {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const history = memoryHistory(at);
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = opts.render === true ? mount(router.App, host) : () => {};
  await settle();
  return {
    router,
    history,
    host,
    stop: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
}
export const now = (r: Router) => r.route.get();
export async function submit(host: HTMLElement): Promise<void> {
  const form = host.querySelector("form");
  if (form === null) throw new Error("fixture: no form rendered");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
}
