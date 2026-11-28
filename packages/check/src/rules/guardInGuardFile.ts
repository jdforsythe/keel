import { findingAt } from "../internal/findingAt.ts";
import { handlerUsesIn } from "../internal/handlerUsesIn.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1009 (k.boundary, k.bundle Handlers): a use of `guard` from `@keel/router`, known by binding however it is imported
 * or re-exported (`handlerUsesIn`), in an app file not named `*.guard.*` or `*.server.*` (any case), as E1551 is for
 * loaders and actions. No fix: moving the guard is a file move.
 */
export const guardInGuardFile: RuleDef = {
  code: "E1009",
  message: "guard outside a *.guard.ts or *.server.ts file; move it to <name>.guard.ts",
  see: "k.boundary",
  check: ({ file, project }) =>
    isAppPath(file.path) && !/^packages\/|\.(?:guard|server)\.[^/]+$/i.test(file.path)
      ? handlerUsesIn(file.path, project)
          .filter((u) => u.kinds.has("guard"))
          .map((u) => findingAt(file, u.start))
      : [],
};
