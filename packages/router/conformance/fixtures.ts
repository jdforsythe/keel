// Shared fixtures for k.router conformance. Property seed: 1337.
// ASSUMPTIONS (the spec names no router-instance API; a human should confirm or amend):
//  - createRouter(routes, { ctx, history }) from @keel/router returns { navigate, route, dispose, App };
//    route is a reactive computed read with route.get(); App is a no-prop root component for mount(App, el, { ctx }).
//  - history is in-memory { push(url, key), replace(url, key), current(), onPop(fn(url, key?)) } (RFC 0041): each
//    entry is stored as { url, key } and back()/forward() deliver fn(url, key); this file adds test-only
//    back(), forward() and external(url) (a URL change from outside the router, delivered through onPop with no key).
//  - loader/action/guard/manifest/Form/createRouter come from @keel/router; links come from a contract's href (RFC 0157); the fixture is one contract, `app`, whose ids are `app.<name>`.
//  - guards are values (guard({ redirect }, fn)), held by routes as `guard: <value>`.
//  - components are (props) => Node; a layout receives { children } (RFC 0008: a thunk, a plain Node also tolerated);
//    errorElement receives { error }; Form is called as a function with props and children (thunk or plain Node).
import { createCtx } from "@keel/ctx";
import { Form, type Href, action, createRouter, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { type Infer, err, ok, s } from "@keel/schema";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

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
type Kids = { children?: Node | (() => Node | Node[] | string) };
const kids = (p: Kids): Node | Node[] | string => {
  const c = p.children;
  return typeof c === "function" ? c() : (c ?? []);
};
const AppShell = (p: Kids): Node => el("div", { "data-layout": "app.shell" }, el("main", {}, ...[kids(p)].flat()));
const OrdersShell = (p: Kids): Node => el("div", { "data-layout": "orders.shell" }, ...[kids(p)].flat());
const GuardedShell = (p: Kids): Node => el("div", { "data-layout": "guarded.shell" }, ...[kids(p)].flat());
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
    Form({ method: control.verb, action: appContract.href("app.ordersShow", p.params), children: () => [fields] }),
  );
};

// ---- the contract: one module, `app`, holding every route of the fixture (k.contract, RFC 0157)
export const appContract = contract("app", {
  "app.shell": { layout: true },
  "app.ordersShell": { layout: true },
  "app.guardedShell": { layout: true },
  "app.home": { path: "/" },
  "app.login": { path: "/login", search: LoginSearch },
  "app.ordersList": { path: "/orders", search: ListSearch },
  "app.ordersNew": { path: "/orders/new" },
  "app.ordersBare": { path: "/orders/bare" },
  "app.ordersShow": { path: "/orders/:id", params: OrderParams, search: ShowSearch },
  "app.ordersLine": { path: "/orders/:id/lines/:line", params: LineParams },
  "app.secretShow": { path: "/secret/:id", params: OrderParams },
  "app.guardedPage": { path: "/guarded" },
  "app.slowPage": { path: "/slow" },
});

// ---- loaders, actions, guards (server functions run in the browser for a client-only app)
const load = (name: string) =>
  loader(appContract, "app.ordersLine", { output: Empty }, async () => {
    bump(`loader:${name}`);
    return ok({});
  });
const loadSecret = loader(appContract, "app.secretShow", { output: Empty }, async () => {
  bump("loader:secret.show");
  return ok({});
});
const loadGuarded = loader(appContract, "app.guardedPage", { output: Empty }, async () => {
  bump("loader:guarded.page");
  return ok({});
});
const loadShell = loader(appContract, "app.ordersShell", { output: Title }, async () => {
  bump("loader:orders.shell");
  return ok({ title: "shell" });
});
const loadShow = loader(appContract, "app.ordersShow", { output: Title }, async () => {
  bump("loader:orders.show");
  return control.show === "err" ? err(Locked.make({})) : ok({ title: "order" });
});
const loadBare = loader(appContract, "app.ordersBare", { output: Empty }, async () => {
  bump("loader:orders.bare");
  return err(Broken.make({}));
});
const loadSlow = loader(appContract, "app.slowPage", { output: Empty }, async () => {
  bump("loader:slow.page");
  await control.hold;
  return ok({});
});
const act = (verb: Verb) =>
  action(appContract, "app.ordersShow", { input: OrderEdit }, async (input) => {
    bump(`action:${verb}`);
    control.lastInput = input;
    if (control.outcome === "href") {
      return ok(appContract.href("app.ordersList"));
    }
    return ok(null);
  });
const auth = guard({ redirect: "app.login" }, async () => {
  bump("guard:auth");
  return control.gate ? ok(null) : err(Denied.make({}));
});
const gOuter = guard({ redirect: "app.login" }, async () => {
  bump("guard:g.outer");
  return ok(null);
});
const gInner = guard({ redirect: "app.login" }, async () => {
  bump("guard:g.inner");
  return ok(null);
});

export const routes = manifest(appContract, {
  "app.shell": { component: AppShell },
  "app.ordersShell": {
    component: OrdersShell,
    layout: "app.shell",
    loader: loadShell,
    errorElement: errorElement("orders.shell"),
  },
  "app.guardedShell": { component: GuardedShell, layout: "app.shell", guard: gOuter },
  "app.home": { component: page("app.home"), layout: "app.shell" },
  "app.login": { component: page("app.login"), layout: "app.shell" },
  "app.ordersList": { component: page("orders.list"), layout: "app.ordersShell" },
  "app.ordersNew": { component: page("orders.new"), layout: "app.ordersShell" },
  "app.ordersBare": { component: page("orders.bare"), layout: "app.ordersShell", loader: loadBare },
  "app.ordersShow": {
    loader: loadShow,
    component: OrderPage,
    layout: "app.ordersShell",
    errorElement: errorElement("orders.show"),
    POST: act("POST"),
    PUT: act("PUT"),
    PATCH: act("PATCH"),
    DELETE: act("DELETE"),
  },
  "app.ordersLine": {
    loader: load("orders.line"),
    component: page("orders.line"),
    layout: "app.ordersShell",
    errorElement: errorElement("orders.line"),
  },
  "app.secretShow": { loader: loadSecret, component: page("secret.show"), layout: "app.shell", guard: auth },
  "app.guardedPage": {
    loader: loadGuarded,
    component: page("guarded.page"),
    layout: "app.guardedShell",
    guard: gInner,
  },
  "app.slowPage": { loader: loadSlow, component: page("slow.page"), layout: "app.shell" },
});

// ---- in-memory history
export type MemoryHistory = {
  push(url: string, key: string): void;
  replace(url: string, key: string): void;
  current(): string;
  onPop(fn: (url: string, key?: string) => void): void;
  back(): void;
  forward(): void;
  external(url: string): void;
};
export function memoryHistory(start: string): MemoryHistory {
  type Entry = { url: string; key: string | undefined };
  const entries: Entry[] = [{ url: start, key: undefined }];
  let at = 0;
  const subs: ((url: string, key?: string) => void)[] = [];
  const current = (): string => entries[at]?.url ?? start;
  const pop = (): void => {
    const key = entries[at]?.key;
    for (const fn of subs) {
      if (key === undefined) fn(current());
      else fn(current(), key);
    }
  };
  const push = (url: string, key: string | undefined): void => {
    entries.splice(at + 1);
    entries.push({ url, key });
    at += 1;
  };
  return {
    push,
    replace: (url, key) => {
      entries[at] = { url, key };
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
      push(url, undefined);
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
  const unmount = opts.render === true ? mount(router.App, host, { ctx }) : () => {};
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

// ---- Form probe: render one `<Form method action>` from a route component inside a router (E1505 is raised there).
// The Href comes from `probeLinks`, a second contract used only for links; the router under test is `probeRoutes`.
const probeKnob: { method: unknown; action: Href | null } = { method: "POST", action: null };
const ProbeHome = (): Node =>
  Reflect.apply(Form, undefined, [{ method: probeKnob.method, action: probeKnob.action, children: () => [] }]);
const probeContract = contract("probe", {
  "probe.home": { path: "/probe" },
  "probe.show": { path: "/probe/:id", params: OrderParams },
});
const probeAct = action(probeContract, "probe.show", { input: OrderEdit }, async () => ok(null));
export const probeRoutes = manifest(probeContract, {
  "probe.home": { component: ProbeHome },
  "probe.show": { component: page("probe.show"), POST: probeAct },
});
export const probeLinks = contract("link", {
  "link.show": { path: "/probe/:id", params: OrderParams },
  "link.ghost": { path: "/nowhere" },
});
const codeOfThrown = (e: unknown): unknown => (typeof e === "object" && e !== null && "code" in e ? e.code : "no-code");
/** The `code` of what rendering the Form inside the router threw (thrown out of mount, or shown by the router's error boundary, which shows the message in `mode: "dev"`), or null when it rendered. */
export async function probeForm(method: unknown, href: Href): Promise<unknown> {
  probeKnob.method = method;
  probeKnob.action = href;
  const router = createRouter(probeRoutes, {
    ctx: createCtx({ mode: "sim", seed: SEED }),
    history: memoryHistory("/probe"),
    mode: "dev",
  });
  const host = document.createElement("div");
  document.body.append(host);
  let unmount: () => void = () => {};
  let code: unknown = null;
  try {
    unmount = mount(router.App, host, { ctx: simCtx });
    await settle();
  } catch (e) {
    code = codeOfThrown(e);
  }
  // The router's render boundary may catch the throw and show it as an alert whose message starts with the code.
  const alert = host.querySelector('[role="alert"]');
  if (code === null && alert?.textContent?.startsWith("E1505")) code = "E1505";
  unmount();
  router.dispose();
  host.remove();
  return code;
}
