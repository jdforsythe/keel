import { s } from "@keel/schema";

/**
 * The OUTPUT.md diagnostic record; `detail` the lines a failure prints below its head (an e2e test's `server:`,
 * `screenshot:` and `trace:` lines, k.e2e-page Failure output). Key order matches `@keel/compiler` and `@keel/check` (`see` before `fix`), so
 * `keel check --format=json` is byte-identical to the diagnostic the compiler emits (k.check Conformance).
 */
export const DiagSchema = s.object({
  kind: s.literal("diag"),
  code: s.string({ min: 5, max: 5 }),
  path: s.string().optional(),
  line: s.int().optional(),
  col: s.int().optional(),
  message: s.string(),
  see: s.string().optional(),
  fix: s.string().optional(),
  detail: s.string().optional(),
});
