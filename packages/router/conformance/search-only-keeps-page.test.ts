// Spec: k.router, Conformance "After a search-only navigation each guard and loader of the chain ran once more and the page keeps its nodes, focus and local signals, and its `props.search` and `props.data` bindings update; a loader `err` renders the `errorElement`, a params change a new page."
// Seed: 1337.
// @vitest-environment happy-dom
// ASSUMPTIONS (as in fixtures.ts): createRouter(routes, { ctx, history }) returns { App, navigate, route, dispose }; a layout receives
// `children` as a thunk; a loader is called with `{ params, search }`; `props.search` and `props.data` are read inside bindings (`text`).
// Skipped until a search-only navigation keeps the page.
import { createCtx } from "@keel/ctx";
import { createRouter, guard, loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import { err, ok, s } from "@keel/schema";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, memoryHistory, settle } from "./fixtures.ts";

const Params = s.object({ id: s.int({ min: 1, max: 9 }) });
const Search = s.object({ q: s.string({ min: 1, max: 8 }).optional() });
const PageData = s.object({ echo: s.string({ min: 0, max: 8 }), n: s.int({ min: 0, max: 1000000 }) });
const ShellData = s.object({ n: s.int({ min: 0, max: 1000000 }) });
const Boom = s.error("kept.boom", s.object({}));
const Denied = s.error("keel.denied", s.object({}));

const runs = { shellGuard: 0, pageGuard: 0, shellLoader: 0, pageLoader: 0, builds: 0 };
const atBuild: string[] = [];
const resetRuns = (): void => {
  runs.shellGuard = 0;
  runs.pageGuard = 0;
  runs.shellLoader = 0;
  runs.pageLoader = 0;
  runs.builds = 0;
  atBuild.length = 0;
};

const shown = (value: unknown, key: string): string => {
  const found: unknown = typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
  return typeof found === "string" ? found : typeof found === "number" ? String(found) : "none";
};

const shellGuard = guard({ redirect: "kept.login" }, async () => {
  runs.shellGuard++;
  return ok(null);
});
const pageGuard = guard({ redirect: "kept.login" }, async () => {
  runs.pageGuard++;
  return ok(null);
});
const loadShell = loader({ output: ShellData }, async () => {
  runs.shellLoader++;
  return ok({ n: runs.shellLoader });
});
const loadPage = loader({ output: PageData, params: Params, search: Search }, async ({ search }) => {
  runs.pageLoader++;
  const q = search.q ?? "";
  return q === "boom" ? err(Boom.make({})) : ok({ echo: q, n: runs.pageLoader });
});

const Shell = (props: { children?: () => Node }): Node => {
  const frame = document.createElement("div");
  frame.setAttribute("data-layout", "kept.shell");
  frame.append(props.children?.() ?? "");
  return frame;
};
const ErrorView = (props: { error: { code: string } }): Node => {
  const p = document.createElement("p");
  p.setAttribute("data-error", "kept.page");
  p.setAttribute("data-code", props.error.code);
  p.textContent = props.error.code;
  return p;
};

const Page = (props: RouteProps): Node => {
  runs.builds++;
  atBuild.push(`${shown(props.search, "q")}|${shown(props.data, "n")}`); // top-level reads: the values at build
  const main = document.createElement("main");
  main.id = "kept.main";
  const searchLine = document.createElement("p");
  searchLine.id = "kept.search";
  text(searchLine, () => shown(props.search, "q"));
  const dataLine = document.createElement("p");
  dataLine.id = "kept.data";
  text(dataLine, () => `${shown(props.data, "echo")}#${shown(props.data, "n")}`);
  const clicks = signal(0); // a local signal, created in the component's scope
  const clickLine = document.createElement("p");
  clickLine.id = "kept.clicks";
  text(clickLine, () => String(clicks.get()));
  const bump = document.createElement("button");
  bump.id = "kept.bump";
  bump.setAttribute("type", "button");
  bump.textContent = "Count";
  bump.addEventListener("click", () => clicks.set(clicks.get() + 1));
  const label = document.createElement("label");
  label.append("Note ");
  const field = document.createElement("input");
  field.id = "kept.field";
  field.name = "note";
  label.append(field);
  main.append(searchLine, dataLine, clickLine, bump, label);
  return main;
};

const routes = manifest({
  "kept.shell": { component: Shell, guard: shellGuard, loader: loadShell },
  "kept.login": { path: "/login", component: () => document.createElement("p") },
  "kept.page": {
    path: "/k/:id",
    params: Params,
    search: Search,
    layout: "kept.shell",
    guard: pageGuard,
    loader: loadPage,
    component: Page,
    errorElement: ErrorView,
  },
});

const open = async (at: string) => {
  resetRuns();
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim", seed: SEED }), history: memoryHistory(at) });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host);
  await settle();
  return {
    router,
    host,
    stop: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
};
const byId = (host: HTMLElement, id: string): HTMLElement => {
  const found = host.querySelector(`[id="${id}"]`);
  if (!(found instanceof HTMLElement)) throw new Error(`fixture: no element ${id}`);
  return found;
};
const goTo = async (app: Awaited<ReturnType<typeof open>>, id: number, q: string | undefined): Promise<void> => {
  await app.router.navigate(routes.href("kept.page", { id }, q === undefined ? {} : { q }));
  await settle();
};
// Search values that are never "boom" (that value makes the loader return err).
const queries = fc.array(fc.constantFrom("a", "b", "cd", "ef", "ghij"), { minLength: 1, maxLength: 4 });

afterEach(() => document.body.replaceChildren());

describe("k.router: a search-only navigation keeps the page", () => {
  it.skip("After a search-only navigation each guard and loader of the chain ran once more", async () => {
    await fc.assert(
      fc.asyncProperty(queries, async (qs) => {
        const app = await open("/k/1");
        const before = { ...runs };
        expect(before).toMatchObject({ shellGuard: 1, pageGuard: 1, shellLoader: 1, pageLoader: 1 });
        for (const [i, q] of qs.entries()) {
          await goTo(app, 1, q);
          expect(runs.shellGuard).toBe(before.shellGuard + i + 1);
          expect(runs.pageGuard).toBe(before.pageGuard + i + 1);
          expect(runs.shellLoader).toBe(before.shellLoader + i + 1);
          expect(runs.pageLoader).toBe(before.pageLoader + i + 1);
        }
        app.stop();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it.skip("After a search-only navigation the page keeps its nodes", async () => {
    await fc.assert(
      fc.asyncProperty(queries, async (qs) => {
        const app = await open("/k/1");
        const main = byId(app.host, "kept.main");
        const nodes = ["kept.search", "kept.data", "kept.clicks", "kept.bump", "kept.field"].map((id) =>
          byId(app.host, id),
        );
        const texts = nodes.map((n) => n.firstChild);
        const layout = app.host.querySelector('[data-layout="kept.shell"]');
        for (const q of qs) await goTo(app, 1, q);
        expect(byId(app.host, "kept.main")).toBe(main);
        expect(app.host.querySelector('[data-layout="kept.shell"]')).toBe(layout);
        expect(
          ["kept.search", "kept.data", "kept.clicks", "kept.bump", "kept.field"].map((id) => byId(app.host, id)),
        ).toEqual(nodes);
        for (const [i, id] of ["kept.search", "kept.data", "kept.clicks", "kept.bump", "kept.field"].entries()) {
          expect(byId(app.host, id)).toBe(nodes[i]);
          expect(byId(app.host, id).firstChild).toBe(texts[i]);
        }
        expect(runs.builds).toBe(1);
        expect(atBuild).toHaveLength(1);
        app.stop();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it.skip("After a search-only navigation the page keeps focus", async () => {
    await fc.assert(
      fc.asyncProperty(queries, async (qs) => {
        const app = await open("/k/1");
        const field = byId(app.host, "kept.field");
        field.focus();
        expect(document.activeElement).toBe(field);
        for (const q of qs) {
          await goTo(app, 1, q);
          expect(document.activeElement).toBe(field);
        }
        app.stop();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it.skip("After a search-only navigation the page keeps its local signals", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), queries, async (clicks, qs) => {
        const app = await open("/k/1");
        const bump = byId(app.host, "kept.bump");
        for (let i = 0; i < clicks; i++) bump.dispatchEvent(new Event("click", { bubbles: true }));
        await settle();
        expect(byId(app.host, "kept.clicks").textContent).toBe(String(clicks));
        for (const q of qs) {
          await goTo(app, 1, q);
          expect(byId(app.host, "kept.clicks").textContent).toBe(String(clicks));
        }
        bump.dispatchEvent(new Event("click", { bubbles: true }));
        await settle();
        expect(byId(app.host, "kept.clicks").textContent).toBe(String(clicks + 1));
        app.stop();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it.skip("After a search-only navigation its `props.search` and `props.data` bindings update", async () => {
    await fc.assert(
      fc.asyncProperty(queries, async (qs) => {
        const app = await open("/k/1");
        expect(byId(app.host, "kept.search").textContent).toBe("none");
        expect(byId(app.host, "kept.data").textContent).toBe("#1");
        for (const [i, q] of qs.entries()) {
          await goTo(app, 1, q);
          expect(byId(app.host, "kept.search").textContent).toBe(q);
          expect(byId(app.host, "kept.data").textContent).toBe(`${q}#${i + 2}`);
        }
        app.stop();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it.skip("After a search-only navigation a loader `err` renders the `errorElement`", async () => {
    const app = await open("/k/1");
    await goTo(app, 1, "boom");
    const shownError = app.host.querySelector('[data-error="kept.page"]');
    expect(shownError?.getAttribute("data-code")).toBe("kept.boom");
    expect(app.host.querySelector("main")).toBeNull();
    expect(app.host.querySelector('[data-layout="kept.shell"]')).not.toBeNull();
    app.stop();
  });

  it.skip("After a navigation that changes the params a new page is rendered", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 9 }), fc.constantFrom("a", "cd"), async (id, q) => {
        const app = await open("/k/1");
        const main = byId(app.host, "kept.main");
        const field = byId(app.host, "kept.field");
        await goTo(app, id, q);
        expect(runs.builds).toBe(2);
        expect(byId(app.host, "kept.main")).not.toBe(main);
        expect(byId(app.host, "kept.field")).not.toBe(field);
        expect(byId(app.host, "kept.search").textContent).toBe(q);
        expect(atBuild[1]?.startsWith(`${q}|`)).toBe(true);
        app.stop();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
