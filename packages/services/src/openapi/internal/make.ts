import type { Doc } from "./Doc.ts";

/** Builders for `Doc`; `chain` appends a member call such as `.optional()` to a schema expression. */
export const make = {
  obj: (entries: readonly (readonly [string, Doc])[]): Doc => ({ t: "obj", entries }),
  arr: (items: readonly Doc[]): Doc => ({ t: "arr", items }),
  call: (callee: string, ...args: readonly Doc[]): Doc => ({ t: "call", callee, args, suffix: "" }),
  chain: (d: Doc, member: string): Doc =>
    typeof d === "string" ? `${d}${member}` : d.t === "call" ? { ...d, suffix: d.suffix + member } : d,
};
