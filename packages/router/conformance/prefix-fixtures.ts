// Shared fixtures for k.prefix conformance (router lane). Not a test file. Property seed: 1337.
// ASSUMPTIONS: same router seam as fixtures.ts; `createRouter(routes, { ctx, history }).route.get()` reads the match.
// Raw URLs reach the router through `history.external(url)`; an Href minted by a loose manifest (`links`) stands for a
// link written by hand, so no cast is needed.
import { createCtx } from "@keel/ctx";
import { type Href, createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { memoryHistory, settle } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

export const SEED = 1337;
export const RUNS = 50;

export const Locale = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
export const PlainLocale = s.enum(["en-US", "de-DE"]);
export const Item = s.string({ min: 1, max: 8 });
export const itemIds = /^[a-z0-9]{1,8}$/;
export const LOCALES = ["en-US", "de-DE"] as const;

const page = (id: string) => (): Node => {
  const e = document.createElement("section");
  e.setAttribute("data-page", id);
  return e;
};

export const xContract = contract("x", {
  "x.show": { path: "/:p/items/:id", params: s.object({ p: Locale, id: Item }) },
  "x.home": { path: "/:p", params: s.object({ p: Locale }) },
});

export const prefixed = manifest(xContract, {
  "x.show": { component: page("x.show") },
  "x.home": { component: page("x.home") },
});

const x = contract("x", {
  "x.show": { path: "/:p/items/:id", params: s.object({ p: PlainLocale, id: Item }) },
});

export const unprefixed = manifest(x, {
  "x.show": { component: page("x.show") },
});

/** Hand-written links: a contract whose hrefs are for any URL below, minted without the prefix codec. */
export const links = contract("raw", {
  "raw.plain": { path: "/items/:id", params: s.object({ id: Item }) },
  "raw.de": { path: "/de-DE/items/:id", params: s.object({ id: Item }) },
  "raw.en": { path: "/en-US/items/:id", params: s.object({ id: Item }) },
  "raw.fr": { path: "/fr-FR/items/:id", params: s.object({ id: Item }) },
});

export type Routes = typeof prefixed;
export async function open(routes: Routes | typeof unprefixed, at: string) {
  const history = memoryHistory(at);
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim", seed: SEED }), history });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx: simCtx });
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
export type Link = Href;
