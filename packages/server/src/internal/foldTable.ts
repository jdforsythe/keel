let table: Uint16Array | undefined;

/**
 * Letter case in the Basic Multilingual Plane, one code unit at a time: a unit maps to its upper-then-lower case when
 * that is one unit, else to its lower case when that is one unit, else to itself. A surrogate maps to itself. Made once.
 */
export function foldTable(): Uint16Array {
  if (table !== undefined) return table;
  const t = new Uint16Array(65_536);
  for (let u = 0; u < 65_536; u++) {
    const c = String.fromCharCode(u);
    const x = c.toUpperCase().toLowerCase();
    const y = c.toLowerCase();
    t[u] = x.length === 1 ? x.charCodeAt(0) : y.length === 1 ? y.charCodeAt(0) : u;
  }
  table = t;
  return t;
}
