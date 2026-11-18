// Shared helpers for the std.copy conformance files (not a test file). Public API only. Seed 1337.
import "@keel/std-messages/tools";
import { codesOf, tree } from "./support.ts";

export { SEED, applyFix } from "./support.ts";
export type { Files } from "./support.ts";
export { CLEAN, codesOf, tree } from "./support.ts";

export const VIEW = "modules/recipes/RecipeList.tsx";
export const ROUTES = "modules/recipes/routes.ts";
export const COPY = "modules/recipes/copy.ts";
export const ROW = "modules/recipes/row.ts";

/** A component file whose default export returns `body`; `head` precedes it (imports, consts). */
export const component = (body: string, head = ""): string =>
  `${head}export default function RecipeList(props) {\n  return ${body}\n}\n`;

/** A `routes.ts` with one route whose `title` is `title`; `head` precedes the manifest. */
export const routes = (title: string, head = ""): string =>
  `import { manifest } from '@keel/router'\nimport RecipeList from './RecipeList.tsx'\n${head}export const routes = manifest({ 'recipes.list': { path: '/:locale/recipes', component: RecipeList, title: ${title} } })\n`;

/** The 1-based line of the first line of `source` holding `needle`. */
export const lineOf = (source: string, needle: string): number =>
  source.split("\n").findIndex((l) => l.includes(needle)) + 1;

/** E2406 diagnostics of the clean module with `overrides` applied. */
export const e2406 = (overrides: Record<string, string | null>) => codesOf(tree(overrides), "E2406");

/** E2406 diagnostics of a component file with the given JSX `body` (and `head`). */
export const inView = (body: string, head = "") => e2406({ [VIEW]: component(body, head) });
