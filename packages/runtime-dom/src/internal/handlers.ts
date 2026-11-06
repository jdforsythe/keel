import type { Handler } from "./Handler.ts";

/** Delegated handler table: element -> event type -> handler. Weak, so removed nodes free their entries. */
export const handlers: WeakMap<Element, Map<string, Handler>> = new WeakMap();
