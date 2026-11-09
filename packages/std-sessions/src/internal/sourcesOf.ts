import type { Program } from "oxc-parser";

/** The module specifiers a program imports or re-exports (`import`, `export { } from`, `export * from`), with spans. */
export function sourcesOf(program: Program): { readonly value: string; readonly start: number }[] {
  const out: { value: string; start: number }[] = [];
  for (const st of program.body) {
    if (st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration") out.push(st.source);
    else if (st.type === "ExportNamedDeclaration" && st.source !== null) out.push(st.source);
  }
  return out;
}
