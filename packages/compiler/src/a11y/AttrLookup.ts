/**
 * An element's attribute as `roleFor` sees it: the value (`""` for a bare attribute), `null` when absent, or
 * `undefined` when present but not known statically (a JSX expression). The DOM never yields `undefined`.
 */
export type AttrLookup = (name: string) => string | null | undefined;
