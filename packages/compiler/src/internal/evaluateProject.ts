import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { compile } from "../compile.ts";
import type { RouteEntry } from "../types/RouteEntry.ts";
import type { StyleUsage } from "../types/StyleUsage.ts";
import { internalFailure } from "./internalFailure.ts";

// Build-time only (D24): the bundle below is resolved from the app root, which depends on these packages.
const UI_CSS = "@keel/ui/css";
const ROUTER = "@keel/router";

const q = (s: string): string => JSON.stringify(s);

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isNullableString = (x: unknown): x is string | null => x === null || typeof x === "string";

function isRouteEntry(x: unknown): x is RouteEntry {
  return (
    isRecord(x) &&
    Array.isArray(x.actions) &&
    x.actions.every((v) => typeof v === "string") &&
    isNullableString(x.guard) &&
    isNullableString(x.layout) &&
    typeof x.module === "string" &&
    isNullableString(x.path) &&
    "params" in x &&
    "search" in x
  );
}

/** Source of the evaluator entry: compiles the CSS and the routes artifact inside the app's own module graph. */
function entrySource(tokensFile: string | undefined, routesFiles: readonly string[], usages: readonly StyleUsage[]) {
  const lines: string[] = [];
  if (tokensFile !== undefined) lines.push(`import { compileStyles } from ${q(UI_CSS)};`);
  if (routesFiles.length > 0) lines.push(`import { routesArtifact } from ${q(ROUTER)};`);
  lines.push(
    `const usages = ${JSON.stringify(usages)};`,
    "const problems = [];",
    "const internal = [];",
    "let css = '';",
    "const message = (e) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e));",
    "const coded = (e) => e && typeof e === 'object' && 'code' in e && /^E[0-9]{4}$/.test(String(e.code));",
    // A diagnostic-shaped error keeps its code; any other throw from the compiler call is an internal failure.
    "const report = (e) => { if (coded(e)) problems.push(`${e.code} ${message(e)}`); else internal.push(message(e)); };",
  );
  if (tokensFile !== undefined)
    lines.push(
      "let tokens;",
      // The tokens module throwing while it evaluates means tokens.ts is unusable: E1807 unless it carries its own code.
      `try { const m = await import(${q(`./${tokensFile}`)}); tokens = m.tokens ?? m.default; }`,
      `catch (e) { problems.push(coded(e) ? \`\${e.code} \${message(e)}\` : \`E1807 ${tokensFile} failed to evaluate: \${message(e)}\`); }`,
      "const fits = (u) => { try { compileStyles({ tokens, usages: [u] }); return true; } catch (e) { report(e); return false; } };",
      `if (tokens === undefined && problems.length === 0) problems.push('E1807 ${tokensFile} exports no tokens');`,
      "else if (tokens !== undefined) {",
      "  try { css = compileStyles({ tokens, usages }).css; }",
      "  catch { try { css = compileStyles({ tokens, usages: usages.filter(fits) }).css; } catch (e) { report(e); } }",
      "}",
    );
  // Each routes.ts is imported dynamically so its throw is catchable: E1006 unless it carries its own code.
  if (routesFiles.length > 0)
    lines.push(
      "const manifest = async (file, load) => {",
      "  let m;",
      "  try { m = await load(); }",
      "  catch (e) { problems.push(coded(e) ? `${e.code} ${message(e)}` : `E1006 ${file} failed to evaluate: ${message(e)}`); return {}; }",
      "  if (m.routes === undefined) { problems.push(`E1006 ${file} exports no routes`); return {}; }",
      "  try { return routesArtifact(m.routes); } catch (e) { report(e); return {}; }",
      "};",
    );
  lines.push(
    `const routes = Object.assign({}, ${routesFiles.map((f) => `await manifest(${q(f)}, () => import(${q(`./${f}`)}))`).join(", ")});`,
    "export default JSON.stringify({ css, problems: [...new Set(problems)], internal: [...new Set(internal)], routes });",
  );
  return lines.join("\n");
}

/**
 * Evaluate the app's `tokens.ts` and `routes.ts` manifests at build time (D24): bundle a generated entry with
 * esbuild from `root` (app modules under `root` go through `compile`, as in Vite; packages are bundled as is), run it once in
 * Node, and read back the atomic CSS (`compileStyles` from `@keel/ui/css` over `usages`) and the merged
 * `routes.json` (`routesArtifact` from `@keel/router` per manifest). Usages with an unknown token are left out
 * of the CSS and listed in `problems` (E1801; `keel check` reports them at their source). Error mapping (k.compiler
 * Build-time evaluation): a diagnostic-shaped error keeps its `code`; `tokens.ts` throwing while it evaluates, or
 * exporting no tokens, is E1807 (k.ui); a `routes.ts` throwing or exporting no `routes` is E1006 (that manifest
 * contributes no routes); a syntax error in any evaluated app module is E1000 at its location, with no CSS or routes;
 * any other codeless throw from the compiler side rejects with E1049 (`internalFailure`), never an app code.
 */
export async function evaluateProject(input: {
  readonly root: string;
  readonly tokensFile: string | undefined;
  readonly routesFiles: readonly string[];
  readonly usages: readonly StyleUsage[];
}): Promise<{ css: string; routes: Record<string, RouteEntry>; problems: string[] }> {
  const { root } = input;
  if (input.tokensFile === undefined && input.routesFiles.length === 0) return { css: "", routes: {}, problems: [] };
  // The tokens module is imported dynamically (so its throw is catchable), which esbuild treats as optional.
  if (input.tokensFile !== undefined && !fs.existsSync(path.join(root, input.tokensFile)))
    throw new Error(`keel: Could not resolve "./${input.tokensFile}" (tokens file)`);
  const syntax: string[] = [];
  const bundled = build({
    stdin: {
      contents: entrySource(input.tokensFile, input.routesFiles, input.usages),
      resolveDir: root,
      sourcefile: "keel-evaluate.js",
      loader: "js",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    // Node's own conditions (`node`, `import`, `default`), without esbuild's `module`: the file a package's `exports`
    // gives here is the one Node imports and the one `routeLiterals` reads.
    conditions: [],
    target: "node20",
    logLevel: "silent",
    plugins: [
      {
        name: "keel-jsx",
        setup(b) {
          b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args) => {
            const rel = path.relative(root, args.path).split(path.sep).join("/");
            if (rel.startsWith("../") || path.isAbsolute(rel) || rel.split("/").includes("node_modules"))
              return undefined;
            const r = compile([{ path: rel, source: fs.readFileSync(args.path, "utf8") }]);
            const broken = r.diagnostics.filter((d) => d.code === "E1000");
            if (broken.length > 0) {
              for (const d of broken) syntax.push(`E1000 ${d.path}:${d.line}:${d.col} ${d.message}`);
              return { errors: broken.map((d) => ({ text: d.message })) };
            }
            const out = r.outputs[0];
            return { contents: out?.code ?? "", loader: "ts", resolveDir: path.dirname(args.path) };
          });
        },
      },
    ],
  });
  const result = await bundled.catch((e: unknown) => {
    if (syntax.length > 0) return undefined;
    throw e;
  });
  if (result === undefined) return { css: "", routes: {}, problems: [...new Set(syntax)] };
  const text = result.outputFiles[0]?.text ?? "";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-evaluate-"));
  const file = path.join(dir, "evaluate.mjs");
  let json: unknown;
  try {
    fs.writeFileSync(file, text);
    const mod: unknown = await import(pathToFileURL(file).href);
    json = isRecord(mod) && typeof mod.default === "string" ? JSON.parse(mod.default) : undefined;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (
    !isRecord(json) ||
    typeof json.css !== "string" ||
    !isRecord(json.routes) ||
    !Array.isArray(json.problems) ||
    !Array.isArray(json.internal)
  )
    throw internalFailure("build-time evaluation returned no result");
  const internal = json.internal.filter((p) => typeof p === "string");
  if (internal.length > 0) throw internalFailure(`build-time evaluation: ${internal.join("; ")}`);
  const routes: Record<string, RouteEntry> = Object.create(null);
  for (const id of Object.keys(json.routes).sort()) {
    const entry = json.routes[id];
    if (isRouteEntry(entry)) routes[id] = entry;
  }
  return { css: json.css, routes, problems: json.problems.filter((p) => typeof p === "string") };
}
