import type { BindingInfo } from "./BindingInfo.ts";

/** Lowered module text, its source map to the input (JSON), and the bindings it emitted. */
export type Lowered = { code: string; map: string; bindings: BindingInfo[] };
