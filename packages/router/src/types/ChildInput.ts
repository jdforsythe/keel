/** Children of a component (RFC 0008): a thunk, or a plain node, string, or array from hand-built calls. */
export type ChildInput = (() => Node | readonly Node[] | string) | Node | readonly Node[] | string | undefined;
