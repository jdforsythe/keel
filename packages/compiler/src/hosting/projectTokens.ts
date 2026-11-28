import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { EvaluateFailure } from "../EvaluateFailure.ts";
import { evaluate } from "../evaluate.ts";
import { OBSERVE_BANNER } from "../internal/OBSERVE_BANNER.ts";
import { SERVER_ENV } from "../internal/SERVER_ENV.ts";
import { UNRESOLVED_MARK } from "../internal/UNRESOLVED_MARK.ts";
import { evaluatorAnswers } from "../internal/evaluatorAnswers.ts";
import { importMetaPlugin } from "../internal/importMetaPlugin.ts";
import { observePlugin } from "../internal/observePlugin.ts";
import type { TokensResult } from "./TokensResult.ts";
import { shippedTokensPlugin } from "./shippedTokensPlugin.ts";

// Resolved from the project root, which a project with `tokens.ts` depends on (its `defineTokens` or `brandTokens`).
const UI_CSS = "@keel/ui/css";
const ENTRY = `import { TokenSchema } from "@keel/ui/tokens";
import { schemesOf } from ${JSON.stringify(UI_CSS)};
const message = (e) => (e && typeof e === "object" && "message" in e ? String(e.message) : String(e));
const refused = (path, text) => ({ ok: false, reason: text, path: path.map(String) });
let result;
__keelAt("tokens.ts");
try {
  const m = await import("./tokens.ts");
  const tokens = m.tokens;
  if (tokens === undefined) result = { ok: false, reason: "tokens.ts exports no tokens" };
  else {
    const parsed = TokenSchema.parse(tokens);
    result = parsed.ok
      ? { ok: true, tokens: parsed.value, schemes: [...schemesOf(parsed.value)] }
      : refused(parsed.error.data.issues[0]?.path ?? [], parsed.error.message);
  }
} catch (e) {
  const issues = e && typeof e === "object" && e.code === "E1807" && Array.isArray(e.issues) ? e.issues : [];
  result = issues.length > 0 ? refused(issues[0].path, message(e)) : { ok: false, reason: "tokens.ts throws: " + message(e) };
}
export { result };
`;

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === "object" && x !== null;

/**
 * The `tokens` export of `<root>/tokens.ts`, parsed by the project's `TokenSchema` (k.a11y-static Tokens), with
 * its color schemes (`schemesOf`, k.schemes), or
 * undefined when the file is absent. Tokens `TokenSchema` refuses, by the export or a `defineTokens` throw, give the
 * first issue's path and `<path>: <what>` (k.themes Token errors); a throw or a bundle error otherwise
 * `tokens.ts throws: <message>`, and no `tokens` export `tokens.ts exports no tokens`. The file and everything it
 * imports are bundled with esbuild (Node's conditions and `keel`, as `evaluateProject`; a listed library's `./tokens`
 * is the module `shippedTokensPlugin` makes from its literal, so no library's tokens file runs, k.looks, with the
 * evaluator's banner and views) and run in an evaluator (k.evaluator) on every call, so a long-lived process never
 * judges a stale token and nothing the file does reaches it. `keel check`, `keel build`, `keel test`'s setup and the
 * evidence's contrast table all evaluate `tokens.ts` here.
 */
export async function projectTokens(root: string): Promise<TokensResult | undefined> {
  if (!fs.existsSync(path.join(root, "tokens.ts"))) return undefined;
  let text: string;
  try {
    const out = await build({
      stdin: { contents: ENTRY, resolveDir: root, sourcefile: "keel-tokens.js", loader: "js" },
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      conditions: ["keel"],
      target: "node20",
      logLevel: "silent",
      loader: { ".css": "empty" },
      banner: { js: OBSERVE_BANNER },
      define: { "import.meta.env": JSON.stringify(SERVER_ENV), "import.meta": "__keelMeta" },
      supported: { "dynamic-import": false },
      plugins: [observePlugin(), shippedTokensPlugin(root), importMetaPlugin()],
    });
    text = out.outputFiles[0]?.text ?? "";
  } catch (e) {
    const first = isRecord(e) && Array.isArray(e.errors) ? e.errors[0] : undefined;
    const reason = isRecord(first) && typeof first.text === "string" ? first.text : String(e);
    return { ok: false, reason: `tokens.ts throws: ${reason}` };
  }
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-tokens-")));
  try {
    const file = path.join(dir, "tokens.mjs");
    fs.writeFileSync(file, text.replace(UNRESOLVED_MARK, "[]"));
    const out = await evaluate({ kind: "data", entry: file, answer: evaluatorAnswers().answer });
    if (out instanceof EvaluateFailure) return { ok: false, reason: `tokens.ts throws: ${out.message}` };
    const result = out.result;
    if (isRecord(result) && result.ok === true) {
      const schemes = Array.isArray(result.schemes) ? result.schemes.filter((x) => typeof x === "string") : ["light"];
      return { ok: true, tokens: result.tokens, schemes };
    }
    if (isRecord(result) && typeof result.reason === "string") {
      const at = Array.isArray(result.path) ? result.path.filter((x) => typeof x === "string") : undefined;
      return at === undefined ? { ok: false, reason: result.reason } : { ok: false, reason: result.reason, path: at };
    }
    return { ok: false, reason: "tokens.ts throws" };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
