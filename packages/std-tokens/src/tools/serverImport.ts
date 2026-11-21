import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { lineCol } from "./internal/lineCol.ts";
import { serverImports } from "./internal/serverImports.ts";

const SERVER_FILE = /\.server\.[cm]?[jt]s$/;
/** A `*.test.*` or `*.spec.*` file, a top-level test directory, or a test directory inside a module (not its id). */
const TEST_PATH =
  /\.(?:test|spec)\.[cm]?[jt]sx?$|^(?:test|tests|__tests__)\/|(?:^|\/)modules\/[^/]+\/(?:[^/]+\/)*(?:test|tests|__tests__)\//;

/** E2201 (std.tokens, k.check registry): `@keel/std-tokens/server` imported outside a `*.server.ts` file, tests aside. No fix. */
export const serverImport: RuleDef = defineRule({
  code: "E2201",
  see: "std.tokens",
  message: "@keel/std-tokens/server outside a *.server.ts file",
  explain:
    "Tokens are minted and checked on the server, so no client bundle holds that code. " +
    "Fix: call tokens(ctx) from an action in a *.server.ts file.",
  check: ({ file, ast }): Finding[] =>
    SERVER_FILE.test(file.path) || TEST_PATH.test(file.path)
      ? []
      : serverImports(ast).map((at) => ({ path: file.path, ...lineCol(file.source, at) })),
});
