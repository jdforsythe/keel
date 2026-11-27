import type { JSXOpeningElement } from "oxc-parser";

/** One use of a `@keel/ui` export: its offset (an element's `<`, a call's callee) and the element, for a call none. */
export type UiSite = { readonly at: number; readonly element: JSXOpeningElement | undefined };
