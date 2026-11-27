// Read once, while this module is evaluated (k.realm Built-ins).
const KEY = Symbol.for("keel.census");
const Census = Map;
const get = Map.prototype.get;
const set = Map.prototype.set;
const apply = Reflect.apply;

/** `url` less its query and hash. */
const bare = (url: string): string => url.replace(/[?#].*$/, "");

/**
 * Enter `name` at `url` in the realm's census (k.realm One copy), the map of kernel package names to file URLs at
 * `globalThis[Symbol.for('keel.census')]`. Returns the URL an evaluation from another file entered first, else
 * `undefined`; the same file again is no second copy.
 */
export function census(name: string, url: string): string | undefined {
  if (typeof name !== "string" || typeof url !== "string") return undefined;
  const held: unknown = Reflect.get(globalThis, KEY);
  let map: Map<string, string>;
  if (held instanceof Census) map = held;
  else {
    map = new Census<string, string>();
    Object.defineProperty(globalThis, KEY, { value: map });
  }
  const here = bare(url);
  const first: unknown = apply(get, map, [name]);
  if (typeof first === "string" && first !== here) return first;
  apply(set, map, [name, here]);
  return undefined;
}
