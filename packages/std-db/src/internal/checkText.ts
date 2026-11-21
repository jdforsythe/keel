const BAD = /\0|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

/**
 * Throws when a key or value holds U+0000 or a lone surrogate, which Postgres text refuses and UTF-8 cannot carry;
 * JSON text never holds either. Names neither the key nor the value.
 */
export function checkText(texts: readonly (string | undefined)[]): void {
  for (const t of texts)
    if (t !== undefined && BAD.test(t)) throw new Error("std.db: a key or value holds U+0000 or a lone surrogate");
}
