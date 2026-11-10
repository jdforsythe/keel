// Shared fixtures for k.head conformance (router lane). Not a test file. Property seed: 1337.
// ASSUMPTIONS: a path route's `title: (props) => string` is accepted by `manifest`; the client router writes
// document.title and document.documentElement.lang (k.head Client); layouts render a `children` thunk as in fixtures.ts.
import { createCtx } from "@keel/ctx";
import { createRouter, manifest } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { memoryHistory, settle } from "./fixtures.ts";

export const SEED = 1337;
export const Locale = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
export const LocaleParams = s.object({ p: Locale });

type Kids = { children?: () => Node | Node[] | string };
const shell = (props: Kids): Node => {
  const e = document.createElement("div");
  e.id = "shell";
  const k = props.children?.() ?? "";
  e.append(...[k].flat());
  return e;
};
const text = (t: string): Node => {
  const e = document.createElement("p");
  e.textContent = t;
  return e;
};

export const routes = manifest({
  "h.shell": { component: shell },
  "h.home": {
    path: "/:p",
    params: LocaleParams,
    layout: "h.shell",
    component: (props) => text(`home ${String(Reflect.get(Object(props.params), "p"))}`),
    title: (props) => `Home ${String(Reflect.get(Object(props.params), "p"))} <&>`,
  },
  "h.about": {
    path: "/:p/about",
    params: LocaleParams,
    layout: "h.shell",
    component: (props) => text(`about ${String(Reflect.get(Object(props.params), "p"))}`),
    title: (props) => `About ${String(Reflect.get(Object(props.params), "p"))}`,
  },
});

export const titleOf = (p: "en-US" | "de-DE", page: "home" | "about"): string =>
  page === "home" ? `Home ${p} <&>` : `About ${p}`;

export async function open(at: string, host?: HTMLElement) {
  const history = memoryHistory(at);
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim", seed: SEED }), history });
  const root = host ?? document.createElement("div");
  if (host === undefined) document.body.append(root);
  const unmount = mount(router.App, root);
  await settle();
  return {
    router,
    history,
    host: root,
    stop: () => {
      unmount();
      router.dispose();
      root.remove();
    },
  };
}

export const pid = (page: "home" | "about"): "h.home" | "h.about" => (page === "home" ? "h.home" : "h.about");
