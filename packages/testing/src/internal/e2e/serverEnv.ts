import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import type { Deployable } from "./Deployable.ts";

/** The test process's environment a server does not take: the runner's own, and every `KEEL_*` (sim ctx, e2e mode). */
const NOT_PASSED = /^(?:KEEL_|VITEST|__VITEST)|^(?:NODE_ENV|NODE_OPTIONS|TEST)$/;

/**
 * A `node` deployable's environment (k.e2e serve): the test process's own but its runner's and `KEEL_*` variables,
 * then `PORT`, `KEEL_SECRET`, `KEEL_ORIGIN`, `KEEL_PEER_<NAME>` per other node deployable, `KEEL_ALLOW_ORIGINS` (the
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
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !NOT_PASSED.test(k)) env[k] = v;
  env.PORT = String(o.port);
  env.KEEL_SECRET = o.secret;
  env.KEEL_ORIGIN = `http://127.0.0.1:${o.port}`;
  for (const n of o.nodes) if (n.name !== o.d.name) env[peerKey(n.name)] = `http://127.0.0.1:${o.portOf(n.name)}`;
  if (o.allow.length > 0) env.KEEL_ALLOW_ORIGINS = o.allow.join(",");
  if (o.d.storage === "sqlite") env.KEEL_DATABASE_URL = pathToFileURL(join(o.data, `${o.d.name}.sqlite`)).href;
  env.KEEL_FORMAT = "json";
  return { ...env, ...o.extra };
}
