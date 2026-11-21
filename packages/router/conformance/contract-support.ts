// Shared helpers for the k.contract router conformance files (RFC 0157). Property seed: 1337.
// ASSUMPTIONS (the spec states them; the build does not exist yet):
//  - `contract`, `manifest`, `loader`, `action` come from `@keel/router`; a thrown rule is an Error with a `code` member and the
//    first offending id in its message (E1510, E1513, E1515).
//  - Where a rule is "a type error, and `contract` or `manifest` throws it", the type error is claimed in ../unsafe/conformanceNegativeTypes.ts and the call is run untyped here.
//  - Which of `contract` and `manifest` throws E1503/E1504 is unstated; `codeOf` runs both.
import { createCtx } from "@keel/ctx";
import { action, createRouter, loader } from "@keel/router";
import { ok } from "@keel/schema";

export const SEED = 1337; // seed 1337

export type Thrown = { code: unknown; message: string };
/** What `fn` threw, or `null` when it returned. */
export const thrown = (fn: () => unknown): Thrown | null => {
  try {
    fn();
  } catch (e) {
    if (typeof e === "object" && e !== null) {
      const code = "code" in e ? e.code : "no-code";
      const message = "message" in e && typeof e.message === "string" ? e.message : "";
      return { code, message };
    }
    return { code: "no-code", message: String(e) };
  }
  return null;
};
export const codeOf = (fn: () => unknown): unknown => thrown(fn)?.code ?? null;

export const page = (): Node => document.createElement("section");

export type MemoryHistory = {
  push(url: string, key: string): void;
  replace(url: string, key: string): void;
  current(): string;
  onPop(fn: (url: string, key?: string) => void): void;
};
export const memoryHistory = (start: string): MemoryHistory => {
  let at = start;
  return {
    push: (url) => {
      at = url;
    },
    replace: (url) => {
      at = url;
    },
    current: () => at,
    onPop: () => {},
  };
};

export const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};

export const startRouter = (routes: Parameters<typeof createRouter>[0], at: string) => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const history = memoryHistory(at);
  const router = createRouter(routes, { ctx, history });
  return { router, history, ctx };
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
/**
 * A valid binding for every entry of `c`, built through the public `loader` and `action`: a component for a page or layout,
 * the declared handler for an API entry. `override` replaces the binding of one id.
 */
export const bindingOf = (
  c: { readonly entries: unknown },
  override: Record<string, unknown> = {},
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const entries: unknown = c.entries;
  if (!isRecord(entries)) return out;
  for (const [id, entry] of Object.entries(entries)) {
    if (!isRecord(entry) || "layout" in entry || !("method" in entry)) {
      out[id] = { component: page };
    } else if (entry.method === "GET") {
      out[id] = { loader: Reflect.apply(loader, undefined, [c, id, {}, async () => ok({ n: 1 })]) };
    } else {
      out[id] = { action: Reflect.apply(action, undefined, [c, id, {}, () => ok({ n: 1 })]) };
    }
  }
  return { ...out, ...override };
};
