/**
 * Where the value of top-level key `key` of the JSON object `text` begins, as a 1-based line and column; undefined when
 * `text` holds no such key at the top level. A scan of strings and nesting, no parse: a key of a nested object is
 * never taken for a top-level one.
 */
export function jsonFieldAt(text: string, key: string): { line: number; col: number } | undefined {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const word = text.slice(i + 1, j);
      let k = j + 1;
      while (k < text.length && /\s/.test(text[k] ?? "")) k++;
      if (depth === 1 && text[k] === ":" && word === key) {
        k++;
        while (k < text.length && /\s/.test(text[k] ?? "")) k++;
        const before = text.slice(0, k);
        return { line: before.split("\n").length, col: k - before.lastIndexOf("\n") };
      }
      i = j;
    }
  }
  return undefined;
}
