import type { Slots } from "./Slots.ts";

/** A component (k.component): `(props, slots?) => Node`. Props are getters; `P` defaults to no props. */
export type Component<P = Record<string, never>> = (props: P, slots?: Slots) => Node;
