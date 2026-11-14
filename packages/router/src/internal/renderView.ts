import type { Ctx } from "@keel/ctx";
import { effect } from "@keel/reactive";
import { boundary } from "@keel/runtime-dom/ops";
import type { KeelError } from "@keel/schema";
import type { View } from "./View.ts";
import { defaultError } from "./defaultError.ts";

const errorAt = (v: View, level: number, error: KeelError<string, unknown>): Node =>
  v.chain[level]?.def.errorElement?.({ error }) ?? defaultError(error);

function componentAt(v: () => View, i: number, ctx: Ctx): Node {
  const { chain, params } = v();
  const lvl = chain[i];
  // An API route (k.api) has no component; the client never matches one.
  if (lvl?.def.component === undefined) return document.createComment("");
  // `search` and `data` read the current view: a kept page's navigation and revalidation update them in place.
  return lvl.def.component(
    {
      params,
      get search() {
        return v().search;
      },
      get data() {
        return v().data[i]?.get();
      },
      ...(i + 1 < chain.length ? { children: () => levelAt(v, i + 1, ctx) } : {}),
    },
    undefined,
    ctx,
  );
}

function levelAt(v: () => View, i: number, ctx: Ctx): Node {
  const now = v();
  const lvl = now.chain[i];
  if (lvl === undefined) return document.createComment("");
  if (now.error !== null && now.error.level === i) return errorAt(now, i, now.error.error);
  const render = (): Node => componentAt(v, i, ctx);
  if (lvl.def.errorElement === undefined) return render();
  // Every route with an errorElement is a Boundary whose fallback is that errorElement (k.errors).
  const frag = document.createDocumentFragment();
  const anchor = document.createComment(`keel:route ${lvl.id}`);
  frag.append(anchor);
  // A kept page's next navigation retries a level whose render or binding threw.
  boundary(anchor, render, (error, reset) => {
    const seen = v();
    effect(() => {
      if (v() !== seen) reset();
    });
    return errorAt(now, i, error);
  });
  return frag;
}

/**
 * Render a committed view, given as the root row's current item: the chain outermost first, each layout getting the
 * next level as `children`; `search` and `data` props are getters over the current view, `params` a plain value.
 * A loader error renders its level's `errorElement` with the layouts above intact; a bare error (404, guard
 * failure) renders only the errorElement; level -1 is the root default.
 */
export function renderView(v: () => View, ctx: Ctx): Node {
  const now = v();
  const e = now.error;
  if (e !== null && e.level < 0) return defaultError(e.error);
  if (e?.bare) return errorAt(now, e.level, e.error);
  return levelAt(v, 0, ctx);
}
