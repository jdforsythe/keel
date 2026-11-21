// Spec: k.head, Conformance "After a search-only navigation, `document.title` is the route's `title` for the new search and data, and the focused element and every `role="status"` node are the same nodes as before."
// Seed: 1337.
// @vitest-environment happy-dom
// ASSUMPTIONS (as in head-fixtures.ts): createRouter(routes, { ctx, history }) from @keel/router, memoryHistory from fixtures.ts; the title function
// receives `{ params, search, data }`. Skipped until a search-only navigation keeps the page.
import { createCtx } from "@keel/ctx";
import { createRouter, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import { ok, s } from "@keel/schema";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, memoryHistory, settle } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const Search = s.object({ q: s.string({ min: 1, max: 8 }).optional() });
const Data = s.object({ echo: s.string({ min: 0, max: 8 }), n: s.int({ min: 0, max: 1000000 }) });

let loads = 0;
const hsContract = contract("hs", {
  "hs.page": { path: "/hs", search: Search },
});

const load = loader(hsContract, "hs.page", { output: Data }, async ({ search }) => {
  loads++;
  return ok({ echo: search.q ?? "", n: loads });
});

const titleFor = (echo: string, n: number): string => `Items ${echo === "" ? "all" : echo} #${n}`;
const read = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

const Page = (props: RouteProps): Node => {
  const main = document.createElement("main");
  main.id = "hs.main";
  const field = document.createElement("input");
  field.id = "hs.field";
  field.name = "note";
  const label = document.createElement("label");
  label.append("Note ");
  label.append(field);
  const status = document.createElement("p");
  status.id = "hs.status";
  status.setAttribute("role", "status");
  text(status, () => String(read(props.search, "q") ?? ""));
  const quiet = document.createElement("p");
  quiet.id = "hs.quiet";
  quiet.setAttribute("role", "status");
  quiet.textContent = "ready";
  main.append(label, status, quiet);
  return main;
};

const routes = manifest(hsContract, {
  "hs.page": {
    loader: load,
    component: Page,
    title: (p) => titleFor(String(read(p.data, "echo")), Number(read(p.data, "n"))),
  },
});

const queries = fc.array(fc.constantFrom("a", "b", "cd", "ef", "ghij"), { minLength: 1, maxLength: 4 });

afterEach(() => {
  document.body.replaceChildren();
  document.title = "";
});

describe("k.head: a search-only navigation", () => {
  it("After a search-only navigation, `document.title` is the route's `title` for the new search and data", async () => {
    await fc.assert(
      fc.asyncProperty(queries, async (qs) => {
        loads = 0;
        const router = createRouter(routes, {
          ctx: createCtx({ mode: "sim", seed: SEED }),
          history: memoryHistory("/hs"),
        });
        const host = document.createElement("div");
        document.body.append(host);
        const unmount = mount(router.App, host, { ctx: simCtx });
        await settle();
        expect(document.title).toBe(titleFor("", 1));
        for (const [i, q] of qs.entries()) {
          await router.navigate(hsContract.href("hs.page", {}, { q }));
          await settle();
          expect(document.title).toBe(titleFor(q, i + 2));
        }
        unmount();
        router.dispose();
        host.remove();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it('After a search-only navigation the focused element and every `role="status"` node are the same nodes as before', async () => {
    await fc.assert(
      fc.asyncProperty(queries, async (qs) => {
        loads = 0;
        const router = createRouter(routes, {
          ctx: createCtx({ mode: "sim", seed: SEED }),
          history: memoryHistory("/hs"),
        });
        const host = document.createElement("div");
        document.body.append(host);
        const unmount = mount(router.App, host, { ctx: simCtx });
        await settle();
        const field = host.querySelector("#hs\\.field");
        if (!(field instanceof HTMLElement)) throw new Error("fixture: no field");
        field.focus();
        const statuses = [...host.querySelectorAll('[role="status"]')];
        expect(statuses).toHaveLength(2);
        for (const q of qs) {
          await router.navigate(hsContract.href("hs.page", {}, { q }));
          await settle();
          expect(document.activeElement).toBe(field);
          const after = [...host.querySelectorAll('[role="status"]')];
          expect(after).toHaveLength(statuses.length);
          for (const [i, node] of after.entries()) expect(node).toBe(statuses[i]);
        }
        unmount();
        router.dispose();
        host.remove();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
