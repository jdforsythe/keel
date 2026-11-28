/** Directories the compiler never reads app code from: build output, reports, and test trees. */
const SKIP: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "coverage",
  "reports",
  "test",
  "tests",
  "conformance",
]);
const CODE = /\.[cm]?[jt]sx?$/;
/** Tests, declarations, and tool configs (`vite.config.ts`, `x.config.tsx`) are not app code. */
const NOT_APP = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$|\.config\.[cm]?[jt]sx?$/;

/**
 * The one rule for which files the `.keel/` artifacts derive from (rfc:0050): the Vite plugin, `keel build`, and
 * `artifactHashes` all use it. A root-relative path (`/`-separated) of a JS/TS module that is not a test, a
 * declaration, or a tool config, with no dot segment and no segment in the skip set.
 */
export function isSourcePath(rel: string): boolean {
  const parts = rel.split("/");
  const name = parts.at(-1) ?? "";
  return parts.every((p) => p !== "" && !p.startsWith(".") && !SKIP.has(p)) && CODE.test(name) && !NOT_APP.test(name);
}
