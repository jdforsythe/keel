import type { DesignFile } from "./DesignFile.ts";
import type { Found } from "./Found.ts";

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((s, i) => s === b[i]);

/** The token at `path` as file `from` sees it: its own file's first, then a file of the same mode, then any other file in the order given. */
export function findToken(files: readonly DesignFile[], from: number, path: readonly string[]): Found | undefined {
  const at = (file: number): Found | undefined => {
    const token = files[file]?.tokens.find((t) => same(t.path, path));
    return token === undefined ? undefined : { file, token };
  };
  const own = at(from);
  if (own !== undefined) return own;
  const mode = files[from]?.mode;
  const order = files.map((_, i) => i).filter((i) => i !== from);
  const alike = order.filter((i) => mode !== undefined && files[i]?.mode === mode);
  for (const i of [...alike, ...order]) {
    const f = at(i);
    if (f !== undefined) return f;
  }
  return undefined;
}
