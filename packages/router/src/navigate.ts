import { findRouter } from "./internal/findRouter.ts";
import type { Href } from "./types/Href.ts";

/**
 * Navigate the router rendering the caller (k.router Client): the one whose `App` encloses it, else the last one
 * mounted (an event handler's case); push, or replace the current entry with `replace`. With no router mounted it
 * does nothing and resolves.
 */
export async function navigate(href: Href, opts?: { readonly replace?: boolean }): Promise<void> {
  await findRouter()?.navigate(href, opts);
}
