/**
 * A sort (k.prove Sorts) with what `wf` checks of a value of it: integer and number bounds, the values of an enum or
 * literal (`one`). `s` names the declared SMT datatype of a record, option, array or `s.record` map.
 */
export type Ty =
  | { readonly k: "bool"; readonly one?: boolean }
  | { readonly k: "int" | "real"; readonly min?: number; readonly max?: number }
  | { readonly k: "str"; readonly one?: readonly string[] }
  | { readonly k: "obj"; readonly s: string; readonly f: readonly (readonly [string, Ty])[] }
  | { readonly k: "opt"; readonly s: string; readonly v: Ty; readonly nul: boolean }
  | { readonly k: "arr" | "rec"; readonly s: string; readonly v: Ty };
