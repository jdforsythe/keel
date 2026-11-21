import { checkEntries } from "../internal/checkEntries.ts";
import { encodeHref } from "../internal/encodeHref.ts";
import { shapesOf } from "../internal/shapesOf.ts";
import { toRecord } from "../internal/toRecord.ts";
import type { Href } from "../types/Href.ts";
import type { Checked } from "./types/Checked.ts";
import type { Contract } from "./types/Contract.ts";
import type { Entries } from "./types/Entries.ts";
import type { HrefArgs } from "./types/HrefArgs.ts";
import type { PageIds } from "./types/PageIds.ts";

/**
 * Declare module `module`'s contract (k.contract): its routes keyed by route id, each a page `{ path, params?,
 * search? }`, a layout `{ layout: true }` or an API entry `{ method, path, params?, query?, body?, output, errors?,
 * timeout?, events? }`. Throws an Error with `code` (k.routes Where rules fire): E1155 a key without the module
 * prefix, E1510 an entry of no kind or with a member its kind refuses, E1513 an API id whose name is not one lowerCamel
 * segment, E1503, E1504, E1653, E1113 (an API `output` holding `s.secret`), E1502 two entries at one path pattern but API entries at distinct methods, E1509.
 * Returns a frozen `{ kind: 'keel.contract', module, entries, href }`; `href(id, params?, search?)` links to a page.
 */
export function contract<const M extends string, const C extends Entries>(
  module: M,
  entries: C & NoInfer<Checked<M, C>>,
): Contract<M, C> {
  const shapes = checkEntries(module, entries);
  function href<K extends PageIds<C>>(id: K, ...args: HrefArgs<C[K]>): Href {
    return encodeHref(id, shapes.get(id), toRecord(args[0]), toRecord(args[1]));
  }
  const made: Contract<M, C> = Object.freeze({
    kind: "keel.contract",
    module,
    entries: Object.freeze({ ...entries }),
    href,
  });
  shapesOf.set(made, shapes);
  return made;
}
