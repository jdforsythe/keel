import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import type { TokensResult } from "./TokensResult.ts";
import { shippedTokensPlugin } from "./shippedTokensPlugin.ts";

// Resolved from the project root, which a project with `tokens.ts` depends on (its `defineTokens` or `brandTokens`).
const UI_CSS = "@keel/ui/css";
const ENTRY = `import { TokenSchema } from "@keel/ui/tokens";
import { schemesOf } from ${JSON.stringify(UI_CSS)};
const message = (e) => (e && typeof e === "object" && "message" in e ? String(e.message) : String(e));
const refused = (path, text) => ({ ok: false, reason: text, path: path.map(String) });
let result;
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
 * first issue's path and `<path>: <what>` (k.themes Token errors); a throw otherwise `tokens.ts throws: <message>`.
 * The file and everything it imports are bundled with esbuild (Node's conditions
 * and `keel`, as `evaluateProject`, so a library's `./tokens` entry is its source, k.looks) and imported from a fresh temporary file on every call, so a long-lived process never judges
 * a stale token.
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
      plugins: [shippedTokensPlugin(root)],
    });
    text = out.outputFiles[0]?.text ?? "";
  } catch (e) {
    const first = isRecord(e) && Array.isArray(e.errors) ? e.errors[0] : undefined;
    const reason = isRecord(first) && typeof first.text === "string" ? first.text : String(e);
    return { ok: false, reason: `tokens.ts throws: ${reason}` };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-tokens-"));
  try {
    const file = path.join(dir, "tokens.mjs");
    fs.writeFileSync(file, text);
    const mod: unknown = await import(pathToFileURL(file).href);
    const result = isRecord(mod) ? mod.result : undefined;
    if (isRecord(result) && result.ok === true) {
      const schemes = Array.isArray(result.schemes) ? result.schemes.filter((x) => typeof x === "string") : ["light"];
      return { ok: true, tokens: result.tokens, schemes };
    }
    if (isRecord(result) && typeof result.reason === "string") {
      const at = Array.isArray(result.path) ? result.path.filter((x) => typeof x === "string") : undefined;
      return at === undefined ? { ok: false, reason: result.reason } : { ok: false, reason: result.reason, path: at };
    }
    return { ok: false, reason: "tokens.ts throws" };
  } catch (e) {
    return { ok: false, reason: `tokens.ts throws: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
