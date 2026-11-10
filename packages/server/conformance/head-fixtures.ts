// Shared fixtures for k.head and k.prefix server conformance. Not a test file. Property seed: 1337.
// ASSUMPTIONS: createApp({ topology, routes, ctx, mode }) as in fixtures.ts; a path route accepts `title: (props) => string`;
// the document is parsed inertly (template) as in document-head-0078.test.ts.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";

export const SEED = 1337;
export const Locale = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
export const PlainLocale = s.enum(["en-US", "de-DE"]);
const Id = s.string({ min: 1, max: 8 });
const Empty = s.object({});
const Broken = s.error("h.broken", s.object({}));

const p = (text: string): Node => {
  const e = document.createElement("p");
  e.textContent = text;
  return e;
};
const str = (props: { readonly params?: unknown }, key: string): string =>
  String(Reflect.get(Object(props.params), key));

export const routes = manifest({
  "h.show": {
    path: "/:locale/items/:id",
    params: s.object({ locale: Locale, id: Id }),
    component: (props) => p(`${str(props, "locale")}:${str(props, "id")}`),
    title: (props) => `Item ${str(props, "id")} <&> "q"`,
  },
  "h.untitled": {
    path: "/:locale/untitled",
    params: s.object({ locale: Locale }),
    component: (props) => p(str(props, "locale")),
  },
  "h.broken": {
    path: "/:locale/broken",
    params: s.object({ locale: Locale }),
    loader: loader({ output: Empty }, async () => err(Broken.make({}))),
    component: () => p("never"),
    title: () => "Never shown",
  },
  "h.plain": { path: "/plain", component: () => p("plain"), title: () => "Plain" },
  "h.ok": { path: "/ok", loader: loader({ output: Empty }, async () => ok({})), component: () => p("ok") },
});

export const plainLocaleRoutes = manifest({
  "h.show": {
    path: "/:locale/items/:id",
    params: s.object({ locale: PlainLocale, id: Id }),
    component: (props) => p(`${str(props, "locale")}:${str(props, "id")}`),
  },
});

export async function appFor(name: string, r: typeof routes | typeof plainLocaleRoutes = routes) {
  return createApp({
    topology: topology({ [name]: { modules: ["h"], adapter: "node" } }),
    routes: r,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
  });
}

export const get = (app: { fetch(req: Request): Promise<Response> }, url: string) =>
  app.fetch(new Request(`http://localhost${url}`, { redirect: "manual" }));

/** Inert parse of a served document: title text, html lang attribute, body text. */
export function parseDoc(text: string): { title: string | null; lang: string | null; body: string } {
  const title = /<title>([\s\S]*?)<\/title>/.exec(text)?.[1] ?? null;
  const lang = /<html[^>]*\blang="([^"]*)"/.exec(text)?.[1] ?? null;
  return { title, lang, body: text };
}
const entities: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'" };
export const unescapeText = (t: string): string => t.replace(/&(lt|gt|amp|quot|#39);/g, (m) => entities[m] ?? m);
