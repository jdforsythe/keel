// @vitest-environment happy-dom
// A kept page's route Boundary: a binding that throws on one search shows the `errorElement`; the next search-only
// navigation renders the level again.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};

it("a level that threw on one search renders again on the next", async () => {
  const routes = manifest({
    "kb.list": {
      path: "/kb",
      search: s.object({ q: s.string().optional() }),
      component: (props) => {
        const p = document.createElement("p");
        p.id = "page";
        const t = document.createTextNode("");
        p.append(t);
        text(t, () => {
          const q = Reflect.get(Object(props.search), "q");
          if (q === "boom") throw new Error("boom");
          return String(q ?? "");
        });
        return p;
      },
      errorElement: () => {
        const d = document.createElement("div");
        d.id = "failed";
        return d;
      },
    },
  });
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/kb?q=a") });
  const host = document.createElement("div");
  const unmount = mount(router.App, host);
  await settle();
  expect(host.querySelector("#page")?.textContent).toBe("a");
  await router.navigate(routes.href("kb.list", {}, { q: "boom" }));
  await settle();
  expect(host.querySelector("#failed")).not.toBeNull();
  await router.navigate(routes.href("kb.list", {}, { q: "b" }));
  await settle();
  expect(host.querySelector("#failed")).toBeNull();
  expect(host.querySelector("#page")?.textContent).toBe("b");
  unmount();
  router.dispose();
});
