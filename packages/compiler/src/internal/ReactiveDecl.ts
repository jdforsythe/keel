import type { Span } from "./Span.ts";

/** `const x = signal(...)` and friends, anywhere in the file. */
export type ReactiveDecl = Span & { name: string; kind: "signal" | "computed" | "resource"; init: Span };
