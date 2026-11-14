/**
 * The project path relative specifier `spec` (with no extension) names from the file at `from`: a `.ts` file;
 * undefined for a package specifier.
 */
export function resolvePath(from: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined;
  const parts = from.split("/").slice(0, -1);
  for (const p of spec.split("/"))
    if (p === "..") parts.pop();
    else if (p !== ".") parts.push(p);
  return `${parts.join("/")}.ts`;
}
