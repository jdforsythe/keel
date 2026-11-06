/** Source text as the type checker sees it, and the map from its offsets back to the original's (-1: added text). */
export type Annotated = { readonly text: string; readonly original: (pos: number) => number };
