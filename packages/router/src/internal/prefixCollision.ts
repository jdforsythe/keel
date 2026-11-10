import type { Prefix } from "./Prefix.ts";
import type { Registered } from "./Registered.ts";
import { paramEnum } from "./paramEnum.ts";
import { patternKey } from "./patternKey.ts";
import { prefixOf } from "./prefixOf.ts";

const keyOf = (p: Prefix): string => JSON.stringify([p.name, p.values, p.d]);

/**
 * Why one route table breaks k.prefix (E1509), or null: a `pathDefault` param that is not first in its path; two
 * prefix params; a prefixed route whose second segment is a param (its value could read as a prefix value once the
 * default's segment is left out); beside a prefixed route, a route whose static first segment is a value of the prefix param, whose
 * first segment is another param, or whose path is a prefixed route's path without the prefix.
 */
export function prefixCollision(routes: Iterable<Registered>): string | null {
  const paths = [...routes].flatMap((r) => (r.segments === null ? [] : [{ ...r, segments: r.segments }]));
  for (const { id, def, segments } of paths)
    for (const s of segments.slice(1))
      if (s.kind === "param" && paramEnum(def, s.name) !== null)
        return `${id}: pathDefault param ":${s.name}" must be the first segment of its path`;
  const prefixed = paths.flatMap((r) => {
    const pre = prefixOf(r.def, r.segments);
    return pre === null ? [] : [{ ...r, pre }];
  });
  const [first] = prefixed;
  if (first === undefined) return null;
  const other = prefixed.find((r) => keyOf(r.pre) !== keyOf(first.pre));
  if (other !== undefined) return `${other.id}: a second prefix param ":${other.pre.name}" beside ${first.id}'s`;
  const { pre } = first;
  for (const r of prefixed)
    if (r.segments[1]?.kind === "param")
      return `${r.id}: second segment ":${r.segments[1].name}" could read as :${pre.name} once its default is left out`;
  const elided = new Map(prefixed.map((r) => [patternKey(r.segments.slice(1)), r.id]));
  for (const { id, def, segments } of paths) {
    if (prefixOf(def, segments) !== null) continue;
    const s = segments[0];
    const fix = `; prepend /:${pre.name} to its path`;
    if (s?.kind === "static" && pre.values.includes(s.text))
      return `${id}: first segment "${s.text}" is a value of :${pre.name}${fix}`;
    if (s?.kind === "param" && s.name !== pre.name)
      return `${id}: first segment ":${s.name}" can be read as :${pre.name}${fix}`;
    const twin = elided.get(patternKey(segments));
    if (twin !== undefined) return `${id}: path is ${twin}'s path without its prefix${fix}`;
  }
  return null;
}
