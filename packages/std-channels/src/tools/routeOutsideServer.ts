import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { callsOf } from "./internal/callsOf.ts";
import { isAppFile } from "./internal/isAppFile.ts";
import { lineCol } from "./internal/lineCol.ts";

/**
 * E2601 (std.channels, k.check registry): a `channelRoute` call (from `@keel/std-channels/server`) in an app file
 * other than `*.server.ts`. Its `stores` and `member` run on the server only. No fix.
 */
export const routeOutsideServer: RuleDef = defineRule({
  code: "E2601",
  see: "std.channels",
  message: "channelRoute outside a *.server.ts file; move it to <name>.server.ts",
  explain:
    "A channel route's stores and member predicate stay on the server, so channelRoute is called in a *.server.ts " +
    "file. Fix: move it to modules/<id>/<name>.server.ts and list the route in that module's manifest.",
  check: ({ file, ast }): Finding[] =>
    !isAppFile(file.path) || /\.server\.[cm]?[jt]sx?$/.test(file.path)
      ? []
      : callsOf(ast, "@keel/std-channels/server", "channelRoute").map((c) => ({
          path: file.path,
          ...lineCol(file.source, c.start),
        })),
});
