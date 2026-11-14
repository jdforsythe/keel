// @vitest-environment happy-dom
// k.head Client on a kept page: a focused element the search-only navigation removed hands focus to the element with
// its id, else the page's first `role="status"` region, else `main`.
import { createCtx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { For, mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { afterEach, expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
afterEach(() => {
  document.body.innerHTML = "";
});

const page = (withStatus: boolean) =>
  manifest({
    "kf.list": {
      path: "/kf",
      search: s.object({ q: s.string().optional() }),
      component: (props) => {
        const main = document.createElement("main");
        const q = computed(() => String(Reflect.get(Object(props.search), "q") ?? ""));
        if (withStatus) {
          const st = document.createElement("p");
          st.setAttribute("role", "status");
          st.id = "kf.status";
          const t = document.createTextNode("");
          st.append(t);
          text(t, () => q.get());
          main.append(st);
        }
        const rows = (): { id: string }[] => ["apple", "pear"].filter((r) => r.includes(q.get())).map((id) => ({ id }));
        main.append(
          For({
            get each() {
              return rows();
            },
            key: "id",
            children: (r) => {
              const b = document.createElement("button");
              if (r.id === "pear") b.id = "kf.pear";
              b.textContent = r.id;
              return b;
            },
          }),
          (() => {
            const b = document.createElement("button");
            b.id = "kf.pear.keep";
            b.textContent = "keep";
            return b;
          })(),
        );
        return main;
      },
    },
  });

const open = async (withStatus: boolean) => {
  const routes = page(withStatus);
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/kf") });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(router.App, host);
  await settle();
  return { routes, router, host, off };
};
const button = (label: string): HTMLElement => {
  const b = Array.from(document.querySelectorAll("button")).find((x) => x.textContent === label);
  if (!(b instanceof HTMLElement)) throw new Error(`no ${label}`);
  return b;
};

it("an id-less control that leaves the results hands focus to the page's status region", async () => {
  const { routes, router, off } = await open(true);
  const main = document.querySelector("main");
  button("apple").focus();
  await router.navigate(routes.href("kf.list", {}, { q: "pe" }));
  await settle();
  expect(document.querySelector("main")).toBe(main);
  expect(document.activeElement?.id).toBe("kf.status");
  expect(document.getElementById("kf.status")?.getAttribute("tabindex")).toBe("-1");
  off();
  router.dispose();
});

it("without a status region focus goes to main", async () => {
  const { routes, router, off } = await open(false);
  button("apple").focus();
  await router.navigate(routes.href("kf.list", {}, { q: "pe" }));
  await settle();
  expect(document.activeElement?.localName).toBe("main");
  off();
  router.dispose();
});

it("a control with an id that is still on the page keeps focus; one gone with an id goes to the region", async () => {
  const { routes, router, off } = await open(true);
  button("pear").focus();
  await router.navigate(routes.href("kf.list", {}, { q: "pea" }));
  await settle();
  expect(document.activeElement?.id).toBe("kf.pear");
  await router.navigate(routes.href("kf.list", {}, { q: "app" }));
  await settle();
  expect(document.activeElement?.id).toBe("kf.status");
  off();
  router.dispose();
});
