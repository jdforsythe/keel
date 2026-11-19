import type { Schedule } from "@keel/ctx";
import type { JsonValue } from "@keel/schema";
import type { Serve } from "./Serve.ts";

/**
 * What `openGroup` takes (std.multi): `user`, the URL of a module exporting `{ routes, base: { id, params, search } }`;
 * `serve`, the server; `users`, how many; `seed`, the server's sim seed (each user's derives from it and its index);
 * `origin`, where users reach the server; `at`, when every user renders `base` (default 0); `server`, each server
 * store as stored under `keel.store.<id>` (default none); `schedule` (k.sim), split over the users (`userSchedule`) and
 * kept in the group.
 */
export interface GroupOptions {
  readonly user: string | URL;
  readonly serve: Serve;
  readonly users: number;
  readonly seed: number;
  readonly origin: string;
  readonly at?: number;
  readonly server?: { readonly [store: string]: JsonValue };
  readonly schedule?: Schedule;
}
