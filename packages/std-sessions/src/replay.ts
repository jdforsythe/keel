import type { Manifest, RouteDef } from "@keel/router";
import type { ReplayResult } from "./ReplayResult.ts";
import type { Session } from "./Session.schema.ts";
import { notImplemented } from "./internal/notImplemented.ts";

/** Replay `session` under a sim ctx with its seed (std.sessions API). Placeholder until backlog 0092. */
export function replay<M extends Readonly<Record<string, RouteDef>>>(
  _session: Session,
  _options: { readonly routes: Manifest<M> },
): Promise<ReplayResult> {
  return Promise.reject(notImplemented("replay"));
}
