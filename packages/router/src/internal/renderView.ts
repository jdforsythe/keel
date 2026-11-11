import type { Ctx } from "@keel/ctx";
import { boundary } from "@keel/runtime-dom/ops";
import type { KeelError } from "@keel/schema";
import type { View } from "./View.ts";
import { defaultError } from "./defaultError.ts";

const errorAt = (v: View, level: number, error: KeelError<string, unknown>): Node =>
  v.chain[level]?.def.errorElement?.({ error }) ?? defaultError(error);

function componentAt(v: View, i: number, ctx: Ctx): Node {
  const lvl = v.chain[i];
  // An API route (k.api) has no component; the client never matches one.
  if (lvl?.def.component === undefined) return document.createComment("");
  const cell = v.data[i];
  const base = { params: v.params, search: v.search };
  const children = i + 1 < v.chain.length ? () => levelAt(v, i + 1, ctx) : undefined;
  return children === undefined
    ? lvl.def.component(
        {
          ...base,
          get data() {
            return cell?.get();
          },
        },
        undefined,
        ctx,
      )
    : lvl.def.component(
        {
          ...base,
          children,
          get data() {
            return cell?.get();
          },
        },
        undefined,
        ctx,
      );
}

function levelAt(v: View, i: number, ctx: Ctx): Node {
  const lvl = v.chain[i];
  if (lvl === undefined) return document.createComment("");
  if (v.error !== null && v.error.level === i) return errorAt(v, i, v.error.error);
  const render = (): Node => componentAt(v, i, ctx);
  if (lvl.def.errorElement === undefined) return render();
  // Every route with an errorElement is a Boundary whose fallback is that errorElement (k.errors).
  const frag = document.createDocumentFragment();
  const anchor = document.createComment(`keel:route ${lvl.id}`);
  frag.append(anchor);
  boundary(anchor, render, (error) => errorAt(v, i, error));
  return frag;
}

/**
 * Render a committed view: the chain outermost first, each layout getting the next level as `children`.
 * A loader error renders its level's `errorElement` with the layouts above intact; a bare error (404, guard
 * failure) renders only the errorElement; level -1 is the root default.
 */
export function renderView(v: View, ctx: Ctx): Node {
  const e = v.error;
  if (e !== null && e.level < 0) return defaultError(e.error);
  if (e?.bare) return errorAt(v, e.level, e.error);
  return levelAt(v, 0, ctx);
}
