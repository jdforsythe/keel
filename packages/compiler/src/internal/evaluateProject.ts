import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { compile } from "../compile.ts";
import type { RouteEntry } from "../types/RouteEntry.ts";
import type { StyleUsage } from "../types/StyleUsage.ts";

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
  if (tokensFile !== undefined) {
    lines.push(`import { compileStyles } from ${q(UI_CSS)};`, `import * as tokensModule from ${q(`./${tokensFile}`)};`);
  }
  if (routesFiles.length > 0) lines.push(`import { routesArtifact } from ${q(ROUTER)};`);
  routesFiles.forEach((f, i) => void lines.push(`import { routes as r${i} } from ${q(`./${f}`)};`));
  lines.push(
    `const usages = ${JSON.stringify(usages)};`,
    "const problems = [];",
    "let css = '';",
    "const message = (e) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e));",
    "const code = (e) => (e && typeof e === 'object' && 'code' in e ? String(e.code) : 'E1807');",
  );
  if (tokensFile !== undefined)
    lines.push(
      "const tokens = tokensModule.tokens ?? tokensModule.default;",
      "const fits = (u) => { try { compileStyles({ tokens, usages: [u] }); return true; } catch (e) { problems.push(`${code(e)} ${message(e)}`); return false; } };",
      "try { css = compileStyles({ tokens, usages }).css; }",
      "catch { try { css = compileStyles({ tokens, usages: usages.filter(fits) }).css; } catch (e) { problems.push(`${code(e)} ${message(e)}`); } }",
    );
  lines.push(
    `const routes = Object.assign({}, ${routesFiles.map((_, i) => `routesArtifact(r${i})`).join(", ")});`,
    "export default JSON.stringify({ css, problems: [...new Set(problems)], routes });",
  );
  return lines.join("\n");
}

/**
 * Evaluate the app's `tokens.ts` and `routes.ts` manifests at build time (D24): bundle a generated entry with
 * esbuild from `root` (app modules under `root` go through `compile`, as in Vite; packages are bundled as is), run it once in
 * Node, and read back the atomic CSS (`compileStyles` from `@keel/ui/css` over `usages`) and the merged
 * `routes.json` (`routesArtifact` from `@keel/router` per manifest). Usages with an unknown token are left out
 * of the CSS and listed in `problems` (E1801; `keel check` reports them at their source).
 */
export async function evaluateProject(input: {
  readonly root: string;
  readonly tokensFile: string | undefined;
  readonly routesFiles: readonly string[];
  readonly usages: readonly StyleUsage[];
}): Promise<{ css: string; routes: Record<string, RouteEntry>; problems: string[] }> {
  const { root } = input;
  if (input.tokensFile === undefined && input.routesFiles.length === 0) return { css: "", routes: {}, problems: [] };
  const result = await build({
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
            const out = compile([{ path: rel, source: fs.readFileSync(args.path, "utf8") }]).outputs[0];
            return { contents: out?.code ?? "", loader: "ts", resolveDir: path.dirname(args.path) };
          });
        },
      },
    ],
  });
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
  if (!isRecord(json) || typeof json.css !== "string" || !isRecord(json.routes) || !Array.isArray(json.problems))
    throw new Error("keel: build-time evaluation returned no result");
  const routes: Record<string, RouteEntry> = Object.create(null);
  for (const id of Object.keys(json.routes).sort()) {
    const entry = json.routes[id];
    if (isRouteEntry(entry)) routes[id] = entry;
  }
  return { css: json.css, routes, problems: json.problems.filter((p) => typeof p === "string") };
}
