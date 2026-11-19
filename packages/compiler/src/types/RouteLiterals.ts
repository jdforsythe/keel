import type { RouteLiteral } from "./RouteLiteral.ts";

/**
 * The literal route table of a project's routes manifests (rfc:0059). `closed`: every route id was a literal, so an id
 * outside `routes` cannot be in `routes.json`. `unread`: the parts that are not literals, named (`<id> path`,
 * `<id> guard`, `<id>`, `<file>`, `<file> ids`), in source order.
 */
export type RouteLiterals = {
  readonly routes: Readonly<Record<string, RouteLiteral>>;
  readonly closed: boolean;
  readonly unread: readonly string[];
};
