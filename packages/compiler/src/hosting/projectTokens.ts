import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import type { TokensResult } from "./TokensResult.ts";
import { shippedTokensPlugin } from "./shippedTokensPlugin.ts";

// Resolved from the project root, which a project with `tokens.ts` depends on (its `defineTokens` or `brandTokens`).
const UI_CSS = "@keel/ui/css";
const ENTRY = `import { TokenSchema } from "@keel/ui";
import { schemesOf } from ${JSON.stringify(UI_CSS)};
const message = (e) => (e && typeof e === "object" && "message" in e ? String(e.message) : String(e));
let result;
try {
  const m = await import("./tokens.ts");
  const tokens = m.tokens;
  if (tokens === undefined) result = { ok: false, reason: "tokens.ts exports no tokens" };
  else {
    const parsed = TokenSchema.parse(tokens);
    result = parsed.ok
      ? { ok: true, tokens: parsed.value, schemes: [...schemesOf(parsed.value)] }
      : { ok: false, reason: "tokens.ts: tokens fail TokenSchema: " + parsed.error.message };
  }
} catch (e) {
  result = { ok: false, reason: "tokens.ts failed to evaluate: " + message(e) };
}
export { result };
`;

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === "object" && x !== null;

/**
 * The `tokens` export of `<root>/tokens.ts`, parsed by the project's `TokenSchema` (k.a11y-static Tokens), with
 * its color schemes (`schemesOf`, k.schemes), or
 * undefined when the file is absent. The file and everything it imports are bundled with esbuild (Node's conditions
 * and `keel`, as `evaluateProject`; a listed library's `./tokens` is the module `shippedTokensPlugin` makes from its literal, so
 * no library's tokens file runs, k.looks) into one self-contained module, imported as a `data:` URL: Node's own loader
 * runs it whatever loader the caller runs under (a test runner's included), it needs no file, and a changed `tokens.ts`
 * gives a new module, so a long-lived process never judges a stale token. `keel check`, `keel build`, `keel test`'s
 * setup and the evidence's contrast table all evaluate `tokens.ts` here. A throw, a bundle error, no `tokens` export or a `TokenSchema` failure gives the reason, worded as
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
    return { ok: false, reason: `tokens.ts failed to evaluate: ${reason}` };
  }
  try {
    const mod: unknown = await import(
      /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`
    );
    const result = isRecord(mod) ? mod.result : undefined;
    if (isRecord(result) && result.ok === true) {
      const schemes = Array.isArray(result.schemes) ? result.schemes.filter((x) => typeof x === "string") : ["light"];
      return { ok: true, tokens: result.tokens, schemes };
    }
    if (isRecord(result) && typeof result.reason === "string") return { ok: false, reason: result.reason };
    return { ok: false, reason: "tokens.ts failed to evaluate" };
  } catch (e) {
    return { ok: false, reason: `tokens.ts failed to evaluate: ${e instanceof Error ? e.message : String(e)}` };
  }
}
