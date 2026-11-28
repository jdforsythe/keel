/**
 * The tag-forming value of an element prop (`Box as`, `Heading level`): `base` when absent, the value when it is
 * one of `tags`, else a throw (also when absent with no `base`). The type already closes the set (k.ui); this
 * holds it at runtime too, where a spread of parsed JSON is not typed.
 */
export function tagOf<T extends string | number>(prop: string, tags: readonly T[], value: T | undefined, base?: T): T {
  const v = value === undefined ? base : value;
  if (v !== undefined && tags.includes(v)) return v;
  throw new Error(`k.ui: ${prop}=${String(JSON.stringify(value)).slice(0, 40)} is not one of: ${tags.join(" ")}`);
}
