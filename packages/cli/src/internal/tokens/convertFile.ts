import type { DesignFile } from "./DesignFile.ts";
import type { FileConversion } from "./FileConversion.ts";
import type { Item } from "./Item.ts";
import type { Warn } from "./Warn.ts";
import { convertToken } from "./convertToken.ts";

/**
 * File `index` of `files` converted token by token. A token whose name (in its group; `look` for a look) is in
 * `claimed`, which holds the names of earlier collections, or was met before in this file, is skipped.
 */
export function convertFile(
  files: readonly DesignFile[],
  index: number,
  claimed: ReadonlyMap<string, ReadonlySet<string>>,
): FileConversion {
  const items: Item[] = [];
  const looks: { name: string; value: Readonly<Record<string, string>> }[] = [];
  const warns: Warn[] = [];
  const seen = new Map<string, Set<string>>();
  const taken = (group: string, name: string): boolean =>
    claimed.get(group)?.has(name) === true || seen.get(group)?.has(name) === true;
  const take = (group: string, name: string): void => {
    seen.set(group, (seen.get(group) ?? new Set()).add(name));
  };
  for (const token of files[index]?.tokens ?? []) {
    const dotted = token.path.join(".");
    const c = convertToken({ files, file: index }, token);
    if ("skip" in c) {
      warns.push({ at: token.valueAt, message: `${dotted}: ${c.skip} has no Keel group; skipped` });
      continue;
    }
    const clash = c.items.some((i) => taken(i.group, i.name)) || (c.look !== undefined && taken("look", c.look.name));
    if (clash) {
      warns.push({ at: token.valueAt, message: `${dotted}: name met before has no Keel group; skipped` });
      continue;
    }
    for (const i of c.items) take(i.group, i.name);
    items.push(...c.items);
    if (c.look !== undefined) {
      take("look", c.look.name);
      looks.push(c.look);
    }
    warns.push(...c.warns);
  }
  return { items, looks, warns };
}
