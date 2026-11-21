import type { RouteTable } from "@keel/router";
import type { createRouterWith } from "@keel/router/internal";

/** The route state of route table `T`'s router (`route()` of a `renderRoute` handle): a manifest's typed by its contract. */
export type RouteStateOf<T extends RouteTable> = ReturnType<ReturnType<typeof createRouterWith<T>>["route"]["get"]>;
