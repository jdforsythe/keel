import type { RouteLiterals } from "@keel/compiler";

/** What E1005 compares one project's artifacts with: compiled hashes, and the `routes.ts` literals when evaluated. */
export type Expected = {
  readonly hashes: Readonly<Record<string, string | null>>;
  readonly routes?: RouteLiterals | undefined;
};
