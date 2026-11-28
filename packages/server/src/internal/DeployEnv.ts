import { isIP } from "node:net";
import { originOf } from "@keel/compiler/hosting/originOf";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import { type ObjectSchema, attempt, s } from "@keel/schema";

/** An absolute `http:` or `https:` URL (a peer's `KEEL_PEER_<NAME>`). */
const PeerUrl = s.format("keel.peerUrl", s.string({ min: 1 }), {
  check: (v) => {
    const u = attempt(() => new URL(v));
    return u.ok && (u.value.protocol === "http:" || u.value.protocol === "https:");
  },
  gen: { from: s.string({ min: 1 }), map: (host) => `http://${host}` },
});

/** A URL whose scheme is one of `schemes` (`KEEL_DATABASE_URL`, k.deploy Storage); `attempt` keeps a bad value out of any thrown error. */
const DatabaseUrl = (schemes: readonly string[]) =>
  s.format("keel.databaseUrl", s.string({ min: 1 }), {
    check: (v) => {
      const u = attempt(() => new URL(v));
      return u.ok && schemes.includes(u.value.protocol);
    },
    gen: { from: s.string({ min: 1 }), map: (v) => `${schemes[0] ?? "file:"}/${encodeURIComponent(v)}` },
  });

/** At least 32 UTF-8 bytes (`KEEL_SECRET`, the `createApp({ secret })` floor). */
const Secret = s.format("keel.secret", s.string({ min: 1 }), {
  check: (v) => new TextEncoder().encode(v).length >= 32,
  gen: { from: s.string({ min: 32 }), map: (v) => v },
});

/** A comma-separated list of http(s) origins (`KEEL_ALLOW_ORIGINS`, k.hosting): no `*`, no path. */
const AllowOrigins = s.format("keel.allowOrigins", s.string({ min: 1 }), {
  check: (v) => v.split(",").every((o) => originOf(o.trim()) !== undefined),
  gen: { from: s.string({ min: 1 }), map: (host) => `https://${host}` },
});

/** An IP address to listen on (`HOST`, k.deploy): IPv4 or IPv6, no name. */
const ListenHost = s.format("keel.listenHost", s.string({ min: 1 }), {
  check: (v) => isIP(v) !== 0,
  gen: { from: s.string({ min: 1 }), map: () => "127.0.0.1" },
});

/**
 * The production environment of a `node` deployable (k.topology Build): `PORT` (default 8080), `HOST` (an IP address;
 * unset, every interface), `KEEL_ORIGIN` (the
 * public origin), `KEEL_SECRET` (32+ UTF-8 bytes, shared by the app's deployables) and `KEEL_PEER_<NAME>` per peer, an
 * absolute http(s) URL; `KEEL_ALLOW_ORIGINS`, the origins `createApp({ allow })` grants (k.hosting Allowed origins);
 * `KEEL_DATABASE_URL` (k.deploy Storage): a `file:` URL, optional, for `'sqlite'`, a `postgres:` or `postgresql:` one,
 * required, for `'postgres'`, not read for `'file'`.
 */
export const DeployEnv = (
  peers: readonly string[],
  storage: "file" | "sqlite" | "postgres" = "file",
): ObjectSchema<{
  PORT?: number;
  HOST?: string;
  KEEL_ORIGIN?: string;
  KEEL_SECRET: string;
  KEEL_ALLOW_ORIGINS?: string;
  [peer: string]: unknown;
}> =>
  s.object({
    PORT: s.int({ min: 0, max: 65535 }).optional(),
    HOST: ListenHost.optional(),
    KEEL_ORIGIN: s.string({ min: 1 }).optional(),
    KEEL_SECRET: Secret,
    KEEL_ALLOW_ORIGINS: AllowOrigins.optional(),
    ...Object.fromEntries(peers.map((p) => [peerKey(p), PeerUrl])),
    ...(storage === "sqlite" ? { KEEL_DATABASE_URL: DatabaseUrl(["file:"]).optional() } : {}),
    ...(storage === "postgres" ? { KEEL_DATABASE_URL: DatabaseUrl(["postgres:", "postgresql:"]) } : {}),
  });
