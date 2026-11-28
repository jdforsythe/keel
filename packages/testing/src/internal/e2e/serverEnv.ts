import { join } from "node:path";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import type { Deployable } from "./Deployable.ts";
import { baseEnv } from "./baseEnv.ts";

/**
 * A `node` deployable's environment (k.e2e serve): `baseEnv` of its data folder (no other name of the run's
 * environment, so a token in the developer's shell reaches no app code unless `env` passes it), then `HOST=127.0.0.1`, `PORT`, `KEEL_SECRET`, `KEEL_ORIGIN`, `KEEL_PEER_<NAME>` per other node deployable, `KEEL_ALLOW_ORIGINS` (the
 * run's hosted clients), `KEEL_DATABASE_URL` for `storage: 'sqlite'` and `KEEL_FORMAT=json`; `extra` last.
 */
export function serverEnv(o: {
  readonly d: Deployable;
  readonly port: number;
  readonly secret: string;
  readonly data: string;
  readonly nodes: readonly Deployable[];
  readonly portOf: (name: string) => number;
  readonly allow: readonly string[];
  readonly extra: Readonly<Record<string, string>>;
}): Record<string, string> {
  const env = baseEnv(o.data);
  env.HOST = "127.0.0.1";
  env.PORT = String(o.port);
  env.KEEL_SECRET = o.secret;
  env.KEEL_ORIGIN = `http://127.0.0.1:${o.port}`;
  for (const n of o.nodes) if (n.name !== o.d.name) env[peerKey(n.name)] = `http://127.0.0.1:${o.portOf(n.name)}`;
  if (o.allow.length > 0) env.KEEL_ALLOW_ORIGINS = o.allow.join(",");
  if (o.d.storage === "sqlite") env.KEEL_DATABASE_URL = `file:${join(o.data, `${o.d.name}.sqlite`)}`;
  env.KEEL_FORMAT = "json";
  return { ...env, ...o.extra };
}
