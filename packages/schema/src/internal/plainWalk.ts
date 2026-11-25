import { plainEntries } from "./plainEntries.ts";
import { plainItems } from "./plainItems.ts";

type Path = (string | number)[];

/** Where a value stands under the walked one: its key and its parent's link. */
type Link = { readonly key: string | number; readonly up: Link | undefined } | undefined;

type Frame = { readonly v: unknown; readonly at: Link } | { readonly leave: object };

const keysOf = (at: Link): Path => {
  const keys: Path = [];
  for (let a = at; a !== undefined; a = a.up) keys.push(a.key);
  return keys.reverse();
};

/**
 * Walk `x` through plain arrays and plain objects (k.schema Plain data). `bad` gets the keys from `x` to each value
 * that is none of `null`, a boolean, a string, a finite number, a plain array or a plain object (nothing under it is
 * read), and to each container met again inside itself; the walk stops when `bad` returns false. A container is
 * judged in full before any value under it is read, and a plain container already walked is not walked again, so a
 * value that holds one at many paths costs one walk of it; what is not plain data is reported at each path it is met. Walked with a list rather than
 * recursion, so deep data cannot overflow the stack.
 */
export function plainWalk(x: unknown, bad: (keys: Path) => boolean): void {
  const above = new Set<object>();
  const done = new Set<object>();
  const todo: Frame[] = [{ v: x, at: undefined }];
  for (let f = todo.pop(); f !== undefined; f = todo.pop()) {
    if ("leave" in f) {
      above.delete(f.leave);
      done.add(f.leave);
      continue;
    }
    const { v, at } = f;
    if (v === null || typeof v === "string" || typeof v === "boolean") continue;
    if (typeof v === "number") {
      if (!Number.isFinite(v) && !bad(keysOf(at))) return;
      continue;
    }
    if (typeof v !== "object") {
      if (!bad(keysOf(at))) return;
      continue;
    }
    if (done.has(v)) continue;
    if (above.has(v)) {
      if (!bad(keysOf(at))) return;
      continue;
    }
    const items = Array.isArray(v) ? plainItems(v) : undefined;
    const entries = items === undefined ? plainEntries(v) : undefined;
    if (items === undefined && entries === undefined) {
      if (!bad(keysOf(at))) return;
      continue;
    }
    above.add(v);
    todo.push({ leave: v });
    if (items !== undefined)
      for (let i = items.length - 1; i >= 0; i--) todo.push({ v: items[i], at: { key: i, up: at } });
    else if (entries !== undefined)
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e !== undefined) todo.push({ v: e[1], at: { key: e[0], up: at } });
      }
  }
}
