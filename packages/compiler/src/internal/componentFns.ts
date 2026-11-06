import type { Analysis } from "./Analysis.ts";
import type { FnInfo } from "./FnInfo.ts";

/** Functions that render JSX and are named like components, or are the module's default export. */
export function componentFns(a: Analysis): FnInfo[] {
  const defaults = new Set<number>();
  for (const s of a.program.body) {
    if (s.type === "ExportDefaultDeclaration") defaults.add(s.declaration.start);
  }
  return a.functions.filter((f) => {
    const named = (f.name !== null && /^[A-Z]/.test(f.name)) || defaults.has(f.start);
    return named && a.jsx.some((j) => j.start >= f.start && j.end <= f.end);
  });
}
