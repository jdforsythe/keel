import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";
import { stdIssue } from "../internal/stdIssue.ts";
import { stdBindings } from "./stdBindings.ts";

const clip = (x: string): string => (x.length > 24 ? `${x.slice(0, 21)}...` : x);

/**
 * A stdlib package's config by app module id (k.module Std config, rfc:0066): the `std[pkg]` of each module, from the
 * `.keel/std.json` that `createApp({ ctx, std })` bound to `ctx`, each value parsed with `schema` (the one the
 * package registered under `pkg`). `{}` for a ctx no `createApp` bound or a package no module configures. A value
 * failing `schema` throws E1158 (an Error with `code`) naming the module and path. The result is frozen.
 */
export function stdConfig<T>(ctx: Ctx, pkg: string, schema: Schema<T, boolean>): Readonly<Record<string, T>> {
  const data = stdBindings.get(ctx);
  const byModule = data !== undefined && Object.hasOwn(data, pkg) ? data[pkg] : undefined;
  const out: [string, T][] = [];
  for (const id of Object.keys(byModule ?? {}).sort()) {
    const value = byModule?.[id];
    const r = schema.parse(value);
    if (r.ok) {
      out.push([id, r.value]);
      continue;
    }
    const message = `E1158 std config for ${clip(pkg)} in module ${clip(id)} fails its schema ${stdIssue(schema, value)}`;
    throw Object.assign(new Error(message), { code: "E1158" });
  }
  return Object.freeze(Object.fromEntries(out));
}
