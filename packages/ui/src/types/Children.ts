import type { Child } from "./Child.ts";

/** The default slot (RFC 0008): the compiler delivers JSX children as a thunk, rendered inside the child's scope. */
export type Children = () => Child;
