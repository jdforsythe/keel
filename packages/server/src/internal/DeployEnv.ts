import { originOf } from "@keel/compiler/hosting/originOf";
import { peerKey } from "@keel/compiler/hosting/peerKey";
import { type ObjectSchema, s } from "@keel/schema";

/** An absolute `http:` or `https:` URL (a peer's `KEEL_PEER_<NAME>`). */
const PeerUrl = s.format("keel.peerUrl", s.string({ min: 1 }), {
  check: (v) => {
    const u = URL.canParse(v) ? new URL(v) : undefined;
    return u !== undefined && (u.protocol === "http:" || u.protocol === "https:");
  },
  gen: { from: s.string({ min: 1 }), map: (host) => `http://${host}` },
});

/** A URL whose scheme is one of `schemes` (`KEEL_DATABASE_URL`, k.deploy Storage); a bad value throws nothing. */
const DatabaseUrl = (schemes: readonly string[]) =>
  s.format("keel.databaseUrl", s.string({ min: 1 }), {
    check: (v) => {
      const u = URL.canParse(v) ? new URL(v) : undefined;
      return u !== undefined && schemes.includes(u.protocol);
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

/** An http(s) origin (`KEEL_ORIGIN`, k.deploy Refusals at start): scheme, host and port, no path. */
const Origin = s.format("keel.origin", s.string({ min: 1 }), {
  check: (v) => originOf(v) !== undefined,
  gen: { from: s.string({ min: 1 }), map: (host) => `https://${host}` },
});

/**
 * The production environment of a `node` deployable (k.topology Build): `PORT` (default 8080), `KEEL_ORIGIN` (the
 * public http(s) origin), `KEEL_SECRET` (32+ UTF-8 bytes, shared by the app's deployables) and `KEEL_PEER_<NAME>` per peer, an
 * absolute http(s) URL; `KEEL_ALLOW_ORIGINS`, the origins `createApp({ allow })` grants (k.hosting Allowed origins);
 * `KEEL_DATABASE_URL` (k.deploy Storage): a `file:` URL, optional, for `'sqlite'`, a `postgres:` or `postgresql:` one,
 * required, for `'postgres'`, not read for `'file'`.
 */
export const DeployEnv = (
  peers: readonly string[],
  storage: "file" | "sqlite" | "postgres" = "file",
): ObjectSchema<{
  PORT?: number;
  KEEL_ORIGIN?: string;
  KEEL_SECRET: string;
  KEEL_ALLOW_ORIGINS?: string;
  [peer: string]: unknown;
}> =>
  s.object({
    PORT: s.int({ min: 0, max: 65535 }).optional(),
    KEEL_ORIGIN: Origin.optional(),
    KEEL_SECRET: Secret,
    KEEL_ALLOW_ORIGINS: AllowOrigins.optional(),
    ...Object.fromEntries(peers.map((p) => [peerKey(p), PeerUrl])),
    ...(storage === "sqlite" ? { KEEL_DATABASE_URL: DatabaseUrl(["file:"]).optional() } : {}),
    ...(storage === "postgres" ? { KEEL_DATABASE_URL: DatabaseUrl(["postgres:", "postgresql:"]) } : {}),
  });
