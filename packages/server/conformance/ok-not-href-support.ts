// Shared fixture of the rfc:0157 conformance files for "an action's `ok` value that is no `Href`" (not a test file). Seed 1337.
// One page `a.item` whose POST action changes one store, then answers `ok(next)`; `next` is a raw string typed as an `Href` through a type predicate.
import { createCtx } from "@keel/ctx";
import { type Href, action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { SEED, boot, form, postJson } from "./contract-support.ts";

export { SEED };
export const KEY = "keel.store.link.s";
export const BAD = [
  "//evil.example/x",
  "/\\evil.example",
  "https://evil.example/",
  "javascript:alert(1)",
  "/a\u0085b",
  "/a\u0000b",
  "/a\nb",
  "/a\u007fb",
] as const;

const Box = s.object({ n: s.int() });
const c = contract("a", {
  "a.home": { path: "/" },
  "a.item": { path: "/item/:slug", params: s.object({ slug: s.string() }) },
});
const isHref = (v: string): v is Href => true;
const raw = (v: string): Href => {
  if (!isHref(v)) throw new Error("unreachable");
  return v;
};
const factory = () => {
  const box = store(Box, { n: 0 }, { id: "link.s" });
  const bump = transaction(box, "link.bump", s.object({}), (state) => ({ n: state.n + 1 }));
  return { s: box, bump };
};
let next: string | null = null;
const act = action(c, "a.item", { input: s.object({}), stores: factory }, async (_input, { stores }) => {
  tx(stores.bump, {});
  return ok(next === null ? null : raw(next));
});
const page = (): Node => document.createElement("main");
const routes = manifest(c, { "a.home": { component: page }, "a.item": { component: page, POST: act } });
export const homeHref = c.href("a.home");
export const itemHref = (slug: string): Href => c.href("a.item", { slug });

export async function setup() {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const app = await boot(routes, ["a"], "node", ctx);
  const saved = async (): Promise<string | null> => {
    const v = await ctx.storage.get(KEY);
    return v === undefined ? null : v;
  };
  /** A document POST (a browser form post) answering with `to`. */
  const document_ = (to: string | null, path = "/item/x") => {
    next = to;
    return app.fetch(form(path, {}, { accept: "text/html" }));
  };
  /** A JSON POST (the runtime) answering with `to`. */
  const json = (to: string | null, path = "/item/x") => {
    next = to;
    return app.fetch(postJson(path, {}));
  };
  return { ctx, saved, document: document_, json };
}
