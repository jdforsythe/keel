import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { lineCol } from "./internal/lineCol.ts";
import { serverImports } from "./internal/serverImports.ts";

const SERVER_FILE = /\.server\.[cm]?[jt]s$/;
/** A `*.test.*` or `*.spec.*` file, a top-level test directory, or a test directory inside a module (not its id). */
const TEST_PATH =
  /\.(?:test|spec)\.[cm]?[jt]sx?$|^(?:test|tests|__tests__)\/|(?:^|\/)modules\/[^/]+\/(?:[^/]+\/)*(?:test|tests|__tests__)\//;

/** E2451 (std.postgres, k.check registry): `@keel/std-postgres/server` imported outside a `*.server.ts` file, tests and type-only imports aside. No fix. */
export const serverImport: RuleDef = defineRule({
  code: "E2451",
  see: "std.postgres",
  message: "@keel/std-postgres/server outside a *.server.ts file",
  explain:
    "A database capability runs on the server, so no client bundle holds it or the driver under it. " +
    "Fix: move the database call into a *.server.ts file and reach it from a loader or action.",
  check: ({ file, ast }): Finding[] =>
    SERVER_FILE.test(file.path) || TEST_PATH.test(file.path)
      ? []
      : serverImports(ast).map((at) => ({ path: file.path, ...lineCol(file.source, at) })),
});
