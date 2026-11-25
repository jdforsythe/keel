import type { Use } from "./Use.ts";

/** One non-skipped `it`/`test` call of a test file: what its body uses, and the 1-based lines its call spans. */
export type TestCall = Use & { readonly from: number; readonly to: number };
