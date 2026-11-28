import type { RouteLiteral } from "./RouteLiteral.ts";

/**
 * The literal route table of a project's contracts and bindings (`routeLiterals`). `closed`: every contract was read
 * whole and every binding key was a literal, so an id outside `routes` cannot be in `routes.json`. `unread`: the
 * parts that are not literals, named (`<id> <field>`, `<id> <source text>`, `<id>`, `<file> ids`,
 * `<file> <source text>`, `<file>`, `<file> contract`), in source order.
 */
export type RouteLiterals = {
  readonly routes: Readonly<Record<string, RouteLiteral>>;
  readonly closed: boolean;
  readonly unread: readonly string[];
};
