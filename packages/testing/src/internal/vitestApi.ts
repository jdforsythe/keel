/**
 * The one place `@keel/testing` names vitest. The specifier is computed, so a bundle of a runtime entry that reaches
 * `@keel/testing` (a std-sessions replay) shows no edge into a CLI-time package: vitest is the test runner, present
 * only where a test runs, and `freshGraph` is called from a test alone.
 */
const SPECIFIER = ["vi", "test"].join("");

/** The running vitest's `vi`. */
export async function vitestApi(): Promise<typeof import("vitest").vi> {
  const mod: typeof import("vitest") = await import(SPECIFIER);
  return mod.vi;
}
