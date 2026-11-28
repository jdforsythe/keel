import type { Ctx } from "@keel/ctx";
import { MODULES_KEY } from "./MODULES_KEY.ts";

function originOf(url: string): string | undefined {
  const u = URL.parse(url);
  return u !== null && /^https?:$/.test(u.protocol) ? u.origin : undefined;
}

/**
 * Whether a `service({ base })` call to `base` goes to a Keel origin (k.services Encoding): in a browser the document's
 * origin or the origin of a `<meta name="keel-peer">` tag (k.hosting Peers), or the origin of a URL the `createApp` or
 * `client` entry that bound `ctx` holds for a module (k.topology Calls and peers). Any other origin is a third party.
 */
export function keelOrigin(ctx: Ctx, base: string): boolean {
  const target = originOf(base);
  if (target === undefined) return false;
  const loc: unknown = Reflect.get(globalThis, "location");
  const doc: unknown = typeof loc === "object" && loc !== null ? Reflect.get(loc, "origin") : undefined;
  if (typeof doc === "string" && doc === target) return true;
  const d: unknown = Reflect.get(globalThis, "document");
  const query: unknown = typeof d === "object" && d !== null ? Reflect.get(d, "querySelectorAll") : undefined;
  if (typeof query === "function") {
    const tags: unknown = Reflect.apply(query, d, ['meta[name="keel-peer"]']);
    const n: unknown = typeof tags === "object" && tags !== null ? Reflect.get(tags, "length") : 0;
    for (let i = 0; typeof tags === "object" && tags !== null && typeof n === "number" && i < n; i++) {
      const tag: unknown = Reflect.get(tags, i);
      const content: unknown = typeof tag === "object" && tag !== null ? Reflect.get(tag, "content") : undefined;
      if (typeof content === "string" && originOf(content) === target) return true;
    }
  }
  const table: unknown = Reflect.get(globalThis, MODULES_KEY);
  const bound: unknown = table instanceof WeakMap ? table.get(ctx) : undefined;
  if (bound instanceof Map)
    for (const at of bound.values()) if (typeof at === "string" && originOf(at) === target) return true;
  return false;
}
