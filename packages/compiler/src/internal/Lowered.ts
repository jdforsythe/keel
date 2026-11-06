import type { BindingInfo } from "./BindingInfo.ts";

/** Lowered module text and the bindings it emitted. */
export type Lowered = { code: string; bindings: BindingInfo[] };
