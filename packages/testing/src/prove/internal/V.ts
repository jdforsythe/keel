import type { Ty } from "./Ty.ts";

/**
 * A translated JavaScript value: an SMT term `e` of sort `t` (`n`, a known length term of an array), a `Set` over the
 * values of an array, or `undefined` / `null`.
 */
export type V =
  | { readonly v: "val"; readonly t: Ty; readonly e: string; readonly n?: string }
  | { readonly v: "set"; readonly a: { readonly v: "val"; readonly t: Ty; readonly e: string; readonly n?: string } }
  | { readonly v: "nil"; readonly nul: boolean };
