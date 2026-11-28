import type { HostMembers } from "./HostMembers.ts";

/**
 * The allowlist of a build-time evaluation's host views (`HOST_VIEWS`): the global object the bundle sees, `process`,
 * `navigator`, a `node:fs` stat result and file handle, `WebAssembly`, and each Node built-in by its name without `node:` (`pure`: the
 * module as it is; `console` and `process`: the evaluation's own; else its members). A built-in not listed is refused whole.
 */
export type HostViews = {
  readonly globals: HostMembers;
  readonly process: HostMembers;
  readonly navigator: HostMembers;
  readonly stats: HostMembers;
  readonly fileHandle: HostMembers;
  readonly webAssembly: HostMembers;
  readonly builtins: Readonly<Record<string, "pure" | "console" | "process" | HostMembers>>;
};
