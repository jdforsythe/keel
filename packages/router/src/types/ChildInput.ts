/** Children of `Form`: a thunk, so the content is made inside the element that holds it. */
export type ChildInput = (() => Node | readonly Node[] | string) | undefined;
