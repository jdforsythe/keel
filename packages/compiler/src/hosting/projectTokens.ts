import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import type { TokensResult } from "./TokensResult.ts";

// Resolved from the project root, which a project with `tokens.ts` depends on (its `defineTokens` or `brandTokens`).
const ENTRY = `import { TokenSchema } from "@keel/ui";
const message = (e) => (e && typeof e === "object" && "message" in e ? String(e.message) : String(e));
let result;
try {
  const m = await import("./tokens.ts");
  const tokens = m.tokens;
  if (tokens === undefined) result = { ok: false, reason: "tokens.ts exports no tokens" };
  else {
    const parsed = TokenSchema.parse(tokens);
    result = parsed.ok
      ? { ok: true, tokens: parsed.value }
      : { ok: false, reason: "tokens.ts: tokens fail TokenSchema: " + parsed.error.message };
  }
} catch (e) {
  result = { ok: false, reason: "tokens.ts failed to evaluate: " + message(e) };
}
export { result };
`;

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === "object" && x !== null;

/**
 * The `tokens` export of `<root>/tokens.ts`, parsed by the project's `TokenSchema` (k.a11y-static Tokens), or
 * undefined when the file is absent. The file and everything it imports are bundled with esbuild (Node's conditions,
 * as `evaluateProject`) and imported from a fresh temporary file on every call, so a long-lived process never judges
 * a stale token. A throw, a bundle error, no `tokens` export or a `TokenSchema` failure gives the reason, worded as
 * the render harness words it.
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
      conditions: [],
      target: "node20",
      logLevel: "silent",
      loader: { ".css": "empty" },
    });
    text = out.outputFiles[0]?.text ?? "";
  } catch (e) {
    const first = isRecord(e) && Array.isArray(e.errors) ? e.errors[0] : undefined;
    const reason = isRecord(first) && typeof first.text === "string" ? first.text : String(e);
    return { ok: false, reason: `tokens.ts failed to evaluate: ${reason}` };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-tokens-"));
  try {
    const file = path.join(dir, "tokens.mjs");
    fs.writeFileSync(file, text);
    const mod: unknown = await import(pathToFileURL(file).href);
    const result = isRecord(mod) ? mod.result : undefined;
    if (isRecord(result) && result.ok === true) return { ok: true, tokens: result.tokens };
    if (isRecord(result) && typeof result.reason === "string") return { ok: false, reason: result.reason };
    return { ok: false, reason: "tokens.ts failed to evaluate" };
  } catch (e) {
    return { ok: false, reason: `tokens.ts failed to evaluate: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
