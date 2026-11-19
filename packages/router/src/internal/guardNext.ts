import type { Located } from "./Located.ts";
import { MAX_GUARD_HOPS } from "./MAX_GUARD_HOPS.ts";
import { carriedNext } from "./carriedNext.ts";
import { matchUrl } from "./matchUrl.ts";
import { nextOf } from "./nextOf.ts";
import { withoutNext } from "./withoutNext.ts";

/**
 * The `next` a guard redirect carries for denied `url` (k.guards): `url` itself, except on a guard's
 * `redirect` route, where its own `next` is passed on, innermost first, so `next` never nests (`/login?next=%2Fa`
 * denied gives `next=/a`). One pass of at most `MAX_GUARD_HOPS` levels, each `next` at most `MAX_NEXT_LENGTH` long; a `next` that `carriedNext` refuses, or a level past the cap, is dropped: that URL without `next`.
 */
export function guardNext(table: readonly Located[], url: string): string {
  let at = url;
  let targets: ReadonlySet<string> | null = null;
  for (let level = 0; ; level++) {
    const inner = nextOf(at);
    if (inner === null) return at;
    targets ??= new Set(table.flatMap((r) => r.chain.flatMap((l) => l.def.guard?.redirect ?? [])));
    const id = matchUrl(table, at).route?.id;
    if (id === undefined || !targets.has(id)) return at;
    if (level >= MAX_GUARD_HOPS || !carriedNext(inner)) return withoutNext(at);
    at = inner;
  }
}
